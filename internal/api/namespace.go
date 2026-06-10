package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/Speth12/x-hmi/internal/namespace"
)

// GET /api/v1/namespace — list all nodes (flat)
func (s *Server) handleNSList(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, s.rt.Namespace.All())
}

// GET /api/v1/namespace/tree?path=Plant1.Line1 — children of a path
func (s *Server) handleNSChildren(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	children, err := s.rt.Namespace.GetChildren(path)
	if err != nil {
		writeErr(w, 404, err.Error())
		return
	}
	writeJSON(w, 200, children)
}

// GET /api/v1/namespace/search?q=tank&type=tag
func (s *Server) handleNSSearch(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	typ := namespace.NodeType(r.URL.Query().Get("type"))
	results := s.rt.Namespace.Search(q, typ)
	writeJSON(w, 200, results)
}

// POST /api/v1/namespace — create a node
// Body: {"path":"Plant1.Line1.Tank101.Level","type":"tag","dataType":"float","unit":"m","driverId":"opc1","driverAddr":"ns=2;s=Level"}
func (s *Server) handleNSCreate(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()
	var body struct {
		Path        string            `json:"path"`
		Type        namespace.NodeType `json:"type"`
		DataType    string            `json:"dataType"`
		Description string            `json:"description"`
		Unit        string            `json:"unit"`
		DriverID    string            `json:"driverId"`
		DriverAddr  string            `json:"driverAddr"`
		Expression  string            `json:"expression"`
		Meta        map[string]string `json:"meta"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, 400, "invalid json: "+err.Error())
		return
	}
	if body.Path == "" {
		writeErr(w, 400, "path is required")
		return
	}
	if body.Type == "" {
		body.Type = namespace.NodeTag
	}
	n, err := s.rt.Namespace.CreateNode(body.Path, body.Type,
		namespace.WithDataType(body.DataType),
		namespace.WithDescription(body.Description),
		namespace.WithUnit(body.Unit),
		namespace.WithDriver(body.DriverID, body.DriverAddr),
		namespace.WithExpression(body.Expression),
		namespace.WithMeta(body.Meta),
	)
	if err != nil {
		writeErr(w, 409, err.Error())
		return
	}
	writeJSON(w, 201, n)
}

// DELETE /api/v1/namespace/{path}
func (s *Server) handleNSDelete(w http.ResponseWriter, r *http.Request) {
	raw := r.URL.RawPath
	if raw == "" {
		raw = r.URL.Path
	}
	idx := strings.Index(raw, "/namespace/")
	if idx < 0 {
		writeErr(w, 400, "missing path")
		return
	}
	path := raw[idx+len("/namespace/"):]
	if err := s.rt.Namespace.DeleteNode(path); err != nil {
		writeErr(w, 404, err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true})
}
