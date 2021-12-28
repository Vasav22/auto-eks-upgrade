#!/bin/bash

echo "Checking for the kubectl binary"

if [ ! -x "$(command -v kubectl)" ]; then
        pushd /tmp > /dev/null
		echo "kubectl binary is not available. Installing now..."
        	curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
		install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
	popd > /dev/null
else
	echo "Kubectl is available...skipping installation"
fi

mongo_username=${MONGO_USERNAME:-"root"}
mongo_password=""
if test -n "${MONGO_ROOT_PASSWORD}"; then
	mongo_password=${MONGO_ROOT_PASSWORD}
elif test -n "${MONGO_PASSWORD}"; then
	mongo_password=${MONGO_PASSWORD}
fi
mongo_auth_db=${MONGO_AUTH_DB:-"admin"}
sleep_count=${SLEEP_COUNT:-5}

echo "Mongo Connection information."
echo "Mongo Username: ${mongo_username}"
echo "Mongo Password: ${mongo_password}"
echo "Mongo Auth DB: ${mongo_auth_db}"

while true;
do
	datetime=$(date)
	echo "${datetime} Fetching primary node information."
	if test -s new_primary_node; then
		rm -rf new_primary_node
	fi
	mongo -u ${mongo_username} -p${mongo_password} --quiet --authenticationDatabase ${mongo_auth_db} --eval 'rs.status().members.filter(function(rsStatus) { return rsStatus.state === 1;})[0].name' > /tmp/new_primary_node
	if [[ $? -ne 0 ]] ;
	then
		echo "${datetime} Can not connect to Mongo DB to get the new pod status."
		sleep ${sleep_count}
		continue
	else
		new_primary_node=$(cat /tmp/new_primary_node | cut -d'.' -f 1)

		echo "${datetime} new primary node is ${new_primary_node}"
		
		existing_primary_node=$(kubectl get pods -l component=primary | grep -v NAME | awk '{print $1}')
		if [[ -z ${existing_primary_node} ]]; then
			echo "${datetime} No Existing primary node found."
		else
			echo "${datetime} Existing primary is ${existing_primary_node}"
		fi

		if [[ "${existing_primary_node}" -ne "${new_primary_node}" ]]; then
			echo "${datetime} new node is not in service. we will need to update"
			kubectl label pod ${new_primary_node} component=primary --overwrite
			if [[ -z ${existing_primary_node} ]]; then
				kubectl label pod ${existing_primary_node} component=secondary --overwrite
			fi
		else
			echo "${datetime} Node ${existing_primary_node} (${new_primary_node}) is already in service."
		fi


	fi
	sleep ${sleep_count}
done