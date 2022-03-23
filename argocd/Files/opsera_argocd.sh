#!/bin/sh -x

RESPONSE_FILE="/tmp/response.txt"
if [[ -z ${OPSERA_ADMIN_USERNAME} ]];
then
	echo "No Admin user information provided. Using Default user information."
	OPSERA_ADMIN_USERNAME="nrupen"
fi

if [[ -z ${OPSERA_ADMIN_PASSWORD} ]];
then
	echo "No default password provided. Using Default password."
	OPSERA_ADMIN_PASSWORD="OpseraAdmin768"
fi

echo "Fetching ArgoCD service Host and Port Information."
ARGOCD_API_SVC_IP=$(printenv | grep ARGOCD_SERVER | grep HOST | cut -d "=" -f 1)
ARGOCD_HTTPS_PORT=$(printenv | grep ARGOCD_SERVER_SERVICE_PORT_HTTPS | cut -d "=" -f 1)
ARGOCD_HTTP_PORT=$(printenv | grep ARGOCD_SERVER_SERVICE_PORT_HTTP | cut -d "=" -f 1)

if [[ ! -z ${ARGOCD_HTTPS_PORT} ]];
then
	ARGOCD_API_ROOT_URL="https://${ARGOCD_API_SVC_IP}:${ARGOCD_HTTPS_PORT}/api/v1"
elif [[ ! -z ${ARGOCD_HTTP_PORT} ]];
then
	ARGOCD_API_ROOT_URL="http://${ARGOCD_API_SVC_IP}:${ARGOCD_HTTP_PORT}/api/v1"
else
	ARGOCD_API_ROOT_URL="http://127.0.0.1:8080/api/v1"
fi

DEFAULT_CURL_ACTION="GET"

if [[ -z ${ARGOCD_ADMIN_USER} ]]; then
	echo "Missing ArgoCD Username. Exiting now..."
	exit 1
elif [[ -z ${ARGOCD_ADMIN_PASSWORD} ]]; then
	echo "Missing ArgoCD Admin User Password. Exiting Now."
	exit 1
else
	echo "Proceeding with provided ArgoCD Admin username and password."
fi

# ARGOCD_ADMIN_USER=""
# ARGOCD_ADMIN_PASSWORD=""
account_found=""

function execute_curl() {
	
	if [[ ! -z ${1} ]]; then
		CURL_URL="${ARGOCD_API_ROOT_URL}/${1}"
	else
		echo "No url information available."
		echo "Exiting with Error."
		exit 1
	fi
	
	CURL_ACTION=${2:-${DEFAULT_CURL_ACTION}}
	CURL_PAYLOAD=${3:-""}
	OPTIONS=${4:-""}
	
	#TODO: check for file before removal.
	if [[ -f ${RESPONSE_FILE} ]]; then
		rm -rf ${RESPONSE_FILE}
	fi
	
	if [[ -z "${OPTIONS}" ]]; 
	then
		http_response=$(curl -s -o ${RESPONSE_FILE} -w "%{http_code}" ${CURL_URL} -X ${CURL_ACTION} -d "${CURL_PAYLOAD}" -H 'Content-Type: application/json' -k)
	else
		http_response=$(curl -s -o ${RESPONSE_FILE} -w "%{http_code}" ${CURL_URL} -X ${CURL_ACTION} -d "${CURL_PAYLOAD}" -H 'Content-Type: application/json' -H "${OPTIONS}" -k)
	fi

	if [[ ${http_response} -eq 200 && $? -eq 0 ]];
	then
		echo "[$retry]${CURL_URL} executed successfully."
	else
		echo "[$retry]${CURL_URL} has failed with status ${http_response}"
		echo "[$retry]Exiting Now."
	fi
}

function validate_user_account() {
	payload=""
	execute_curl "account" "GET" "${payload}" "Cookie: argocd.token=${token}"
	accounts=$(cat ${RESPONSE_FILE} | jq -r ".items[] | .name")
	for account in $accounts;
	do
		if [[ "$account" == "${OPSERA_ADMIN_USERNAME}" ]]; then
			account_found="true"
			break
		fi
	done
}

retry=0
max_retry_count=${MAX_RETRY_COUNT:-5}
while [[ $retry -le 5 ]];
do
	token=""
	echo "[$retry]Login in as Admin User."
	execute_curl "session" "POST" "{\"username\": \"${ARGOCD_ADMIN_USER}\", \"password\": \"${ARGOCD_ADMIN_PASSWORD}\"}"
	token=$(cat ${RESPONSE_FILE}| jq -r ".token")

	if [[ $? -ne 200 && -z ${token} ]];
	then
		echo "[$retry]Unable to login with Admin User."
		cat ${RESPONSE_FILE}
	else
		validate_user_account
		if [[ ! -z $account_found ]]; then
			echo "[$retry]Updating Password for user ${OPSERA_ADMIN_USERNAME}"
			execute_curl "account/password" "PUT" "{\"currentPassword\": \"${ARGOCD_ADMIN_PASSWORD}\", \"name\": \"${OPSERA_ADMIN_USERNAME}\", \"newPassword\": \"${OPSERA_ADMIN_PASSWORD}\"}" "Cookie: argocd.token=${token}"
			exit 0
		else
			echo "[$retry]User ${OPSERA_ADMIN_USERNAME} is not available...Skipping password update"
		fi
	fi
	((retry=retry+1))
	sleep 30
done