// Package opcua implements ProtocolDriver for OPC UA via gopcua v0.5.x.
package opcua

import (
	"context"
	"fmt"
	"log"
	"sync"
	"sync/atomic"
	"time"

	"github.com/Speth12/x-hmi/internal/drivers"
	"github.com/Speth12/x-hmi/internal/drivers/cert"
	"github.com/Speth12/x-hmi/internal/tagstore"
	"github.com/gopcua/opcua"
	"github.com/gopcua/opcua/id"
	"github.com/gopcua/opcua/ua"
)

const (
	driverID    = "opcua"
	defaultCert = "opcua-cert.pem"
	defaultKey  = "opcua-key.pem"
	appURI      = "urn:x-hmi:runtime"
	browseDepth = 6
	subInterval = 500 * time.Millisecond
)

// Driver implements drivers.ProtocolDriver.
type Driver struct {
	mu       sync.Mutex
	client   *opcua.Client
	endpoint string
	connected atomic.Bool
	lastErr   atomic.Pointer[string]
	tagCount  atomic.Int32
}

// New returns an unconnected driver.
func New() *Driver { return &Driver{} }

// ID returns "opcua".
func (d *Driver) ID() string { return driverID }

// Connect dials the endpoint and selects the security policy.
//
// cfg.Endpoint:           opc.tcp://host:port
// cfg.Extra["securityMode"]:   None | Sign | SignAndEncrypt   (default Sign+Encrypt if available)
// cfg.Extra["securityPolicy"]: None | Basic128Rsa15 | Basic256 | Basic256Sha256
func (d *Driver) Connect(ctx context.Context, cfg drivers.DriverConfig) error {
	if cfg.Endpoint == "" {
		return fmt.Errorf("opcua: endpoint is required")
	}
	d.endpoint = cfg.Endpoint

	desiredMode := cfg.Extra["securityMode"]
	if desiredMode == "" {
		desiredMode = "SignAndEncrypt"
	}
	desiredPolicy := cfg.Extra["securityPolicy"]
	if desiredPolicy == "" {
		desiredPolicy = "Basic256Sha256"
	}

	log.Printf("[DRIVER] opcua: discovering endpoints at %s", cfg.Endpoint)
	eps, err := opcua.GetEndpoints(ctx, cfg.Endpoint)
	if err != nil {
		return d.fail(fmt.Errorf("GetEndpoints: %w", err))
	}

	ep := opcua.SelectEndpoint(eps, desiredPolicy, mapMode(desiredMode))
	if ep == nil {
		ep = opcua.SelectEndpoint(eps, "None", ua.MessageSecurityModeNone)
		if ep == nil {
			return d.fail(fmt.Errorf("no usable endpoint in %d offered", len(eps)))
		}
		log.Printf("[DRIVER] opcua: %s/%s not offered, falling back to None", desiredMode, desiredPolicy)
	}

	opts := []opcua.Option{
		opcua.SecurityFromEndpoint(ep, mapTokenType(cfg.Username)),
		opcua.AutoReconnect(true),
		opcua.ReconnectInterval(2 * time.Second),
	}
	if cfg.Username != "" {
		opts = append(opts, opcua.AuthUsername(cfg.Username, cfg.Password))
	} else {
		opts = append(opts, opcua.AuthAnonymous())
	}
	if ep.SecurityMode != ua.MessageSecurityModeNone {
		if err := cert.Ensure(defaultCert, defaultKey, appURI, "x-hmi runtime"); err != nil {
			return d.fail(fmt.Errorf("ensure cert: %w", err))
		}
		opts = append(opts,
			opcua.CertificateFile(defaultCert),
			opcua.PrivateKeyFile(defaultKey),
		)
	}

	c, err := opcua.NewClient(ep.EndpointURL, opts...)
	if err != nil {
		return d.fail(fmt.Errorf("NewClient: %w", err))
	}

	log.Printf("[DRIVER] opcua: connecting to %s mode=%v", ep.EndpointURL, ep.SecurityMode)
	if err = c.Connect(ctx); err != nil {
		return d.fail(fmt.Errorf("Connect: %w", err))
	}

	d.mu.Lock()
	d.client = c
	d.mu.Unlock()
	d.connected.Store(true)
	d.lastErr.Store(strPtr(""))
	log.Printf("[DRIVER] opcua: connected")
	return nil
}

// Disconnect cleanly closes the connection.
func (d *Driver) Disconnect() error {
	d.mu.Lock()
	c := d.client
	d.client = nil
	d.mu.Unlock()
	d.connected.Store(false)
	if c == nil {
		return nil
	}
	return c.Close(context.Background())
}

// Browse walks the address space starting at the Objects folder.
func (d *Driver) Browse(ctx context.Context) ([]drivers.TagDefinition, error) {
	c := d.getClient()
	if c == nil {
		return nil, fmt.Errorf("opcua: not connected")
	}
	var out []drivers.TagDefinition
	d.browseRecursive(ctx, c, ua.NewNumericNodeID(0, id.ObjectsFolder), 0, &out)
	d.tagCount.Store(int32(len(out)))
	return out, nil
}

func (d *Driver) browseRecursive(ctx context.Context, c *opcua.Client, nodeID *ua.NodeID, depth int, out *[]drivers.TagDefinition) {
	if depth > browseDepth {
		return
	}
	req := &ua.BrowseRequest{
		RequestedMaxReferencesPerNode: 200,
		NodesToBrowse: []*ua.BrowseDescription{{
			NodeID:          nodeID,
			BrowseDirection: ua.BrowseDirectionForward,
			ReferenceTypeID: ua.NewNumericNodeID(0, id.HierarchicalReferences),
			IncludeSubtypes: true,
			NodeClassMask:   uint32(ua.NodeClassAll),
			ResultMask:      uint32(ua.BrowseResultMaskAll),
		}},
	}
	res, err := c.Browse(ctx, req)
	if err != nil || len(res.Results) == 0 {
		return
	}
	for _, ref := range res.Results[0].References {
		nid := ref.NodeID.NodeID
		if ref.NodeClass == ua.NodeClassVariable {
			*out = append(*out, drivers.TagDefinition{
				Path:        nid.String(),
				DataType:    "", // could read DataType attribute, skipped for browse perf
				Description: ref.DisplayName.Text,
				Writable:    true,
			})
		} else {
			d.browseRecursive(ctx, c, nid, depth+1, out)
		}
	}
}

// Subscribe creates an OPC UA subscription for the given node IDs.
// Updates flow into ch as tagstore.TagUpdate values until ctx is cancelled.
func (d *Driver) Subscribe(ctx context.Context, paths []string, ch chan<- tagstore.TagUpdate) error {
	c := d.getClient()
	if c == nil {
		return fmt.Errorf("opcua: not connected")
	}
	if len(paths) == 0 {
		return fmt.Errorf("opcua: no paths to subscribe")
	}

	notifyCh := make(chan *opcua.PublishNotificationData, 256)
	sub, err := c.Subscribe(ctx, &opcua.SubscriptionParameters{
		Interval: subInterval,
	}, notifyCh)
	if err != nil {
		return fmt.Errorf("opcua: subscribe: %w", err)
	}

	pathsByHandle := make(map[uint32]string, len(paths))
	for i, p := range paths {
		nid, err := ua.ParseNodeID(p)
		if err != nil {
			log.Printf("[DRIVER] opcua: bad node id %q: %v", p, err)
			continue
		}
		handle := uint32(i + 1)
		req := &ua.MonitoredItemCreateRequest{
			ItemToMonitor: &ua.ReadValueID{
				NodeID:      nid,
				AttributeID: ua.AttributeIDValue,
			},
			MonitoringMode: ua.MonitoringModeReporting,
			RequestedParameters: &ua.MonitoringParameters{
				ClientHandle:     handle,
				SamplingInterval: float64(subInterval.Milliseconds()),
				QueueSize:        10,
				DiscardOldest:    true,
			},
		}
		res, err := sub.Monitor(ctx, ua.TimestampsToReturnBoth, req)
		if err != nil || res.Results[0].StatusCode != ua.StatusOK {
			log.Printf("[DRIVER] opcua: monitor %s: err=%v status=%v", p, err, statusOf(res))
			continue
		}
		pathsByHandle[handle] = p
		log.Printf("[DRIVER] opcua: subscribed %s", p)
	}

	go d.runSubscription(ctx, sub, notifyCh, pathsByHandle, ch)
	return nil
}

func (d *Driver) runSubscription(ctx context.Context, sub *opcua.Subscription, notifyCh <-chan *opcua.PublishNotificationData, pathsByHandle map[uint32]string, out chan<- tagstore.TagUpdate) {
	defer sub.Cancel(context.Background())
	for {
		select {
		case <-ctx.Done():
			return
		case notif, ok := <-notifyCh:
			if !ok {
				return
			}
			if notif.Error != nil {
				log.Printf("[DRIVER] opcua: notification error: %v", notif.Error)
				continue
			}
			dcn, ok := notif.Value.(*ua.DataChangeNotification)
			if !ok {
				continue
			}
			for _, item := range dcn.MonitoredItems {
				if item.Value == nil || item.Value.Value == nil {
					continue
				}
				path := pathsByHandle[item.ClientHandle]
				if path == "" {
					continue
				}
				select {
				case out <- tagstore.TagUpdate{
					Path: path,
					State: tagstore.TagState{
						Value:   item.Value.Value.Value(),
						Quality: qualityFromStatus(item.Value.Status),
						TS:      item.Value.SourceTimestamp.UnixNano(),
					},
				}:
				default:
					// pump is slow; drop rather than block the OPC UA reader
				}
			}
		}
	}
}

// Write writes value to the given OPC UA node.
func (d *Driver) Write(ctx context.Context, path string, value any) error {
	c := d.getClient()
	if c == nil {
		return fmt.Errorf("opcua: not connected")
	}
	nid, err := ua.ParseNodeID(path)
	if err != nil {
		return fmt.Errorf("opcua: bad node id %q: %w", path, err)
	}
	v, err := ua.NewVariant(value)
	if err != nil {
		return fmt.Errorf("opcua: variant: %w", err)
	}
	req := &ua.WriteRequest{
		NodesToWrite: []*ua.WriteValue{{
			NodeID:      nid,
			AttributeID: ua.AttributeIDValue,
			Value:       &ua.DataValue{EncodingMask: ua.DataValueValue, Value: v},
		}},
	}
	res, err := c.Write(ctx, req)
	if err != nil {
		return err
	}
	if len(res.Results) > 0 && res.Results[0] != ua.StatusOK {
		return fmt.Errorf("opcua: write status %v", res.Results[0])
	}
	return nil
}

// Status returns the current state.
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

func (d *Driver) getClient() *opcua.Client {
	d.mu.Lock()
	defer d.mu.Unlock()
	return d.client
}

func (d *Driver) fail(err error) error {
	d.connected.Store(false)
	s := err.Error()
	d.lastErr.Store(&s)
	return err
}

func mapMode(s string) ua.MessageSecurityMode {
	switch s {
	case "Sign":
		return ua.MessageSecurityModeSign
	case "SignAndEncrypt":
		return ua.MessageSecurityModeSignAndEncrypt
	default:
		return ua.MessageSecurityModeNone
	}
}

func mapTokenType(username string) ua.UserTokenType {
	if username != "" {
		return ua.UserTokenTypeUserName
	}
	return ua.UserTokenTypeAnonymous
}

func qualityFromStatus(s ua.StatusCode) string {
	switch {
	case s == ua.StatusOK:
		return "Good"
	case uint32(s)&0x80000000 != 0:
		return "Bad"
	default:
		return "Uncertain"
	}
}

func statusOf(res *ua.CreateMonitoredItemsResponse) ua.StatusCode {
	if res == nil || len(res.Results) == 0 {
		return 0
	}
	return res.Results[0].StatusCode
}

func strPtr(s string) *string { return &s }
