.PHONY: spike test test-race deps tidy

# Run the Day 1 OPC UA spike
spike:
	go run ./cmd/spike

# Run all Go unit tests
test:
	go test ./...

# Run with race detector (required for TagStore + driver tests)
test-race:
	go test -race ./...

# Download dependencies
deps:
	go mod download

# Tidy go.sum
tidy:
	go mod tidy
