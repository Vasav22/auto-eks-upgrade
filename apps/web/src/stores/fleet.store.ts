import { create } from 'zustand';

export interface Cluster {
  id: string;
  name: string;
  region: string;
  version: string;
  status: string;
}

export interface FleetState {
  clusters: Cluster[];
  loading: boolean;
  error: string | null;
  setClusters: (clusters: Cluster[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useFleetStore = create<FleetState>((set) => ({
  clusters: [],
  loading: false,
  error: null,
  setClusters: (clusters: Cluster[]): void => set({ clusters, error: null }),
  setLoading: (loading: boolean): void => set({ loading }),
  setError: (error: string | null): void => set({ error, loading: false }),
}));
