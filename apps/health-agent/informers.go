package main

import (
	"context"
	"fmt"
	"sync"
	"time"

	corev1 "k8s.io/api/core/v1"
	policyv1 "k8s.io/api/policy/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/cache"
)

// ResourceSnapshot holds a point-in-time view of key cluster resources.
type ResourceSnapshot struct {
	Nodes              []*corev1.Node
	Pods               []*corev1.Pod
	PodDisruptionBudgets []*policyv1.PodDisruptionBudget
	SnapshotTime       time.Time
	mu                 sync.RWMutex
}

// InformerManager manages shared informers for cluster resource watching.
type InformerManager struct {
	clientset *kubernetes.Clientset
	snapshot  *ResourceSnapshot
	stopCh    chan struct{}
}

func NewInformerManager(clientset *kubernetes.Clientset) *InformerManager {
	return &InformerManager{
		clientset: clientset,
		snapshot: &ResourceSnapshot{
			SnapshotTime: time.Now(),
		},
		stopCh: make(chan struct{}),
	}
}

func (m *InformerManager) Start(ctx context.Context) error {
	nodeInformer := cache.NewListWatchFromClient(
		m.clientset.CoreV1().RESTClient(),
		"nodes",
		metav1.NamespaceAll,
		cache.ResourceEventHandlerFuncs{
			AddFunc:    func(obj interface{}) { m.syncNodes(ctx) },
			UpdateFunc: func(_, obj interface{}) { m.syncNodes(ctx) },
			DeleteFunc: func(obj interface{}) { m.syncNodes(ctx) },
		},
	)

	_ = nodeInformer

	// Start background sync
	go m.periodicSync(ctx)
	return nil
}

func (m *InformerManager) periodicSync(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	// Initial sync
	m.syncAll(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			m.syncAll(ctx)
		}
	}
}

func (m *InformerManager) syncAll(ctx context.Context) {
	m.syncNodes(ctx)
	m.syncPods(ctx)
	m.syncPDBs(ctx)

	m.snapshot.mu.Lock()
	m.snapshot.SnapshotTime = time.Now()
	m.snapshot.mu.Unlock()
}

func (m *InformerManager) syncNodes(ctx context.Context) {
	nodeList, err := m.clientset.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		return
	}
	nodes := make([]*corev1.Node, len(nodeList.Items))
	for i := range nodeList.Items {
		nodes[i] = &nodeList.Items[i]
	}
	m.snapshot.mu.Lock()
	m.snapshot.Nodes = nodes
	m.snapshot.mu.Unlock()
}

func (m *InformerManager) syncPods(ctx context.Context) {
	podList, err := m.clientset.CoreV1().Pods(metav1.NamespaceAll).List(ctx, metav1.ListOptions{})
	if err != nil {
		return
	}
	pods := make([]*corev1.Pod, len(podList.Items))
	for i := range podList.Items {
		pods[i] = &podList.Items[i]
	}
	m.snapshot.mu.Lock()
	m.snapshot.Pods = pods
	m.snapshot.mu.Unlock()
}

func (m *InformerManager) syncPDBs(ctx context.Context) {
	pdbList, err := m.clientset.PolicyV1().PodDisruptionBudgets(metav1.NamespaceAll).List(ctx, metav1.ListOptions{})
	if err != nil {
		return
	}
	pdbs := make([]*policyv1.PodDisruptionBudget, len(pdbList.Items))
	for i := range pdbList.Items {
		pdbs[i] = &pdbList.Items[i]
	}
	m.snapshot.mu.Lock()
	m.snapshot.PodDisruptionBudgets = pdbs
	m.snapshot.mu.Unlock()
}

func (m *InformerManager) GetSnapshot() *ResourceSnapshot {
	return m.snapshot
}

// RulesEngine evaluates health rules against the resource snapshot.
type RulesEngine struct {
	snapshot *ResourceSnapshot
}

type HealthFinding struct {
	Severity    string            `json:"severity"`
	Category    string            `json:"category"`
	Title       string            `json:"title"`
	Description string            `json:"description"`
	Resource    string            `json:"resource"`
	Namespace   string            `json:"namespace"`
	Remediation string            `json:"remediation,omitempty"`
	Labels      map[string]string `json:"labels,omitempty"`
}

func NewRulesEngine(snapshot *ResourceSnapshot) *RulesEngine {
	return &RulesEngine{snapshot: snapshot}
}

func (e *RulesEngine) Evaluate() []HealthFinding {
	var findings []HealthFinding

	e.snapshot.mu.RLock()
	nodes := e.snapshot.Nodes
	pods := e.snapshot.Pods
	pdbs := e.snapshot.PodDisruptionBudgets
	e.snapshot.mu.RUnlock()

	// Rule: Not-Ready nodes
	for _, node := range nodes {
		for _, cond := range node.Status.Conditions {
			if cond.Type == corev1.NodeReady && cond.Status != corev1.ConditionTrue {
				findings = append(findings, HealthFinding{
					Severity:    "critical",
					Category:    "node_health",
					Title:       "Node Not Ready",
					Description: fmt.Sprintf("Node %s is not ready: %s", node.Name, cond.Message),
					Resource:    node.Name,
					Remediation: "Check node conditions and kubelet logs",
				})
			}
		}
	}

	// Rule: Pods in CrashLoopBackOff
	for _, pod := range pods {
		for _, cs := range pod.Status.ContainerStatuses {
			if cs.State.Waiting != nil && cs.State.Waiting.Reason == "CrashLoopBackOff" {
				findings = append(findings, HealthFinding{
					Severity:    "high",
					Category:    "pod_health",
					Title:       "CrashLoopBackOff",
					Description: fmt.Sprintf("Container %s in pod %s/%s is in CrashLoopBackOff", cs.Name, pod.Namespace, pod.Name),
					Resource:    pod.Name,
					Namespace:   pod.Namespace,
					Remediation: "Check container logs for errors",
				})
			}
		}
	}

	// Rule: PDBs blocking disruption
	for _, pdb := range pdbs {
		if pdb.Status.DisruptionsAllowed == 0 && pdb.Status.CurrentHealthy > 0 {
			findings = append(findings, HealthFinding{
				Severity:    "warning",
				Category:    "disruption_policy",
				Title:       "PDB Blocks Disruption",
				Description: fmt.Sprintf("PDB %s/%s allows 0 disruptions (healthy=%d, desired=%d)",
					pdb.Namespace, pdb.Name, pdb.Status.CurrentHealthy, pdb.Status.DesiredHealthy),
				Resource:    pdb.Name,
				Namespace:   pdb.Namespace,
				Remediation: "Review PDB minAvailable/maxUnavailable settings",
			})
		}
	}

	return findings
}

// satisfy unused import - list/watch used for node informer setup
var _ = cache.NewListWatchFromClient
var _ = watch.Interface(nil)
var _ = runtime.Object(nil)
