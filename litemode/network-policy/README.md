Creates a network policy with below,
Ingress rules:
1. Allow traffic from Ingress controller
2. Allow pod-to-pod within namespace

Egress rules:
1. Allow pod-to-pod within namespace
2. Allow internet access (EXCLUDING cluster internal IPs)
3. Allow DNS resolution (critical for internet access)
