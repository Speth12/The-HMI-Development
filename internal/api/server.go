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

	s := &Server{rt: rt, router: r}
	s.routes(assets)
	return s
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
			r.Get("/{id}/status", s.handleDatasourceStatus)
			r.Get("/{id}/tags", s.handleBrowseDatasource)
		})

		r.Route("/tag", func(r chi.Router) {
			r.Get("/{path}", s.handleReadTag)
			r.Post("/{path}", s.handleWriteTag)
		})

		r.Get("/history", s.handleHistory)
	})

	r.Get("/ws/tags", s.handleWS)

	if assets != nil {
		r.Handle("/*", assets)
	}
}
