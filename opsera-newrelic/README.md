# New Relic Deployment

This directory contains the configuration files for deploying New Relic monitoring in a Kubernetes cluster.

## Prerequisites

- Helm installed and configured
- Access to a Kubernetes cluster
- New Relic Helm repository added to your Helm repositories
- New Relic license key

## Adding New Relic Helm Repository

If you haven't added the New Relic Helm repository yet, run:

```bash
helm repo add newrelic https://helm-charts.newrelic.com
helm repo update
```

## Important Configuration Notes

### License Key
Add your New Relic license key in the values files:
- `values-newrelic-dataplane.yaml`
- `values-newrelic-controlplane.yaml`

### Cluster Naming Convention
The cluster name in the configuration should follow this syntax:
- For dataplane: `<customer_name>-dataplane`
- For controlplane: `<customer_name>-controlplane`

Example:
- `acme-dataplane`
- `acme-controlplane`

## Deployment Commands

### Deploy Dataplane Configuration

```bash
helm upgrade --install newrelic-bundle newrelic/nri-bundle \
--version 5.0.112 --namespace newrelic --create-namespace \
-f values-newrelic-dataplane.yaml
```

### Deploy Controlplane Configuration

```bash
helm upgrade --install newrelic-bundle newrelic/nri-bundle \
--version 5.0.112 --namespace newrelic --create-namespace \
-f values-newrelic-controlplane.yaml
```

## Configuration Files

- `values-newrelic-dataplane.yaml`: Configuration for dataplane monitoring
- `values-newrelic-controlplane.yaml`: Configuration for controlplane monitoring

## Notes

- The deployment will create a new namespace called `newrelic` if it doesn't exist
- Make sure you have the necessary permissions to create namespaces and deploy to the cluster
- Verify your Kubernetes context is set correctly before running the deployment commands
- Ensure the cluster name follows the correct naming convention before deployment 