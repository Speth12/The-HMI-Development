// x-hmi is the runtime binary for both dev and PLC modes.
//
//	x-hmi --mode=dev       # serve the IDE bundle on :3001
//	x-hmi --mode=runtime   # serve the operator bundle on :8080
package main

import (
	"context"
	"embed"
	"flag"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Speth12/x-hmi/internal/api"
	"github.com/Speth12/x-hmi/internal/historian"
	"github.com/Speth12/x-hmi/internal/project"
	"github.com/Speth12/x-hmi/internal/runtime"
	"github.com/Speth12/x-hmi/internal/tagstore"
)

//go:embed ui
var uiFiles embed.FS

// spaHandler serves the embedded operator UI and falls back to index.html
// for any path that isn't a real asset (SPA client-side routing).
func spaHandler() http.Handler {
	sub, err := fs.Sub(uiFiles, "ui")
	if err != nil {
		log.Fatalf("[X-HMI] embed sub: %v", err)
	}
	fileServer := http.FileServer(http.FS(sub))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Try to open the exact file. If missing, serve index.html.
		f, err := sub.Open(r.URL.Path[1:]) // strip leading /
		if err == nil {
			f.Close()
			fileServer.ServeHTTP(w, r)
			return
		}
		// fall back to SPA index
		data, _ := fs.ReadFile(sub, "index.html")
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write(data)
	})
}

func main() {
	mode := flag.String("mode", "dev", "dev | runtime")
	addr := flag.String("addr", "", "listen address (default :3001 dev / :8080 runtime)")
	projectPath := flag.String("project", "", "path to project.json (optional in dev)")
	historyDB := flag.String("history", "history.db", "SQLite WAL file (use ':memory:' to disable persistence)")
	flag.Parse()

	log.SetFlags(log.Ltime | log.Lmicroseconds | log.Lshortfile)

	if *addr == "" {
		switch *mode {
		case "runtime":
			*addr = ":8080"
		default:
			*addr = ":3001"
		}
	}

	log.Printf("[X-HMI] starting mode=%s addr=%s", *mode, *addr)

	store := tagstore.New()
	hist, err := historian.Open(*historyDB)
	if err != nil {
		log.Fatalf("[X-HMI] historian: %v", err)
	}
	defer hist.Close()

	rt := runtime.New(store, hist)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	rt.Start(ctx)
	defer rt.Stop()

	if *projectPath != "" {
		p, err := project.Load(*projectPath)
		if err != nil {
			log.Fatalf("[X-HMI] load project: %v", err)
		}
		if err := rt.LoadProject(ctx, p); err != nil {
			log.Fatalf("[X-HMI] load project: %v", err)
		}
		log.Printf("[X-HMI] loaded %s — %d datasources, %d pages", *projectPath, len(p.Datasources), len(p.Pages))
	}

	// Serve operator UI for runtime mode; nil assets (IDE proxies its own) for dev.
	var assets http.Handler
	if *mode == "runtime" {
		assets = spaHandler()
	}
	srv := api.New(rt, assets)

	httpSrv := &http.Server{
		Addr:              *addr,
		Handler:           srv.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Printf("[X-HMI] HTTP serving on %s", *addr)
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[X-HMI] HTTP: %v", err)
		}
	}()

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, os.Interrupt, syscall.SIGTERM)
	<-sig
	log.Println("[X-HMI] shutting down...")

	shutCtx, shutCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutCancel()
	_ = httpSrv.Shutdown(shutCtx)
}
