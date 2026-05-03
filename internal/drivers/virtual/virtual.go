// Package virtual implements a computed-tag datasource.
//
// Each virtual tag has a path (name) and a formula string.
// Formula syntax:
//
//	{dsId:tagPath}           → current live value of a tag from another datasource
//	Arithmetic operators     → +  -  *  /  %
//	Math functions           → abs(), floor(), ceil(), round(), sqrt(), min(), max(), clamp(), pow()
//	Parentheses and literals → (expr), 3.14
//
// Example formula: "{opcua:Temp} * 9/5 + 32"
// Example formula: "clamp({mb:AI0} / 4095 * 100, 0, 100)"
//
// Configuration (in the project datasource config):
//
//	cfg.Extra["tags"] = JSON array of {path,formula} objects
//
// Connect() parses the tag list, then subscribes to all referenced upstream
// tags via the tagstore. When any upstream tag changes the affected formulae
// are re-evaluated and pushed to the output channel.
package virtual

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"sync"
	"sync/atomic"
	"time"

	"github.com/Speth12/x-hmi/internal/drivers"
	"github.com/Speth12/x-hmi/internal/tagstore"
)

const driverID = "virtual"

// TagSpec describes one computed tag.
type TagSpec struct {
	Path    string `json:"path"`
	Formula string `json:"formula"`
}

// Driver implements drivers.ProtocolDriver.
type Driver struct {
	mu       sync.RWMutex
	specs    []TagSpec
	vals     map[string]float64 // current upstream tag values keyed by "ds:path"
	store    *tagstore.TagStore // upstream tagstore for live reads
	outCh    chan<- tagstore.TagUpdate
	stopCh   chan struct{}
	wg       sync.WaitGroup
	tagCount atomic.Int32
	lastErr  atomic.Pointer[string]
	connected atomic.Bool
}

// New creates an unconnected virtual driver.
// The tagstore must be provided so the driver can read upstream values.
func New(store *tagstore.TagStore) *Driver {
	return &Driver{store: store}
}

func (d *Driver) ID() string { return driverID }

// Connect parses the tag list and subscribes to upstream tag changes.
//
// cfg.Extra["tags"] must be a JSON-encoded []TagSpec:
//
//	[{"path":"tempF","formula":"{opcua:Temp}*9/5+32"},...]
func (d *Driver) Connect(ctx context.Context, cfg drivers.DriverConfig) error {
	tagsJSON := cfg.Extra["tags"]
	if tagsJSON == "" {
		return fmt.Errorf("virtual: cfg.Extra['tags'] is required")
	}

	var specs []TagSpec
	if err := json.Unmarshal([]byte(tagsJSON), &specs); err != nil {
		return fmt.Errorf("virtual: invalid tags JSON: %w", err)
	}
	if len(specs) == 0 {
		return fmt.Errorf("virtual: at least one tag spec is required")
	}

	d.mu.Lock()
	d.specs = specs
	d.vals = make(map[string]float64)
	d.stopCh = make(chan struct{})
	d.mu.Unlock()

	d.tagCount.Store(int32(len(specs)))
	d.connected.Store(true)
	log.Printf("[DRIVER] virtual: connected with %d computed tags", len(specs))
	return nil
}

func (d *Driver) Disconnect() error {
	d.mu.Lock()
	if d.stopCh != nil {
		close(d.stopCh)
		d.stopCh = nil
	}
	d.mu.Unlock()
	d.wg.Wait()
	d.connected.Store(false)
	return nil
}

// Browse returns all configured computed tags.
func (d *Driver) Browse(_ context.Context) ([]drivers.TagDefinition, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()
	out := make([]drivers.TagDefinition, len(d.specs))
	for i, s := range d.specs {
		out[i] = drivers.TagDefinition{
			Path:        s.Path,
			Description: s.Formula,
			Writable:    false,
		}
	}
	return out, nil
}

// Subscribe starts the reactive evaluation loop.
// When any upstream tag referenced by a formula changes, all formulae that
// use it are re-evaluated and pushed to ch.
func (d *Driver) Subscribe(ctx context.Context, _ []string, ch chan<- tagstore.TagUpdate) error {
	d.mu.Lock()
	d.outCh = ch
	stopCh := d.stopCh
	d.mu.Unlock()

	// Build a map from upstream tag key → which specs reference it.
	d.mu.RLock()
	specs := d.specs
	d.mu.RUnlock()

	// refMap: upstream key → list of spec indices that use it.
	refMap := map[string][]int{}
	for i, s := range specs {
		for _, ref := range ParseRefs(s.Formula) {
			refMap[ref.Key] = append(refMap[ref.Key], i)
		}
	}

	// Push initial values for all specs.
	d.evaluateAll(specs, ch)

	// Poll upstream values at 1 Hz as a fallback, and also react reactively
	// via the tagstore subscription.
	// (The tagstore doesn't expose a pub/sub API externally, so we poll.)
	d.wg.Add(1)
	go func() {
		defer d.wg.Done()
		tick := time.NewTicker(200 * time.Millisecond)
		defer tick.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-stopCh:
				return
			case <-tick.C:
				if d.refreshUpstream(refMap) {
					d.evaluateAll(specs, ch)
				}
			}
		}
	}()

	return nil
}

// refreshUpstream reads all referenced tags from the store and returns true if
// any value changed.
func (d *Driver) refreshUpstream(refMap map[string][]int) bool {
	if d.store == nil {
		return false
	}
	d.mu.Lock()
	defer d.mu.Unlock()
	changed := false
	for key := range refMap {
		state, ok := d.store.Get(key)
		if !ok {
			continue
		}
		newVal := toFloat(state.Value)
		if d.vals[key] != newVal {
			d.vals[key] = newVal
			changed = true
		}
	}
	return changed
}

// evaluateAll computes all formulas and pushes their results to ch.
func (d *Driver) evaluateAll(specs []TagSpec, ch chan<- tagstore.TagUpdate) {
	d.mu.RLock()
	vals := make(map[string]float64, len(d.vals))
	for k, v := range d.vals {
		vals[k] = v
	}
	d.mu.RUnlock()

	now := time.Now().UnixNano()
	for _, s := range specs {
		result, err := Eval(s.Formula, vals)
		quality := "Good"
		if err != nil || math.IsNaN(result) || math.IsInf(result, 0) {
			quality = "Bad"
			result = 0
			if err != nil {
				errStr := err.Error()
				d.lastErr.Store(&errStr)
			}
		}
		select {
		case ch <- tagstore.TagUpdate{
			Path:  s.Path,
			State: tagstore.TagState{Value: result, Quality: quality, TS: now},
		}:
		default:
		}
	}
}

// Write is not supported for computed tags.
func (d *Driver) Write(_ context.Context, _ string, _ any) error {
	return fmt.Errorf("virtual: computed tags are read-only")
}

func (d *Driver) Status() drivers.DriverStatus {
	last := ""
	if p := d.lastErr.Load(); p != nil {
		last = *p
	}
	return drivers.DriverStatus{
		Connected: d.connected.Load(),
		LastError: last,
		TagCount:  int(d.tagCount.Load()),
	}
}

func toFloat(v any) float64 {
	switch x := v.(type) {
	case float64:
		return x
	case float32:
		return float64(x)
	case int:
		return float64(x)
	case int32:
		return float64(x)
	case int64:
		return float64(x)
	case bool:
		if x {
			return 1
		}
		return 0
	default:
		return 0
	}
}
