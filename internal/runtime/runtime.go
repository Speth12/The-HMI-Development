// Package runtime is the central orchestrator: drivers → TagStore → Historian + WS broadcast.
package runtime

import (
	"context"
	"fmt"
	"log"
	"sync"

	"github.com/Speth12/x-hmi/internal/drivers"
	"github.com/Speth12/x-hmi/internal/drivers/modbus"
	"github.com/Speth12/x-hmi/internal/drivers/mqtt"
	"github.com/Speth12/x-hmi/internal/drivers/opcua"
	"github.com/Speth12/x-hmi/internal/drivers/rest"
	"github.com/Speth12/x-hmi/internal/historian"
	"github.com/Speth12/x-hmi/internal/project"
	"github.com/Speth12/x-hmi/internal/tagstore"
)

// Runtime owns the TagStore, Historian, and active driver instances.
type Runtime struct {
	Store     *tagstore.TagStore
	Historian *historian.Historian

	mu      sync.RWMutex
	drivers map[string]drivers.ProtocolDriver // datasource id → driver
	cancel  context.CancelFunc
	pumpCh  chan tagstore.TagUpdate
	wg      sync.WaitGroup
	project *project.Project
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
		drivers:   make(map[string]drivers.ProtocolDriver),
		pumpCh:    make(chan tagstore.TagUpdate, 1024),
	}
}

// Start begins the central pump goroutine. Call once.
func (r *Runtime) Start(ctx context.Context) {
	pumpCtx, cancel := context.WithCancel(ctx)
	r.cancel = cancel
	r.wg.Add(1)
	go r.pump(pumpCtx)
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

	// connect new ones
	for _, ds := range p.Datasources {
		if r.has(ds.ID) {
			continue
		}
		drv, err := buildDriver(ds.Type)
		if err != nil {
			log.Printf("[RUNTIME] %s: %v — skipped", ds.ID, err)
			continue
		}
		cfg := buildConfig(ds)
		if err := drv.Connect(ctx, cfg); err != nil {
			log.Printf("[RUNTIME] %s: connect failed: %v", ds.ID, err)
			continue
		}
		r.mu.Lock()
		r.drivers[ds.ID] = drv
		r.mu.Unlock()
		log.Printf("[RUNTIME] connected %s (%s)", ds.ID, ds.Type)

		// auto-subscribe to every tag bound by any widget on any page
		paths := tagsForDatasource(p, ds.ID)
		if len(paths) > 0 {
			if err := drv.Subscribe(ctx, paths, r.pumpCh); err != nil {
				log.Printf("[RUNTIME] %s: subscribe failed: %v", ds.ID, err)
			}
		}
	}
	return nil
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

// pump reads from drivers, writes to TagStore + Historian.
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
		}
	}
}

// PumpChan returns the channel drivers push into. Exposed for runtime tests.
func (r *Runtime) PumpChan() chan<- tagstore.TagUpdate { return r.pumpCh }

func buildDriver(typ project.DatasourceType) (drivers.ProtocolDriver, error) {
	switch typ {
	case project.DatasourceTypeOPCUA:
		return opcua.New(), nil
	case project.DatasourceTypeMQTT:
		return mqtt.New(), nil
	case project.DatasourceTypeModbus:
		return modbus.New(), nil
	case project.DatasourceTypeREST:
		return rest.New(), nil
	}
	return nil, fmt.Errorf("unknown datasource type %q", typ)
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
