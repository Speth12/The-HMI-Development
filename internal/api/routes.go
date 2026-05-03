package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/Speth12/x-hmi/internal/project"
	"github.com/go-chi/chi/v5"
)

func (s *Server) handleTestDatasource(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()
	var ds project.DatasourceElement
	if err := json.NewDecoder(r.Body).Decode(&ds); err != nil {
		writeErr(w, 400, "invalid json: "+err.Error())
		return
	}
	if ds.Type == "" {
		writeErr(w, 400, "type is required")
		return
	}
	st := s.rt.TestDatasource(r.Context(), ds)
	writeJSON(w, 200, st)
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]any{"error": msg})
}

func (s *Server) handleAlive(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]any{"ok": true})
}

func (s *Server) handleGetProject(w http.ResponseWriter, r *http.Request) {
	p := s.rt.Project()
	if p == nil {
		writeJSON(w, 200, nil)
		return
	}
	writeJSON(w, 200, p)
}

func (s *Server) handlePostProject(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()
	var raw json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
		writeErr(w, 400, "invalid json: "+err.Error())
		return
	}
	p, err := project.Parse(raw)
	if err != nil {
		writeErr(w, 400, err.Error())
		return
	}
	if err := s.rt.LoadProject(r.Context(), p); err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true, "datasources": len(p.Datasources), "pages": len(p.Pages)})
}

func (s *Server) handleListDatasources(w http.ResponseWriter, r *http.Request) {
	type entry struct {
		ID        string `json:"id"`
		Connected bool   `json:"connected"`
		LastError string `json:"lastError,omitempty"`
		TagCount  int    `json:"tagCount"`
	}
	out := []entry{}
	for id, d := range s.rt.Drivers() {
		st := d.Status()
		out = append(out, entry{ID: id, Connected: st.Connected, LastError: st.LastError, TagCount: st.TagCount})
	}
	writeJSON(w, 200, out)
}

func (s *Server) handleDatasourceStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	d := s.rt.Driver(id)
	if d == nil {
		writeErr(w, 404, "datasource not found")
		return
	}
	writeJSON(w, 200, d.Status())
}

func (s *Server) handleBrowseDatasource(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	d := s.rt.Driver(id)
	if d == nil {
		writeErr(w, 404, "datasource not found")
		return
	}
	defs, err := d.Browse(r.Context())
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, defs)
}

func tagPathFromRequest(r *http.Request) string {
	// Use RawPath when available so %2F in the tag path isn't split by the router.
	raw := r.URL.RawPath
	if raw == "" {
		raw = r.URL.Path
	}
	idx := strings.Index(raw, "/tag/")
	if idx < 0 {
		return chi.URLParam(r, "*")
	}
	decoded, err := url.PathUnescape(raw[idx+5:])
	if err != nil {
		return chi.URLParam(r, "*")
	}
	return decoded
}

func (s *Server) handleReadTag(w http.ResponseWriter, r *http.Request) {
	path := tagPathFromRequest(r)
	state, ok := s.rt.Store.Get(path)
	if !ok {
		writeErr(w, 404, "tag not found")
		return
	}
	writeJSON(w, 200, state)
}

func (s *Server) handleWriteTag(w http.ResponseWriter, r *http.Request) {
	path := tagPathFromRequest(r)
	defer r.Body.Close()
	var body struct {
		Datasource string `json:"datasource"`
		Value      any    `json:"value"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, 400, "invalid json")
		return
	}
	if body.Datasource == "" {
		writeErr(w, 400, "datasource is required")
		return
	}
	d := s.rt.Driver(body.Datasource)
	if d == nil {
		writeErr(w, 404, "datasource not found")
		return
	}
	if err := d.Write(r.Context(), path, body.Value); err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	// Audit: record the write to history so operators can see who changed what.
	if s.rt.Historian != nil {
		fullPath := body.Datasource + ":" + path
		_ = s.rt.Historian.RecordWrite(fullPath, body.Value)
	}
	writeJSON(w, 200, map[string]any{"ok": true})
}

func (s *Server) handleHistory(w http.ResponseWriter, r *http.Request) {
	if s.rt.Historian == nil {
		writeErr(w, 503, "historian not configured")
		return
	}
	q := r.URL.Query()
	path := q.Get("path")
	if path == "" {
		writeErr(w, 400, "path is required")
		return
	}
	from := parseInt64(q.Get("from"), 0)
	to := parseInt64(q.Get("to"), time.Now().UnixNano())
	limit := int(parseInt64(q.Get("limit"), 1000))

	samples, err := s.rt.Historian.Query(r.Context(), path, from, to, limit)
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}

	// If the client accepts CSV or format=csv is requested, return CSV.
	accept := r.Header.Get("Accept")
	if q.Get("format") == "csv" || strings.Contains(accept, "text/csv") {
		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", `attachment; filename="history.csv"`)
		w.WriteHeader(200)
		fmt.Fprintf(w, "timestamp,value,quality\n")
		for _, smpl := range samples {
			// TS is stored as nanoseconds since epoch.
			t := time.Unix(0, smpl.TS)
			fmt.Fprintf(w, "%s,%v,%s\n", t.UTC().Format(time.RFC3339Nano), smpl.Value, smpl.Quality)
		}
		return
	}

	writeJSON(w, 200, samples)
}

func parseInt64(s string, def int64) int64 {
	if s == "" {
		return def
	}
	n, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return def
	}
	return n
}

// ── Alarms ─────────────────────────────────────────────────────────────────

func (s *Server) handleListAlarms(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, s.rt.Alarms.Events())
}

func (s *Server) handleAckAlarm(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if !s.rt.Alarms.Acknowledge(id) {
		writeErr(w, 404, "event not found")
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true})
}

// ── Recipes ────────────────────────────────────────────────────────────────

func (s *Server) handleListRecipes(w http.ResponseWriter, r *http.Request) {
	p := s.rt.Project()
	if p == nil || len(p.Recipes) == 0 {
		writeJSON(w, 200, []struct{}{})
		return
	}
	writeJSON(w, 200, p.Recipes)
}

func (s *Server) handleApplyRecipe(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	p := s.rt.Project()
	if p == nil {
		writeErr(w, 503, "no project loaded")
		return
	}

	var recipe *struct {
		ID      string
		Entries []struct {
			Binding string `json:"binding"`
			Value   any    `json:"value"`
		}
	}
	for _, rec := range p.Recipes {
		if rec.ID == id {
			recipe = &struct {
				ID      string
				Entries []struct {
					Binding string `json:"binding"`
					Value   any    `json:"value"`
				}
			}{ID: rec.ID}
			for _, e := range rec.Entries {
				recipe.Entries = append(recipe.Entries, struct {
					Binding string `json:"binding"`
					Value   any    `json:"value"`
				}{Binding: e.Binding, Value: e.Value})
			}
			break
		}
	}
	if recipe == nil {
		writeErr(w, 404, "recipe not found")
		return
	}

	var errs []string
	for _, entry := range recipe.Entries {
		sep := strings.Index(entry.Binding, ":")
		if sep < 0 {
			errs = append(errs, "bad binding: "+entry.Binding)
			continue
		}
		dsID := entry.Binding[:sep]
		tagPath := entry.Binding[sep+1:]
		d := s.rt.Driver(dsID)
		if d == nil {
			errs = append(errs, "driver not found: "+dsID)
			continue
		}
		if err := d.Write(r.Context(), tagPath, entry.Value); err != nil {
			errs = append(errs, entry.Binding+": "+err.Error())
			continue
		}
		if s.rt.Historian != nil {
			_ = s.rt.Historian.RecordWrite(entry.Binding, entry.Value)
		}
	}

	if len(errs) > 0 {
		writeJSON(w, 207, map[string]any{"ok": false, "errors": errs, "applied": len(recipe.Entries) - len(errs)})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true, "applied": len(recipe.Entries)})
}
