package main

import (
	"encoding/json"
	"net/http"
	"time"
)

// FindingsResponse is the /findings endpoint response.
type FindingsResponse struct {
	ClusterID    string          `json:"cluster_id"`
	Findings     []HealthFinding `json:"findings"`
	TotalCount   int             `json:"total_count"`
	CriticalCount int            `json:"critical_count"`
	HighCount    int             `json:"high_count"`
	SnapshotTime time.Time       `json:"snapshot_time"`
}

// PDBResponse is the /pdb endpoint response.
type PDBResponse struct {
	ClusterID string `json:"cluster_id"`
	PDBs      []struct {
		Name               string `json:"name"`
		Namespace          string `json:"namespace"`
		DisruptionsAllowed int32  `json:"disruptions_allowed"`
		CurrentHealthy     int32  `json:"current_healthy"`
		DesiredHealthy     int32  `json:"desired_healthy"`
	} `json:"pdbs"`
	BlockingCount int `json:"blocking_count"`
}

func (a *HealthAgent) findingsHandler(w http.ResponseWriter, r *http.Request) {
	snapshot := a.informers.GetSnapshot()
	engine := NewRulesEngine(snapshot)
	findings := engine.Evaluate()

	criticalCount := 0
	highCount := 0
	for _, f := range findings {
		switch f.Severity {
		case "critical":
			criticalCount++
		case "high":
			highCount++
		}
	}

	snapshot.mu.RLock()
	snapshotTime := snapshot.SnapshotTime
	snapshot.mu.RUnlock()

	resp := FindingsResponse{
		ClusterID:     a.clusterID,
		Findings:      findings,
		TotalCount:    len(findings),
		CriticalCount: criticalCount,
		HighCount:     highCount,
		SnapshotTime:  snapshotTime,
	}

	if findings == nil {
		resp.Findings = []HealthFinding{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (a *HealthAgent) pdbHandler(w http.ResponseWriter, r *http.Request) {
	snapshot := a.informers.GetSnapshot()

	snapshot.mu.RLock()
	pdbs := snapshot.PodDisruptionBudgets
	snapshot.mu.RUnlock()

	type pdbEntry struct {
		Name               string `json:"name"`
		Namespace          string `json:"namespace"`
		DisruptionsAllowed int32  `json:"disruptions_allowed"`
		CurrentHealthy     int32  `json:"current_healthy"`
		DesiredHealthy     int32  `json:"desired_healthy"`
	}

	entries := make([]pdbEntry, 0, len(pdbs))
	blockingCount := 0

	for _, pdb := range pdbs {
		entry := pdbEntry{
			Name:               pdb.Name,
			Namespace:          pdb.Namespace,
			DisruptionsAllowed: pdb.Status.DisruptionsAllowed,
			CurrentHealthy:     pdb.Status.CurrentHealthy,
			DesiredHealthy:     pdb.Status.DesiredHealthy,
		}
		entries = append(entries, entry)
		if pdb.Status.DisruptionsAllowed == 0 {
			blockingCount++
		}
	}

	resp := PDBResponse{
		ClusterID:     a.clusterID,
		PDBs:          entries,
		BlockingCount: blockingCount,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
