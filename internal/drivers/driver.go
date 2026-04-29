package drivers

import "context"

// TagDefinition describes a tag discovered by browsing a datasource.
type TagDefinition struct {
	Path        string
	DataType    string
	Description string
	Writable    bool
}

// TagUpdate is the single type all drivers push into TagStore.
type TagUpdate struct {
	Path  string
	Value any
	Quality string // "Good" | "Bad" | "Uncertain"
	TS    int64  // Unix nano
}

// DriverConfig is the connection config passed to Connect.
type DriverConfig struct {
	Endpoint string
	Username string
	Password string
	Extra    map[string]string
}

// DriverStatus is returned by Status().
type DriverStatus struct {
	Connected bool
	LastError string
	TagCount  int
}

// ProtocolDriver is the interface every driver must satisfy.
// Each driver runs as one goroutine. Subscribe returns immediately and pushes
// updates into ch. The driver owns reconnect with exponential backoff.
type ProtocolDriver interface {
	// ID returns the driver identifier, e.g. "opcua", "mbtcp", "mqtt", "rest".
	ID() string

	// Connect establishes the connection. Called once; the driver retries internally.
	Connect(ctx context.Context, cfg DriverConfig) error

	// Disconnect cleanly shuts down the driver.
	Disconnect() error

	// Browse returns all discoverable tags. May be called after Connect.
	Browse() ([]TagDefinition, error)

	// Subscribe begins pushing TagUpdate values for the given paths into ch.
	// Returns immediately; the driver runs the subscription loop in a goroutine.
	Subscribe(paths []string, ch chan<- TagUpdate) error

	// Write pushes a value to the remote tag. Value must be compatible with the
	// tag's data type; the driver performs the conversion.
	Write(path string, value any) error

	// Status returns the current connection state. Safe to call at any time.
	Status() DriverStatus
}
