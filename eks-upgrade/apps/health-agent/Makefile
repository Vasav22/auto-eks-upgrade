.PHONY: build test clean

GO := ../../.local/go/bin/go
BINARY := health-agent

build:
	$(GO) build -o $(BINARY) .

test:
	$(GO) test ./...

clean:
	rm -f $(BINARY)

run:
	HTTP_PORT=8080 CLUSTER_ID=local $(GO) run .
