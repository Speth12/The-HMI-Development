// x-hmi is the runtime binary for both dev and PLC modes.
//
//	x-hmi --mode=dev       # serve the IDE bundle on :3001
//	x-hmi --mode=runtime   # serve the operator bundle on :8080
package main

import (
	"context"
	"embed"
	"encoding/json"
	"flag"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Speth12/x-hmi/internal/alarmstore"
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
	healthcheck := flag.Bool("healthcheck", false, "probe own /api/v1/alive and exit 0/1")
	mode := flag.String("mode", "dev", "dev | runtime")
	addr := flag.String("addr", "", "listen address (default :3001 dev / :8080 runtime)")
	projectPath := flag.String("project", "", "path to project.json (optional in dev)")
	historyDB := flag.String("history", "history.db", "SQLite WAL file (use ':memory:' to disable persistence)")
	historyRetention := flag.Duration("history-retention", 7*24*time.Hour, "how long to keep history (e.g. 48h, 7d)")
	alarmDB := flag.String("alarm-db", "alarms.db", "SQLite file for alarm event history (use ':memory:' to disable)")
	flag.Parse()

	if *healthcheck {
		listenAddr := *addr
		if listenAddr == "" {
			listenAddr = ":8080"
		}
		host := listenAddr
		if host[0] == ':' {
			host = "localhost" + host
		}
		c := &http.Client{Timeout: 3 * time.Second}
		resp, err := c.Get("http://" + host + "/api/v1/alive")
		if err != nil || resp.StatusCode != http.StatusOK {
			os.Exit(1)
		}
		var body struct {
			OK bool `json:"ok"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&body)
		resp.Body.Close()
		if !body.OK {
			os.Exit(1)
		}
		os.Exit(0)
	}

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
	hist.SetRetention(*historyRetention)
	defer hist.Close()

	alarmSt, err := alarmstore.Open(*alarmDB)
	if err != nil {
		log.Fatalf("[X-HMI] alarmstore: %v", err)
	}
	defer alarmSt.Close()

	rt := runtime.New(store, hist)
	rt.AlarmStore = alarmSt
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
