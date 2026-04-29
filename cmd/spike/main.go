// OPC UA spike — Day 1 gating test for github.com/Speth12/x-hmi
//
// Connects to the AXC F 3152 with SignAndEncrypt + Basic256Sha256,
// subscribes to 5 tags, prints values for 60 s, then disconnects.
//
// Pass criteria: ≥5 values received per tag in 60 s, clean disconnect.
//
// Usage:
//
//	go run ./cmd/spike
//
// Override tags via env: SPIKE_TAGS="ns=2;s=A,ns=2;s=B,..."
package main

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"fmt"
	"log"
	"math/big"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/gopcua/opcua"
	"github.com/gopcua/opcua/ua"
)

const (
	endpoint       = "opc.tcp://192.168.88.10:4840"
	spikeDuration  = 60 * time.Second
	subInterval    = 500 * time.Millisecond
	certFile       = "spike-cert.pem"
	keyFile        = "spike-key.pem"
	appURI         = "urn:x-hmi:spike"
)

// defaultTags — update these to match tags visible in your PLCnext tag browser.
// The roadmap mentions ns=2;s=PLCnext.iTest as a known tag from the toolsuite.
var defaultTags = []string{
	"ns=2;s=PLCnext.iTest",
	"ns=2;s=PLCnext.iTest2",
	"ns=2;s=PLCnext.MainInstance.iTest",
	"ns=2;s=PLCnext.Arp.Plc.Eclr/MainInstance.bTest",
	"ns=2;s=PLCnext.Arp.Plc.Eclr/MainInstance.rTest",
}

func main() {
	log.SetFlags(log.Ltime | log.Lmicroseconds)

	tags := defaultTags
	if env := os.Getenv("SPIKE_TAGS"); env != "" {
		tags = strings.Split(env, ",")
	}

	log.Println("[SPIKE] X-HMI OPC UA spike — Day 1 gating test")
	log.Printf("[SPIKE] Endpoint: %s", endpoint)
	log.Printf("[SPIKE] Security: SignAndEncrypt / Basic256Sha256")
	log.Printf("[SPIKE] Tags: %v", tags)
	log.Printf("[SPIKE] Duration: %s", spikeDuration)

	// generate or load client certificate (required for SignAndEncrypt)
	if err := ensureCert(); err != nil {
		log.Fatalf("[SPIKE] cert: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), spikeDuration+10*time.Second)
	defer cancel()

	// discover endpoints and select the right security policy
	log.Println("[SPIKE] Discovering endpoints...")
	eps, err := opcua.GetEndpoints(ctx, endpoint)
	if err != nil {
		log.Fatalf("[SPIKE] GetEndpoints: %v\n[SPIKE] FAIL — check network path to 192.168.88.10:4840", err)
	}
	log.Printf("[SPIKE] Found %d endpoints", len(eps))
	for _, ep := range eps {
		log.Printf("[SPIKE]   %s  mode=%v", ep.SecurityPolicyURI, ep.SecurityMode)
	}

	ep := opcua.SelectEndpoint(eps, "Basic256Sha256", ua.MessageSecurityModeSignAndEncrypt)
	if ep == nil {
		log.Fatalf("[SPIKE] FAIL — no SignAndEncrypt/Basic256Sha256 endpoint found.\n" +
			"[SPIKE] Available policies listed above. Check PLCnext OPC UA server security settings.")
	}
	log.Printf("[SPIKE] Selected endpoint: %s", ep.EndpointURL)

	c, err := opcua.NewClient(ep.EndpointURL,
		opcua.SecurityFromEndpoint(ep, ua.UserTokenTypeAnonymous),
		opcua.CertificateFile(certFile),
		opcua.PrivateKeyFile(keyFile),
		opcua.AutoReconnect(true),
		opcua.ReconnectInterval(2*time.Second),
	)
	if err != nil {
		log.Fatalf("[SPIKE] NewClient: %v", err)
	}

	log.Println("[DRIVER] Connecting...")
	if err = c.Connect(ctx); err != nil {
		log.Fatalf("[DRIVER] Connect: %v\n[SPIKE] FAIL — gopcua cannot connect with SignAndEncrypt. Consider Node.js escape hatch.", err)
	}
	defer c.CloseWithContext(ctx)
	log.Println("[DRIVER] Connected")

	// subscription
	notifyCh := make(chan *opcua.PublishNotificationData, 128)
	sub, err := c.Subscribe(ctx, &opcua.SubscriptionParameters{
		Interval: subInterval,
	}, notifyCh)
	if err != nil {
		log.Fatalf("[SPIKE] Subscribe: %v", err)
	}
	defer sub.Cancel(ctx)

	// monitored items — one per tag
	counts := make(map[string]int, len(tags))
	for _, tagID := range tags {
		nodeID, err := ua.ParseNodeID(tagID)
		if err != nil {
			log.Printf("[SPIKE] ParseNodeID %q: %v — skipping", tagID, err)
			continue
		}
		req := &ua.MonitoredItemCreateRequest{
			ItemToMonitor: &ua.ReadValueID{
				NodeID:      nodeID,
				AttributeID: ua.AttributeIDValue,
			},
			MonitoringMode: ua.MonitoringModeReporting,
			RequestedParameters: &ua.MonitoringParameters{
				SamplingInterval: float64(subInterval.Milliseconds()),
				QueueSize:        10,
				DiscardOldest:    true,
			},
		}
		res, err := sub.Monitor(ua.TimestampsToReturnBoth, req)
		if err != nil || res.Results[0].StatusCode != ua.StatusOK {
			log.Printf("[SPIKE] Monitor %q: err=%v status=%v — tag may not exist on this PLC", tagID, err, res.Results[0].StatusCode)
			continue
		}
		counts[tagID] = 0
		log.Printf("[TAG] Subscribed: %s", tagID)
	}

	if len(counts) == 0 {
		log.Fatalf("[SPIKE] FAIL — no tags could be subscribed. Check tag paths for this PLC.")
	}

	go sub.Run(ctx)

	log.Printf("[SPIKE] Receiving for %s — press Ctrl-C to stop early", spikeDuration)
	deadline := time.After(spikeDuration)

loop:
	for {
		select {
		case <-deadline:
			break loop
		case <-ctx.Done():
			break loop
		case notif, ok := <-notifyCh:
			if !ok {
				break loop
			}
			if notif.Error != nil {
				log.Printf("[SPIKE] notification error: %v", notif.Error)
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
				tagID := tagFromHandle(tags, item.ClientHandle)
				counts[tagID]++
				fmt.Printf("[TAG] %s  value=%-12v  quality=%v  ts=%s\n",
					tagID,
					item.Value.Value.Value(),
					item.Value.StatusCode,
					item.Value.SourceTimestamp.Format(time.RFC3339Nano),
				)
			}
		}
	}

	// result
	log.Println("\n[SPIKE] === Results ===")
	pass := true
	for _, tagID := range tags {
		n := counts[tagID]
		status := "PASS"
		if n < 5 {
			status = "FAIL"
			pass = false
		}
		log.Printf("[SPIKE]   %-60s  %d values  %s", tagID, n, status)
	}

	if pass {
		log.Println("[SPIKE] PASS — gopcua + AXC F 3152 SignAndEncrypt working. Continue with pure Go plan.")
	} else {
		log.Println("[SPIKE] FAIL — fewer than 5 values on some tags. Activate Node.js escape hatch.")
		os.Exit(1)
	}
}

// ensureCert generates a self-signed cert/key pair if not already on disk.
// OPC UA SignAndEncrypt requires a client certificate with the appURI as SAN.
func ensureCert() error {
	if fileExists(certFile) && fileExists(keyFile) {
		log.Printf("[SPIKE] Using existing cert: %s / %s", certFile, keyFile)
		return nil
	}
	log.Println("[SPIKE] Generating self-signed client certificate...")

	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return fmt.Errorf("rsa.GenerateKey: %w", err)
	}

	appURL, err := url.Parse(appURI)
	if err != nil {
		return fmt.Errorf("url.Parse appURI: %w", err)
	}

	tmpl := &x509.Certificate{
		SerialNumber: big.NewInt(time.Now().Unix()),
		Subject: pkix.Name{
			CommonName:   "x-hmi spike",
			Organization: []string{"x-hmi"},
		},
		NotBefore: time.Now().Add(-time.Hour),
		NotAfter:  time.Now().Add(365 * 24 * time.Hour),
		KeyUsage: x509.KeyUsageDigitalSignature |
			x509.KeyUsageContentCommitment |
			x509.KeyUsageKeyEncipherment |
			x509.KeyUsageDataEncipherment,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth},
		BasicConstraintsValid: true,
		URIs:                  []*url.URL{appURL},
	}

	certDER, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	if err != nil {
		return fmt.Errorf("CreateCertificate: %w", err)
	}

	certOut, err := os.Create(certFile)
	if err != nil {
		return err
	}
	defer certOut.Close()
	if err = pem.Encode(certOut, &pem.Block{Type: "CERTIFICATE", Bytes: certDER}); err != nil {
		return err
	}

	keyOut, err := os.Create(keyFile)
	if err != nil {
		return err
	}
	defer keyOut.Close()
	if err = pem.Encode(keyOut, &pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)}); err != nil {
		return err
	}

	log.Printf("[SPIKE] Cert written to %s / %s", certFile, keyFile)
	log.Println("[SPIKE] IMPORTANT: you may need to trust this cert on the AXC F 3152 before connecting.")
	log.Println("[SPIKE]            Use PLCnext Engineer → Security → Certificate Store, or:")
	log.Println("[SPIKE]            ssh admin@192.168.88.10 to accept the cert via the OPC UA server.")
	return nil
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

// tagFromHandle maps a MonitoredItem ClientHandle back to a tag ID.
// Handles are assigned in subscription order (1-based).
func tagFromHandle(tags []string, handle uint32) string {
	if handle == 0 || int(handle) > len(tags) {
		return fmt.Sprintf("handle=%d", handle)
	}
	return tags[handle-1]
}
