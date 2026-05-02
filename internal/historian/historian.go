// Package historian persists tag updates to SQLite (modernc.org/sqlite, pure Go, no CGO).
//
// Schema:
//
//	CREATE TABLE history (path TEXT, ts INTEGER, value TEXT, quality TEXT);
//	CREATE INDEX history_path_ts ON history(path, ts);
//
// Each tag is capped at maxSamplesPerTag rows (default 10000) — older samples
// are deleted in the background trim loop.
package historian

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/Speth12/x-hmi/internal/tagstore"
	_ "modernc.org/sqlite"
)

const (
	defaultMaxSamples = 10000
	trimInterval      = 30 * time.Second
)

// Sample is a row from the history table.
type Sample struct {
	TS      int64  `json:"ts"`
	Value   any    `json:"value"`
	Quality string `json:"quality"`
}

// Historian persists tag updates and serves time-range queries.
type Historian struct {
	db          *sql.DB
	maxSamples  int
	mu          sync.Mutex
	stop        chan struct{}
	wg          sync.WaitGroup
	insertStmt  *sql.Stmt
}

// Open initialises a SQLite database at path (use ":memory:" for tests).
func Open(path string) (*Historian, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1) // sqlite + WAL — single writer
	pragmas := []string{
		"PRAGMA journal_mode=WAL",
		"PRAGMA synchronous=NORMAL",
		"PRAGMA temp_store=MEMORY",
	}
	for _, p := range pragmas {
		if _, err := db.Exec(p); err != nil {
			return nil, fmt.Errorf("pragma %s: %w", p, err)
		}
	}
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS history (
		path TEXT NOT NULL,
		ts   INTEGER NOT NULL,
		value TEXT NOT NULL,
		quality TEXT NOT NULL
	)`); err != nil {
		return nil, fmt.Errorf("create table: %w", err)
	}
	if _, err := db.Exec(`CREATE INDEX IF NOT EXISTS history_path_ts ON history(path, ts)`); err != nil {
		return nil, err
	}
	stmt, err := db.Prepare(`INSERT INTO history (path, ts, value, quality) VALUES (?, ?, ?, ?)`)
	if err != nil {
		return nil, err
	}
	h := &Historian{
		db:         db,
		maxSamples: defaultMaxSamples,
		stop:       make(chan struct{}),
		insertStmt: stmt,
	}
	h.wg.Add(1)
	go h.trimLoop()
	return h, nil
}

// SetMaxSamples sets the per-tag retention cap.
func (h *Historian) SetMaxSamples(n int) { h.maxSamples = n }

// Record stores one tag update.
func (h *Historian) Record(u tagstore.TagUpdate) error {
	val, err := json.Marshal(u.State.Value)
	if err != nil {
		val = []byte(fmt.Sprintf("%q", fmt.Sprint(u.State.Value)))
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	_, err = h.insertStmt.Exec(u.Path, u.State.TS, string(val), u.State.Quality)
	return err
}

// RecordWrite stores a manually-written value with quality "Write" for audit purposes.
func (h *Historian) RecordWrite(path string, value any) error {
	val, err := json.Marshal(value)
	if err != nil {
		val = []byte(fmt.Sprintf("%q", fmt.Sprint(value)))
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	_, err = h.insertStmt.Exec(path, time.Now().UnixNano(), string(val), "Write")
	return err
}

// Query returns samples for path within [from, to] (Unix nanos), oldest first.
// limit caps the number of returned samples (0 = no limit).
func (h *Historian) Query(ctx context.Context, path string, from, to int64, limit int) ([]Sample, error) {
	q := `SELECT ts, value, quality FROM history
	      WHERE path = ? AND ts BETWEEN ? AND ?
	      ORDER BY ts ASC`
	args := []any{path, from, to}
	if limit > 0 {
		q += " LIMIT ?"
		args = append(args, limit)
	}
	rows, err := h.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Sample
	for rows.Next() {
		var s Sample
		var raw string
		if err := rows.Scan(&s.TS, &raw, &s.Quality); err != nil {
			return nil, err
		}
		_ = json.Unmarshal([]byte(raw), &s.Value)
		out = append(out, s)
	}
	return out, rows.Err()
}

// Close flushes and shuts down.
func (h *Historian) Close() error {
	close(h.stop)
	h.wg.Wait()
	if h.insertStmt != nil {
		_ = h.insertStmt.Close()
	}
	return h.db.Close()
}

func (h *Historian) trimLoop() {
	defer h.wg.Done()
	tick := time.NewTicker(trimInterval)
	defer tick.Stop()
	for {
		select {
		case <-h.stop:
			return
		case <-tick.C:
			_ = h.trim()
		}
	}
}

// trim deletes old rows for any tag exceeding maxSamples.
func (h *Historian) trim() error {
	h.mu.Lock()
	defer h.mu.Unlock()
	_, err := h.db.Exec(`
		DELETE FROM history
		WHERE rowid IN (
			SELECT rowid FROM (
				SELECT rowid, ROW_NUMBER() OVER (PARTITION BY path ORDER BY ts DESC) AS rn
				FROM history
			) WHERE rn > ?
		)`, h.maxSamples)
	return err
}
