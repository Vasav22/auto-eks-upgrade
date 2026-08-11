package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

type HealthCheck struct {
	Status    string                 `json:"status"`
	Timestamp time.Time              `json:"timestamp"`
	ClusterID string                 `json:"cluster_id"`
	Checks    map[string]interface{} `json:"checks"`
}

type HealthAgent struct {
	clientset *kubernetes.Clientset
	clusterID string
	httpPort  string
	informers *InformerManager
}

func NewHealthAgent() (*HealthAgent, error) {
	config, err := rest.InClusterConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to get in-cluster config: %w", err)
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create clientset: %w", err)
	}

	clusterID := os.Getenv("CLUSTER_ID")
	if clusterID == "" {
		clusterID = "unknown"
	}

	httpPort := os.Getenv("HTTP_PORT")
	if httpPort == "" {
		httpPort = "8080"
	}

	informerMgr := NewInformerManager(clientset)

	return &HealthAgent{
		clientset: clientset,
		clusterID: clusterID,
		httpPort:  httpPort,
		informers: informerMgr,
	}, nil
}

func (a *HealthAgent) checkNodes(ctx context.Context) map[string]interface{} {
	nodes, err := a.clientset.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		return map[string]interface{}{
			"status": "unhealthy",
			"error":  err.Error(),
		}
	}

	readyCount := 0
	totalCount := len(nodes.Items)

	for _, node := range nodes.Items {
		for _, condition := range node.Status.Conditions {
			if condition.Type == "Ready" && condition.Status == "True" {
				readyCount++
				break
			}
		}
	}

	return map[string]interface{}{
		"status":      "healthy",
		"total_nodes": totalCount,
		"ready_nodes": readyCount,
	}
}

func (a *HealthAgent) checkPods(ctx context.Context) map[string]interface{} {
	pods, err := a.clientset.CoreV1().Pods("").List(ctx, metav1.ListOptions{})
	if err != nil {
		return map[string]interface{}{
			"status": "unhealthy",
			"error":  err.Error(),
		}
	}

	runningCount := 0
	totalCount := len(pods.Items)

	for _, pod := range pods.Items {
		if pod.Status.Phase == "Running" {
			runningCount++
		}
	}

	return map[string]interface{}{
		"status":       "healthy",
		"total_pods":   totalCount,
		"running_pods": runningCount,
	}
}

func (a *HealthAgent) performHealthCheck(ctx context.Context) HealthCheck {
	return HealthCheck{
		Status:    "healthy",
		Timestamp: time.Now(),
		ClusterID: a.clusterID,
		Checks: map[string]interface{}{
			"nodes": a.checkNodes(ctx),
			"pods":  a.checkPods(ctx),
		},
	}
}

func (a *HealthAgent) healthHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	check := a.performHealthCheck(ctx)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(check)
}

func (a *HealthAgent) Start() error {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if err := a.informers.Start(ctx); err != nil {
		log.Printf("Warning: informers failed to start: %v", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", a.healthHandler)
	mux.HandleFunc("/findings", a.findingsHandler)
	mux.HandleFunc("/pdb", a.pdbHandler)

	server := &http.Server{
		Addr:    ":" + a.httpPort,
		Handler: mux,
	}

	go func() {
		log.Printf("Health agent listening on port %s", a.httpPort)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	log.Println("Shutting down health agent...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	return server.Shutdown(ctx)
}

func main() {
	agent, err := NewHealthAgent()
	if err != nil {
		log.Fatalf("Failed to create health agent: %v", err)
	}

	if err := agent.Start(); err != nil {
		log.Fatalf("Health agent error: %v", err)
	}
}
