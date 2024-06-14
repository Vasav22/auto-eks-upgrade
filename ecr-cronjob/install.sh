helm upgrade --install ecr-cronjob . -n imagepullsecret-patcher --set aws.accessKeyId=REPLACE_WITH_ACCESS_KEY_ID --set aws.secretAccessKey=REPLACE_WITH_SECRET_ACCESS_KEY
