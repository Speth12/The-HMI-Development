// Package runtime is the central orchestrator: drivers → TagStore → Historian + WS broadcast.
package runtime

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/Speth12/x-hmi/internal/alarmstore"
	"github.com/Speth12/x-hmi/internal/alarms"
	"github.com/Speth12/x-hmi/internal/drivers"
	_ "github.com/Speth12/x-hmi/internal/drivers/modbus"
	_ "github.com/Speth12/x-hmi/internal/drivers/mqtt"
	_ "github.com/Speth12/x-hmi/internal/drivers/opcua"
	_ "github.com/Speth12/x-hmi/internal/drivers/rest"
	_ "github.com/Speth12/x-hmi/internal/drivers/virtual"
	"github.com/Speth12/x-hmi/internal/eventbus"
	"github.com/Speth12/x-hmi/internal/historian"
	"github.com/Speth12/x-hmi/internal/namespace"
	"github.com/Speth12/x-hmi/internal/project"
	"github.com/Speth12/x-hmi/internal/tagstore"
)

// Runtime owns the TagStore, Historian, alarm Engine, and active driver instances.
type Runtime struct {
	Store      *tagstore.TagStore
	Historian  *historian.Historian
	Alarms     *alarms.Engine
	AlarmStore *alarmstore.AlarmStore
	Namespace  *namespace.Tree
	Events     *eventbus.Bus

	mu       sync.RWMutex
	drivers  map[string]drivers.ProtocolDriver // datasource id → driver
	cancel   context.CancelFunc
	pumpCtx  context.Context
	pumpCh   chan tagstore.TagUpdate
	wg       sync.WaitGroup
	project  *project.Project
}

// New returns an initialised runtime with the given store and historian.
// Either may be nil for tests.
func New(store *tagstore.TagStore, h *historian.Historian) *Runtime {
	if store == nil {
		store = tagstore.New()
	}
	return &Runtime{
		Store:     store,
		Historian: h,
		Alarms:    alarms.New(),
		Namespace: namespace.New(),
		Events:    eventbus.New(),
		drivers:   make(map[string]drivers.ProtocolDriver),
		pumpCh:    make(chan tagstore.TagUpdate, 1024),
	}
}

// Start begins the central pump goroutine. Call once.
func (r *Runtime) Start(ctx context.Context) {
	pumpCtx, cancel := context.WithCancel(ctx)
	r.cancel = cancel
	r.pumpCtx = pumpCtx
	r.wg.Add(1)
	go r.pump(pumpCtx)
	if r.AlarmStore != nil {
		r.wg.Add(1)
		go r.persistAlarms(pumpCtx)
	}
}

// Stop disconnects all drivers and stops the pump.
func (r *Runtime) Stop() {
	r.mu.Lock()
	for id, d := range r.drivers {
		_ = d.Disconnect()
		log.Printf("[RUNTIME] disconnected %s", id)
	}
	r.drivers = nil
	r.mu.Unlock()
	if r.cancel != nil {
		r.cancel()
	}
	r.wg.Wait()
}

// LoadProject reconfigures drivers based on a project file.
// Existing drivers not in the new project are disconnected.
func (r *Runtime) LoadProject(ctx context.Context, p *project.Project) error {
	// Update alarm rules.
	rules := make([]alarms.Rule, 0, len(p.AlarmRules))
	for _, ar := range p.AlarmRules {
		rules = append(rules, alarms.Rule{
			ID:        ar.ID,
			Name:      ar.Name,
			Binding:   ar.Binding,
			Condition: alarms.Condition(ar.Condition),
			Threshold: ar.Threshold,
			Severity:  alarms.Severity(ar.Severity),
			Message:   ar.Message,
		})
	}
	r.Alarms.SetRules(rules)

	// Publish all widget bindings into the namespace.
	for _, ds := range p.Datasources {
		prefix := ds.ID + ":"
		for _, pg := range p.Pages {
			for _, w := range pg.Widgets {
				if w.Binding == nil || *w.Binding == "" {
					continue
				}
				b := *w.Binding
				if strings.HasPrefix(b, prefix) {
					tagPath := b[len(prefix):]
					nsPath := ds.ID + "." + strings.ReplaceAll(tagPath, ":", ".")
					_, _ = r.Namespace.PublishDriverTag(nsPath, ds.ID, tagPath, "")
				}
			}
		}
	}

	r.Events.Publish(eventbus.Event{
		Type:    eventbus.EventProjectLoaded,
		Payload: map[string]any{"pages": len(p.Pages), "datasources": len(p.Datasources)},
	})

	r.mu.Lock()
	r.project = p
	desired := map[string]bool{}
	for _, ds := range p.Datasources {
		desired[ds.ID] = true
	}
	// disconnect removed datasources
	for id, d := range r.drivers {
		if !desired[id] {
			_ = d.Disconnect()
			delete(r.drivers, id)
			log.Printf("[RUNTIME] removed datasource %s", id)
		}
	}
	r.mu.Unlock()

	// connect new datasources, then subscribe all (new and existing) to bound tags
	for _, ds := range p.Datasources {
		if !r.has(ds.ID) {
			drv, err := r.buildDriver(ds.Type)
			if err != nil {
				log.Printf("[RUNTIME] %s: %v — skipped", ds.ID, err)
				continue
			}
			// Register driver before connecting so status endpoint always exists.
			r.mu.Lock()
			r.drivers[ds.ID] = drv
			r.mu.Unlock()
			cfg := buildConfig(ds)
			if err := drv.Connect(ctx, cfg); err != nil {
				log.Printf("[RUNTIME] %s: connect failed: %v", ds.ID, err)
				// driver remains registered with connected=false; status shows the error
			} else {
				log.Printf("[RUNTIME] connected %s (%s)", ds.ID, ds.Type)
			}
		}

		// Subscribe every time so re-deploys with new bindings take effect.
		drv := r.Driver(ds.ID)
		if drv == nil {
			continue
		}
		paths := tagsForDatasource(p, ds.ID)
		if len(paths) > 0 {
			fanCh := make(chan tagstore.TagUpdate, 256)
			dsID := ds.ID
			go func() {
				prefix := dsID + ":"
				for {
					select {
					case u, ok := <-fanCh:
						if !ok {
							return
						}
						u.Path = prefix + u.Path
						select {
						case r.pumpCh <- u:
						default:
						}
					case <-r.pumpCtx.Done():
						return
					}
				}
			}()
			if err := drv.Subscribe(r.pumpCtx, paths, fanCh); err != nil {
				log.Printf("[RUNTIME] %s: subscribe failed: %v", ds.ID, err)
			}
		}
	}
	return nil
}

// TestDatasource creates a temporary driver, attempts to connect within 10 s,
// returns its status, then disconnects. Safe to call concurrently.
func (r *Runtime) TestDatasource(ctx context.Context, ds project.DatasourceElement) drivers.DriverStatus {
	drv, err := r.buildDriver(ds.Type)
	if err != nil {
		return drivers.DriverStatus{LastError: err.Error()}
	}
	tctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	cfg := buildConfig(ds)
	if err := drv.Connect(tctx, cfg); err != nil {
		return drivers.DriverStatus{LastError: err.Error()}
	}
	// Give driver a moment to fully handshake (especially MQTT).
	select {
	case <-time.After(500 * time.Millisecond):
	case <-tctx.Done():
	}
	st := drv.Status()
	_ = drv.Disconnect()
	return st
}

// Project returns the currently loaded project (may be nil).
func (r *Runtime) Project() *project.Project {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.project
}

// Driver returns the driver for a datasource id (may be nil).
func (r *Runtime) Driver(id string) drivers.ProtocolDriver {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.drivers[id]
}

// Drivers returns a snapshot of (id → driver).
func (r *Runtime) Drivers() map[string]drivers.ProtocolDriver {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make(map[string]drivers.ProtocolDriver, len(r.drivers))
	for k, v := range r.drivers {
		out[k] = v
	}
	return out
}

func (r *Runtime) has(id string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, ok := r.drivers[id]
	return ok
}

// pump reads from drivers, writes to TagStore + Historian + Alarms.
func (r *Runtime) pump(ctx context.Context) {
	defer r.wg.Done()
	for {
		select {
		case <-ctx.Done():
			return
		case u, ok := <-r.pumpCh:
			if !ok {
				return
			}
			r.Store.Update(u.Path, u.State)
			if r.Historian != nil {
				_ = r.Historian.Record(u)
			}
			r.Alarms.Evaluate(u.Path, u.State.Value)
		}
	}
}

// PumpChan returns the channel drivers push into. Exposed for runtime tests.
func (r *Runtime) PumpChan() chan<- tagstore.TagUpdate { return r.pumpCh }

// persistAlarms subscribes to the alarm engine and writes every state
// transition to the AlarmStore so history survives restarts.
func (r *Runtime) persistAlarms(ctx context.Context) {
	defer r.wg.Done()
	ch := r.Alarms.Subscribe()
	defer r.Alarms.Unsubscribe(ch)
	for {
		select {
		case <-ctx.Done():
			return
		case ev, ok := <-ch:
			if !ok {
				return
			}
			if err := r.AlarmStore.Record(ev); err != nil {
				log.Printf("[RUNTIME] alarm persist: %v", err)
			}
		}
	}
}

func (r *Runtime) buildDriver(typ project.DatasourceType) (drivers.ProtocolDriver, error) {
	return drivers.Build(string(typ), drivers.BuildCtx{Store: r.Store})
}

func buildConfig(ds project.DatasourceElement) drivers.DriverConfig {
	cfg := drivers.DriverConfig{Extra: map[string]string{}}
	c := ds.Config
	if c.Endpoint != nil {
		cfg.Endpoint = *c.Endpoint
	}
	if c.Host != nil && cfg.Endpoint == "" {
		cfg.Endpoint = *c.Host
		if c.Port != nil {
			cfg.Endpoint = fmt.Sprintf("%s:%d", *c.Host, *c.Port)
		}
	}
	if c.Username != nil {
		cfg.Username = *c.Username
	}
	if c.Password != nil {
		cfg.Password = *c.Password
	}
	if c.SecurityMode != nil {
		cfg.Extra["securityMode"] = string(*c.SecurityMode)
	}
	if c.SecurityPolicy != nil {
		cfg.Extra["securityPolicy"] = string(*c.SecurityPolicy)
	}
	if c.SlaveID != nil {
		cfg.Extra["slaveId"] = fmt.Sprintf("%d", *c.SlaveID)
	}
	if c.ClientID != nil {
		cfg.Extra["clientId"] = *c.ClientID
	}
	if c.BasePath != nil {
		cfg.Extra["basePath"] = *c.BasePath
	}
	if c.BearerToken != nil {
		cfg.Extra["bearerToken"] = *c.BearerToken
	}
	if c.Tags != nil {
		cfg.Extra["tags"] = *c.Tags
	}
	return cfg
}

// tagsForDatasource returns every binding path on any widget that targets dsID.
// Bindings are formatted "datasource_id:tag_path".
func tagsForDatasource(p *project.Project, dsID string) []string {
	prefix := dsID + ":"
	seen := map[string]bool{}
	var out []string
	for _, page := range p.Pages {
		for _, w := range page.Widgets {
			if w.Binding == nil {
				continue
			}
			b := *w.Binding
			if len(b) > len(prefix) && b[:len(prefix)] == prefix {
				path := b[len(prefix):]
				if !seen[path] {
					seen[path] = true
					out = append(out, path)
				}
			}
		}
	}
	return out
}
