# use for developer
OPSERA_ENV=OPSERA_DEV
$(aws secretsmanager get-secret-value --secret-id=$OPSERA_ENV --profile opsera | jq '.SecretString | fromjson' | jq -r 'keys[] as $k | "export \($k)=\(.[$k])"')


# Use for helm deployment
OPSERA_ENV=OPSERA_DEV
helm upgrade microservice-common-functions ./microservice-common-functions \
	-n microservices \
	$(aws secretsmanager get-secret-value --secret-id=$OPSERA_ENV --profile opsera | jq '.SecretString | fromjson' | jq -r 'keys[] as $k | "--set extraSecretEnvironmentVars.\($k)=\(.[$k])"')


OPSERA_ENV=OPSERA_REPLICA
helm upgrade opsera-ms-shared-resources ./microservice-common-functions \
	-n microservices \
	$(aws secretsmanager get-secret-value --secret-id=$OPSERA_ENV --profile opsera --region=us-west-2 | jq '.SecretString | fromjson' | jq -r 'keys[] as $k | "--set extraSecretEnvironmentVars.\($k)=\(.[$k])"')