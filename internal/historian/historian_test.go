package historian

import (
	"context"
	"testing"
	"time"

	"github.com/Speth12/x-hmi/internal/tagstore"
)

func newTestHistorian(t *testing.T) *Historian {
	t.Helper()
	h, err := Open("file::memory:?cache=shared")
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(func() { _ = h.Close() })
	return h
}

func TestRecordAndQuery(t *testing.T) {
	h := newTestHistorian(t)
	now := time.Now().UnixNano()
	for i := range 5 {
		err := h.Record(tagstore.TagUpdate{
			Path: "sensor.temp",
			State: tagstore.TagState{
				Value:   float64(i) + 0.5,
				Quality: "Good",
				TS:      now + int64(i)*1_000_000,
			},
		})
		if err != nil {
			t.Fatalf("Record: %v", err)
		}
	}
	samples, err := h.Query(context.Background(), "sensor.temp", 0, now+10_000_000, 100)
	if err != nil {
		t.Fatalf("Query: %v", err)
	}
	if len(samples) != 5 {
		t.Fatalf("got %d samples want 5", len(samples))
	}
	if samples[0].Value.(float64) != 0.5 {
		t.Errorf("first sample: got %v want 0.5", samples[0].Value)
	}
	if samples[4].Quality != "Good" {
		t.Errorf("quality: got %q", samples[4].Quality)
	}
}

func TestQueryRangeFilter(t *testing.T) {
	h := newTestHistorian(t)
	now := time.Now().UnixNano()
	for i := range 10 {
		_ = h.Record(tagstore.TagUpdate{
			Path: "x",
			State: tagstore.TagState{
				Value: i,
				TS:    now + int64(i)*1_000_000_000,
			},
		})
	}
	samples, err := h.Query(context.Background(), "x", now+3_000_000_000, now+6_000_000_000, 0)
	if err != nil {
		t.Fatalf("Query: %v", err)
	}
	if len(samples) != 4 {
		t.Errorf("range filter: got %d want 4", len(samples))
	}
}

func TestTrimRetention(t *testing.T) {
	h := newTestHistorian(t)
	h.SetMaxSamples(50)
	now := time.Now().UnixNano()
	for i := range 200 {
		_ = h.Record(tagstore.TagUpdate{
			Path:  "noise",
			State: tagstore.TagState{Value: i, TS: now + int64(i)},
		})
	}
	if err := h.trim(); err != nil {
		t.Fatalf("trim: %v", err)
	}
	samples, err := h.Query(context.Background(), "noise", 0, now+1_000_000_000, 0)
	if err != nil {
		t.Fatalf("Query: %v", err)
	}
	if len(samples) != 50 {
		t.Errorf("after trim: got %d want 50", len(samples))
	}
	// trim keeps the newest, so the last sample value should be 199
	if samples[len(samples)-1].Value.(float64) != 199 {
		t.Errorf("trim kept wrong samples: last=%v", samples[len(samples)-1].Value)
	}
}

func TestQueryUnknownPath(t *testing.T) {
	h := newTestHistorian(t)
	got, err := h.Query(context.Background(), "missing", 0, time.Now().UnixNano(), 0)
	if err != nil {
		t.Fatalf("Query: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("expected 0, got %d", len(got))
	}
}
