// Package rest implements ProtocolDriver for HTTP/JSON REST endpoints.
//
// Tag path format: <relative-url>[#<gjson-path>]
//
//	Arp.Plc.Eclr/MainInstance.iVar         GET <basePath>/Arp.Plc.Eclr/MainInstance.iVar, return whole body parsed as JSON
//	api/v1/sensors#temperature              GET <basePath>/api/v1/sensors, return body."temperature"
package rest

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/Speth12/x-hmi/internal/drivers"
	"github.com/Speth12/x-hmi/internal/tagstore"
	"github.com/tidwall/gjson"
)

const (
	driverID    = "rest"
	pollDefault = 1 * time.Second
)

// Driver implements drivers.ProtocolDriver.
type Driver struct {
	mu       sync.Mutex
	hc       *http.Client
	baseURL  string  // e.g. https://192.168.88.10
	basePath string  // e.g. /_pxc_api/api/v1.5/data/
	token    string
	pollEvery time.Duration
	stopCh   chan struct{}
	wg       sync.WaitGroup

	connected atomic.Bool
	lastErr   atomic.Pointer[string]
	tagCount  atomic.Int32
}

func New() *Driver { return &Driver{pollEvery: pollDefault} }

func (d *Driver) ID() string { return driverID }

// Connect verifies reachability of the base URL.
//
// cfg.Endpoint:               base URL (e.g. https://192.168.88.10)
// cfg.Extra["basePath"]:      path prefix appended before tag paths
// cfg.Extra["bearerToken"]:   optional Authorization: Bearer <token>
// cfg.Extra["insecure"]:      "true" to skip TLS verification (PLCnext self-signed)
func (d *Driver) Connect(ctx context.Context, cfg drivers.DriverConfig) error {
	if cfg.Endpoint == "" {
		return fmt.Errorf("rest: endpoint is required")
	}

	d.baseURL = strings.TrimRight(cfg.Endpoint, "/")
	d.basePath = cfg.Extra["basePath"]
	if d.basePath != "" && !strings.HasPrefix(d.basePath, "/") {
		d.basePath = "/" + d.basePath
	}
	d.basePath = strings.TrimRight(d.basePath, "/")
	d.token = cfg.Extra["bearerToken"]

	tr := http.DefaultTransport.(*http.Transport).Clone()
	if cfg.Extra["insecure"] == "true" {
		tr.TLSClientConfig = insecureTLSConfig()
	}
	d.hc = &http.Client{Timeout: 5 * time.Second, Transport: tr}

	d.mu.Lock()
	d.stopCh = make(chan struct{})
	d.mu.Unlock()
	d.connected.Store(true)
	d.lastErr.Store(strPtr(""))
	log.Printf("[DRIVER] rest: connected to %s%s", d.baseURL, d.basePath)
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

// Browse is not supported — REST has no generic discovery.
func (d *Driver) Browse(ctx context.Context) ([]drivers.TagDefinition, error) {
	return nil, nil
}

// Subscribe starts a polling goroutine that GETs each path every pollEvery.
func (d *Driver) Subscribe(ctx context.Context, paths []string, ch chan<- tagstore.TagUpdate) error {
	if len(paths) == 0 {
		return fmt.Errorf("rest: no paths to subscribe")
	}
	d.tagCount.Store(int32(len(paths)))

	d.mu.Lock()
	stop := d.stopCh
	d.mu.Unlock()
	if stop == nil {
		return fmt.Errorf("rest: not connected")
	}

	for _, p := range paths {
		log.Printf("[DRIVER] rest: subscribed %s", p)
	}

	d.wg.Add(1)
	go d.pollLoop(ctx, stop, paths, ch)
	return nil
}

func (d *Driver) pollLoop(ctx context.Context, stop <-chan struct{}, paths []string, out chan<- tagstore.TagUpdate) {
	defer d.wg.Done()
	tick := time.NewTicker(d.pollEvery)
	defer tick.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-stop:
			return
		case <-tick.C:
			for _, p := range paths {
				val, quality := d.readOne(ctx, p)
				select {
				case out <- tagstore.TagUpdate{
					Path: p,
					State: tagstore.TagState{
						Value:   val,
						Quality: quality,
						TS:      time.Now().UnixNano(),
					},
				}:
				default:
				}
			}
		}
	}
}

func (d *Driver) readOne(ctx context.Context, path string) (any, string) {
	urlPath, gjsonPath := splitPath(path)
	url := d.baseURL + d.basePath + "/" + strings.TrimLeft(urlPath, "/")

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, "Bad"
	}
	if d.token != "" {
		req.Header.Set("Authorization", "Bearer "+d.token)
	}
	req.Header.Set("Accept", "application/json")

	resp, err := d.hc.Do(req)
	if err != nil {
		return nil, "Bad"
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return nil, "Bad"
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "Bad"
	}
	if gjsonPath != "" {
		r := gjson.GetBytes(body, gjsonPath)
		if !r.Exists() {
			return nil, "Bad"
		}
		return r.Value(), "Good"
	}
	// no gjson path: try to extract a "value" field, else return parsed JSON
	if v := gjson.GetBytes(body, "value"); v.Exists() {
		return v.Value(), "Good"
	}
	var any any
	if err := json.Unmarshal(body, &any); err != nil {
		return string(body), "Good"
	}
	return any, "Good"
}

// Write PUTs a JSON-encoded {"value": value} to the tag's URL.
func (d *Driver) Write(ctx context.Context, path string, value any) error {
	urlPath, _ := splitPath(path)
	url := d.baseURL + d.basePath + "/" + strings.TrimLeft(urlPath, "/")
	body, err := json.Marshal(map[string]any{"value": value})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, url, strings.NewReader(string(body)))
	if err != nil {
		return err
	}
	if d.token != "" {
		req.Header.Set("Authorization", "Bearer "+d.token)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := d.hc.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return fmt.Errorf("rest: PUT %s status %d", url, resp.StatusCode)
	}
	return nil
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

func splitPath(p string) (urlPath, gjsonPath string) {
	if i := strings.Index(p, "#"); i >= 0 {
		return p[:i], p[i+1:]
	}
	return p, ""
}

func strPtr(s string) *string { return &s }
