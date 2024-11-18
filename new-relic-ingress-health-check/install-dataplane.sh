# Exit immediately when failure occurs
set -e 
set -o pipefail

while read -r line; do
  if [ -f "${line}.yaml" ]; then
    echo "${line}.yaml already exist, not creating it"
  else
    echo "Creating ${line}.yaml"
    sed "s/REPLACE_CLUSTER_NAME_HERE/$line/g" cluster.template.dataplane > $line.yaml
  fi
  kubectx arn:aws:eks:us-east-2:344794884713:cluster/${line} || aws eks update-kubeconfig --profile opsera-customer --name ${line}
  helm upgrade --install datadog-tools-health-check . -n datadog-tools-health-check --create-namespace -f ${line}.yaml
  sleep 5
done < clusters.list.dataplane
