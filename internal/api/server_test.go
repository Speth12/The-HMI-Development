package api

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Speth12/x-hmi/internal/runtime"
	"github.com/Speth12/x-hmi/internal/tagstore"
	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
)

func newTestServer(t *testing.T) (*Server, *runtime.Runtime, *httptest.Server) {
	t.Helper()
	rt := runtime.New(nil, nil)
	rt.Start(context.Background())
	t.Cleanup(rt.Stop)
	srv := New(rt, nil)
	hs := httptest.NewServer(srv.Handler())
	t.Cleanup(hs.Close)
	return srv, rt, hs
}

func TestAlive(t *testing.T) {
	_, _, hs := newTestServer(t)
	resp, err := http.Get(hs.URL + "/api/v1/alive")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatalf("status: %d", resp.StatusCode)
	}
	var body map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&body)
	if body["ok"] != true {
		t.Errorf("body: %v", body)
	}
}

func TestPostProjectValidates(t *testing.T) {
	_, _, hs := newTestServer(t)
	bad := strings.NewReader(`{"version":"0.1.0"}`) // no pages
	resp, err := http.Post(hs.URL+"/api/v1/project", "application/json", bad)
	if err != nil {
		t.Fatalf("Post: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 400 {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

func TestPostProjectAccepts(t *testing.T) {
	_, _, hs := newTestServer(t)
	good := bytes.NewBufferString(`{
		"version":"0.1.0",
		"datasources":[],
		"pages":[{"id":"p1","name":"Main","widgets":[]}]
	}`)
	resp, err := http.Post(hs.URL+"/api/v1/project", "application/json", good)
	if err != nil {
		t.Fatalf("Post: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("status %d body=%s", resp.StatusCode, string(body))
	}

	resp2, _ := http.Get(hs.URL + "/api/v1/project")
	defer resp2.Body.Close()
	var p map[string]any
	_ = json.NewDecoder(resp2.Body).Decode(&p)
	if p["version"] != "0.1.0" {
		t.Errorf("project not stored: %v", p)
	}
}

func TestReadTag(t *testing.T) {
	_, rt, hs := newTestServer(t)
	rt.Store.Update("test.tag", tagstore.TagState{Value: 42, Quality: "Good", TS: time.Now().UnixNano()})
	resp, err := http.Get(hs.URL + "/api/v1/tag/test.tag")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatalf("status: %d", resp.StatusCode)
	}
	var st map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&st)
	if st["Value"].(float64) != 42 {
		t.Errorf("value: %v", st)
	}
}

func TestReadUnknownTag(t *testing.T) {
	_, _, hs := newTestServer(t)
	resp, err := http.Get(hs.URL + "/api/v1/tag/missing.tag")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 404 {
		t.Errorf("expected 404, got %d", resp.StatusCode)
	}
}

func TestWebSocketSubscribe(t *testing.T) {
	_, rt, hs := newTestServer(t)
	wsURL := strings.Replace(hs.URL, "http://", "ws://", 1) + "/ws/tags"

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	conn, _, err := websocket.Dial(ctx, wsURL, nil)
	if err != nil {
		t.Fatalf("Dial: %v", err)
	}
	defer conn.Close(websocket.StatusNormalClosure, "")

	// subscribe
	if err := wsjson.Write(ctx, conn, map[string][]string{"subscribe": {"sensor.live"}}); err != nil {
		t.Fatalf("Write: %v", err)
	}

	// give subscription a chance to land
	time.Sleep(50 * time.Millisecond)

	// push an update
	rt.Store.Update("sensor.live", tagstore.TagState{Value: 7.5, Quality: "Good", TS: time.Now().UnixNano()})

	var got map[string]any
	if err := wsjson.Read(ctx, conn, &got); err != nil {
		t.Fatalf("Read: %v", err)
	}
	if got["path"] != "sensor.live" {
		t.Errorf("path: %v", got)
	}
	if got["value"].(float64) != 7.5 {
		t.Errorf("value: %v", got)
	}
}
