#!/usr/bin/env bash
set -euo pipefail

ECR="440953937617.dkr.ecr.us-east-2.amazonaws.com"
REGION="us-east-2"
PROFILE="opseraplatform"
NAMESPACE="eks-upgrade"
REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "==> ECR login"
aws ecr get-login-password --region "$REGION" --profile "$PROFILE" \
  | docker login --username AWS --password-stdin "$ECR"

echo "==> Building API image (ts-node transpile-only)"
docker build --network=host \
  -f "$REPO_ROOT/apps/api/Dockerfile" \
  -t "$ECR/eks-upgrade-api:latest" \
  "$REPO_ROOT"

echo "==> Building Web image"
docker build --network=host \
  -f "$REPO_ROOT/apps/web/Dockerfile" \
  -t "$ECR/eks-upgrade-web:latest" \
  "$REPO_ROOT"

echo "==> Pushing images"
docker push "$ECR/eks-upgrade-api:latest"
docker push "$ECR/eks-upgrade-web:latest"

echo "==> Rolling out deployments"
kubectl rollout restart deployment/eks-upgrade-api  -n "$NAMESPACE"
kubectl rollout restart deployment/eks-upgrade-web  -n "$NAMESPACE"

echo "==> Waiting for rollout..."
kubectl rollout status deployment/eks-upgrade-api -n "$NAMESPACE" --timeout=3m
kubectl rollout status deployment/eks-upgrade-web -n "$NAMESPACE" --timeout=3m

echo "==> Done. Pods:"
kubectl get pods -n "$NAMESPACE"
