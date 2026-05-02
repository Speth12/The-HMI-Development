// Package api is the HTTP gateway: REST + WebSocket on chi.
package api

import (
	"net/http"

	"github.com/Speth12/x-hmi/internal/runtime"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

// Server bundles the chi router with a runtime reference.
type Server struct {
	rt     *runtime.Runtime
	router chi.Router
}

// New builds a configured Server. assets may be nil; if non-nil it's mounted at /.
func New(rt *runtime.Runtime, assets http.Handler) *Server {
	r := chi.NewRouter()
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(corsMiddleware)

	s := &Server{rt: rt, router: r}
	s.routes(assets)
	return s
}

// corsMiddleware allows cross-origin requests from any origin so the IDE
// (localhost:5173) can deploy directly to a remote runtime (e.g. PLC at
// 10.0.0.210:8080) without a proxy.
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Handler returns the http.Handler for use by net/http.
func (s *Server) Handler() http.Handler { return s.router }

func (s *Server) routes(assets http.Handler) {
	r := s.router

	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/alive", s.handleAlive)
		r.Get("/project", s.handleGetProject)
		r.Post("/project", s.handlePostProject)

		r.Route("/datasources", func(r chi.Router) {
			r.Get("/", s.handleListDatasources)
			r.Post("/test", s.handleTestDatasource)
			r.Get("/{id}/status", s.handleDatasourceStatus)
			r.Get("/{id}/tags", s.handleBrowseDatasource)
		})

		r.Route("/tag", func(r chi.Router) {
			r.Get("/*", s.handleReadTag)
			r.Post("/*", s.handleWriteTag)
		})

		r.Get("/history", s.handleHistory)

		r.Route("/alarms", func(r chi.Router) {
			r.Get("/", s.handleListAlarms)
			r.Post("/{id}/ack", s.handleAckAlarm)
		})
	})

	r.Get("/ws/tags", s.handleWS)
	r.Get("/ws/alarms", s.handleAlarmWS)

	if assets != nil {
		r.Handle("/*", assets)
	}
}
