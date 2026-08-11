#!/usr/bin/env bash
set -euo pipefail

ACCOUNT="440953937617"
REGION="us-east-2"
PROFILE="opseraplatform"
ROLE_NAME="eks-upgrade-discovery-role"
POLICY_NAME="eks-upgrade-discovery-policy"
NODE_ROLE_ARN="arn:aws:iam::440953937617:role/opsera-test-eks-node-group"

echo "==> Creating EKS discovery IAM policy"
POLICY_DOC=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EKSReadOnly",
      "Effect": "Allow",
      "Action": [
        "eks:ListClusters",
        "eks:DescribeCluster",
        "eks:ListNodegroups",
        "eks:DescribeNodegroup",
        "eks:ListFargateProfiles",
        "eks:DescribeFargateProfile",
        "eks:ListUpdates",
        "eks:DescribeUpdate",
        "eks:ListAddons",
        "eks:DescribeAddon"
      ],
      "Resource": "*"
    }
  ]
}
EOF
)

# Create or update the policy
POLICY_ARN="arn:aws:iam::${ACCOUNT}:policy/${POLICY_NAME}"
if aws iam get-policy --policy-arn "$POLICY_ARN" --profile "$PROFILE" &>/dev/null; then
  echo "  Policy already exists, creating new version"
  aws iam create-policy-version \
    --policy-arn "$POLICY_ARN" \
    --policy-document "$POLICY_DOC" \
    --set-as-default \
    --profile "$PROFILE"
else
  echo "  Creating policy $POLICY_NAME"
  aws iam create-policy \
    --policy-name "$POLICY_NAME" \
    --policy-document "$POLICY_DOC" \
    --description "Allows eks-upgrade API pod to discover EKS clusters" \
    --profile "$PROFILE"
fi

echo "==> Creating IAM role with trust policy"
TRUST_DOC=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowNodeRoleToAssume",
      "Effect": "Allow",
      "Principal": {
        "AWS": "${NODE_ROLE_ARN}"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
)

if aws iam get-role --role-name "$ROLE_NAME" --profile "$PROFILE" &>/dev/null; then
  echo "  Role already exists, updating trust policy"
  aws iam update-assume-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-document "$TRUST_DOC" \
    --profile "$PROFILE"
else
  echo "  Creating role $ROLE_NAME"
  aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document "$TRUST_DOC" \
    --description "Role assumed by eks-upgrade API pod for cluster discovery" \
    --profile "$PROFILE"
fi

echo "==> Attaching policy to role"
aws iam attach-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-arn "$POLICY_ARN" \
  --profile "$PROFILE"

echo ""
echo "==> Also adding sts:AssumeRole permission to the node role"
STS_POLICY_DOC=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowAssumeDiscoveryRole",
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": "arn:aws:iam::${ACCOUNT}:role/${ROLE_NAME}"
    }
  ]
}
EOF
)

aws iam put-role-policy \
  --role-name "opsera-test-eks-node-group" \
  --policy-name "eks-upgrade-assume-discovery-role" \
  --policy-document "$STS_POLICY_DOC" \
  --profile "$PROFILE"

ROLE_ARN="arn:aws:iam::${ACCOUNT}:role/${ROLE_NAME}"
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "  Role ARN (use this in the Add Account modal):                "
echo "  $ROLE_ARN                                                    "
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "==> Verifying assume role works from node identity..."
aws sts assume-role \
  --role-arn "$ROLE_ARN" \
  --role-session-name "test-discovery" \
  --profile "$PROFILE" \
  --query 'Credentials.{AK:AccessKeyId,Exp:Expiration}' \
  --output table 2>&1 || echo "  (assume-role test uses profile creds, not node role - OK if this fails)"
echo ""
echo "Done! Use this Role ARN in the Fleet Dashboard 'Add Account' form:"
echo "$ROLE_ARN"
