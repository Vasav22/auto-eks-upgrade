# use for developer linux/MAC
# make sure to have aws cli setup on you local -- aws configure --profile opsera-sys
OPSERA_ENV=OPSERA_DEV
$(aws secretsmanager get-secret-value --secret-id=$OPSERA_ENV --profile opsera-sys | jq '.SecretString | fromjson' | jq -r 'keys[] as $k | "export \($k)=\(.[$k])"')

# use for developer Window
# make sure to have aws cli setup on you local -- aws configure --profile opsera-sys
$ENV:OPSERA_ENV="OPSERA_DEV"
$(aws secretsmanager get-secret-value --secret-id=$ENV:OPSERA_ENV --profile opsera-sys | jq-win64 '.SecretString | fromjson' | jq-win64 -r 'keys[] as $k | \"$ENV:\($k)=\\\"\(.[$k])\\\"\"') >> env_out.ps1
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
#remove kafka_array from env_out.ps1
.\env_out.ps1
[array]$ENV:OPSERA_KAFKA_BORKERS="kafka.kafka.svc.cluster.local:9092"
#verify the ENV
Get-ChildItem Env:

# Use for helm deployment
OPSERA_ENV=OPSERA_DEV
helm upgrade microservice-common-functions ./microservice-common-functions \
	-n microservices \
	$(aws secretsmanager get-secret-value --secret-id=$OPSERA_ENV --profile opsera-sys | jq '.SecretString | fromjson' | jq -r 'keys[] as $k | "--set extraSecretEnvironmentVars.\($k)=\(.[$k])"')


OPSERA_ENV=OPSERA_EAST_REPLICA
helm upgrade microservice-common-functions ./microservice-common-functions \
	-n microservices \
	$(aws secretsmanager get-secret-value --secret-id=$OPSERA_ENV --profile opsera-sys | jq '.SecretString | fromjson' | jq -r 'keys[] as $k | "--set extraSecretEnvironmentVars.\($k)=\(.[$k])"')


# Use for helm deployment
OPSERA_ENV=OPSERA_STAGING
helm upgrade microservice-common-functions ./microservice-common-functions \
	-n microservices-staging \
	$(aws secretsmanager get-secret-value --secret-id=$OPSERA_ENV --profile opsera-sys | jq '.SecretString | fromjson' | jq -r 'keys[] as $k | "--set extraSecretEnvironmentVars.\($k)=\(.[$k])"')


OPSERA_ENV=OPSERA_TEST
helm upgrade microservice-common-functions ./microservice-common-functions \
	-n microservices \
	$(aws secretsmanager get-secret-value --secret-id=$OPSERA_ENV --profile opsera-sys | jq '.SecretString | fromjson' | jq -r 'keys[] as $k | "--set extraSecretEnvironmentVars.\($k)=\(.[$k])"')
