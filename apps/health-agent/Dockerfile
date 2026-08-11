# Pre-built stage — binary built on host (make build or go build)
FROM gcr.io/distroless/base-debian12:nonroot

WORKDIR /app

# Copy pre-built static binary
COPY apps/health-agent/health-agent .

EXPOSE 8080

CMD ["/app/health-agent"]
