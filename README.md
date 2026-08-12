# EKS Upgrade Control Plane

Enterprise-grade Kubernetes upgrade management platform for EKS clusters — supporting cross-account discovery, control-plane queuing, and node-group upgrade management via IRSA.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development environment
docker-compose up -d

# Run database migrations
npm run typeorm:migration:run

# Start API
npm run dev:api

# Start Web (separate terminal)
npm run dev:web

# Start Health Agent (separate terminal)
cd apps/health-agent && make run
```

## 📋 Features

### Cluster Discovery
- **IRSA-based auth** — no static AWS keys; uses pod-attached IAM roles
- **Cross-account discovery** — discovers clusters across multiple AWS accounts via `AssumeRole`
- **All-region scan** — scans all ~30 AWS commercial EKS regions in parallel batches
- **Live version info** — fetches current EKS version and support status from AWS on discovery

### Control Plane Upgrades
- Queue upgrade jobs (DB-only, no live AWS execution until explicitly triggered)
- View queued/in-progress/cancelled jobs per cluster
- Cancel pending or in-progress jobs

### Node Group Upgrades
- Load live node groups from AWS (`ListNodegroups` + `DescribeNodegroup`)
- Filter node groups by name or label key/value
- Select individual groups or all
- Queue one DB upgrade job per selected node group
- View and cancel queued node-group jobs

### Fleet Dashboard
- View all discovered clusters across accounts and regions
- Columns: cluster name, account, region, version, status, health, sync
- Resizable table columns
- Multi-cluster bulk upgrade selection

### Security & Audit
- OIDC + PKCE authentication (configurable, can be disabled for dev)
- JWT sessions with httpOnly cookies
- 5-role RBAC
- Immutable audit trail with 7-year retention

## 🏗️ Architecture

### Backend (NestJS API)
- **Auth**: OIDC + PKCE, JWT, 5-role RBAC (`DISABLE_AUTH=true` for dev)
- **Database**: PostgreSQL 16 + TypeORM
- **Caching**: Redis 7 + BullMQ
- **AWS**: `@aws-sdk/client-eks`, `@aws-sdk/client-sts` — IRSA + cross-account AssumeRole

### Frontend (React)
- React 18 + Vite + TypeScript
- Ant Design 5
- Axios for API calls

### Health Agent (Go)
- Kubernetes `client-go`
- Node & Pod health monitoring

## 🐳 Docker & Deployment

### Build web image (pre-built approach)
```bash
# 1. Build frontend
cd apps/web && npx vite build

# 2. Copy dist to build-output
cp -r ../../dist/apps/web/* apps/web/build-output/

# 3. Build Docker image
docker build -t eks-upgrade-web:latest -f apps/web/Dockerfile.prebuilt .

# 4. Push to ECR
AWS_PROFILE=opseraplatform aws ecr get-login-password --region us-east-2 \
  | docker login --username AWS --password-stdin 440953937617.dkr.ecr.us-east-2.amazonaws.com
docker push 440953937617.dkr.ecr.us-east-2.amazonaws.com/eks-upgrade-web:latest
```

### Build API image
```bash
docker build -f apps/api/Dockerfile -t eks-upgrade-api:latest .
docker push 440953937617.dkr.ecr.us-east-2.amazonaws.com/eks-upgrade-api:latest
```

### Deploy via Helm
```bash
helm upgrade --install eks-upgrade ./charts/eks-upgrade \
  -f charts/eks-upgrade/values.yaml \
  -f charts/eks-upgrade/values-opsera-test.yaml \
  --set api.env.DATABASE_PASSWORD="<password>" \
  --namespace eks-upgrade \
  --create-namespace
```

### Rollback
```bash
helm history eks-upgrade -n eks-upgrade
helm rollback eks-upgrade <revision> -n eks-upgrade
```

## 🔑 Environment Variables

### API (key ones)
```env
# Database
DATABASE_HOST=postgresql.postgres.svc.cluster.local
DATABASE_PORT=5432
DATABASE_NAME=eks_upgrade
DATABASE_USER=postgres
DATABASE_PASSWORD=<secret>

# Encryption (must be stable across restarts — 32-byte base64)
ENCRYPTION_KEY=<base64-32-bytes>

# Auth (set to true to bypass OIDC in dev/test)
DISABLE_AUTH=true

# OIDC (when auth is enabled)
OIDC_ISSUER_URL=https://idp.example.com
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
```

### IRSA (injected automatically by EKS pod mutation webhook)
```env
AWS_ROLE_ARN=arn:aws:iam::<account>:role/<role-name>
AWS_WEB_IDENTITY_TOKEN_FILE=/var/run/secrets/eks.amazonaws.com/serviceaccount/token
```

> **Important**: `ENCRYPTION_KEY` must be set as a stable secret. Without it, an ephemeral key is used and encrypted credentials will be lost on pod restart.

## 📦 IAM Requirements

The API pod's IAM role needs:
```json
{
  "Effect": "Allow",
  "Action": [
    "eks:ListClusters",
    "eks:DescribeCluster",
    "eks:ListNodegroups",
    "eks:DescribeNodegroup",
    "eks:UpdateClusterVersion",
    "eks:UpdateNodegroupVersion",
    "sts:GetCallerIdentity",
    "sts:AssumeRole"
  ],
  "Resource": "*"
}
```

For cross-account access, the target account's role must have a trust policy allowing the pod role to assume it.

## 👥 RBAC Roles

| Role | Permissions |
|------|-------------|
| `upgrade_operator` | View + non-prod mutations |
| `sre_oncall` | + Non-destructive remediation approval |
| `cluster_admin` | + Production mutations + backup management |
| `change_coordinator` | + Scheduling + destructive approval |
| `compliance_reviewer` | Read-only across all resources |

## 🛠️ Development

```bash
# Lint
npm run lint

# Build
npm run build

# Tests
npm run test
```

## 📚 Documentation

- [BUILD_SUMMARY.md](./BUILD_SUMMARY.md) — Completed features
- `charts/eks-upgrade/` — Helm chart and values files
- `apps/api/src/database/README.md` — Database schema notes

## 📄 License

Proprietary — Opsera Inc.
