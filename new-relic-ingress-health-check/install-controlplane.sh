# Exit immediately when failure occurs
set -e 
set -o pipefail

while read -r line; do
  if [ -f "${line}.yaml" ]; then
    echo "${line}.yaml already exist, not creating it"
  else
    echo "Creating ${line}.yaml"
    sed "s/REPLACE_CLUSTER_NAME_HERE/$line/g" cluster.template.controlplane > $line.yaml
  fi
  kubectx arn:aws:eks:us-east-2:440953937617:cluster/${line} || aws eks update-kubeconfig --profile opsera-sys --name ${line}
  helm upgrade --install datadog-tools-health-check . -n datadog-tools-health-check --create-namespace -f ${line}.yaml
  sleep 5
done < clusters.list.controlplane
