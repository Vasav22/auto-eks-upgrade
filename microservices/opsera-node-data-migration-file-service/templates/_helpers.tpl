{{/* vim: set filetype=mustache: */}}
{{/*
Expand the name of the chart.
*/}}
{{- define "opsera-node-data-migration-file-service.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "opsera-node-data-migration-file-service.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "opsera-node-data-migration-file-service.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Common labels
*/}}
{{- define "opsera-node-data-migration-file-service.labels" -}}
helm.sh/chart: {{ include "opsera-node-data-migration-file-service.chart" . }}
{{ include "opsera-node-data-migration-file-service.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{/*
Datadog Service Check Annotations
*/}}
{{- define "opsera-node-data-migration-file-service.annotations" -}}
ad.datadoghq.com/service.check_names: '["http_check"]'
ad.datadoghq.com/service.init_configs: '[{}]'
ad.datadoghq.com/service.instances: "[\n  {\n    \"name\": \"opsera-node-data-migration-file-service\",\n
  \   \"url\": \"http://%%host%%:%%port%%/data-migration-file/readiness\",\n    \"timeout\": 1,\n   \"http_response_status_code\": 200\n  }\n] \n"
{{- end -}}

{{/*
Selector labels
*/}}
{{- define "opsera-node-data-migration-file-service.selectorLabels" -}}
app.kubernetes.io/name: {{ include "opsera-node-data-migration-file-service.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{/*
Create the name of the service account to use
*/}}
{{- define "opsera-node-data-migration-file-service.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
    {{ default (include "opsera-node-data-migration-file-service.fullname" .) .Values.serviceAccount.name }}
{{- else -}}
    {{ default "default" .Values.serviceAccount.name }}
{{- end -}}
{{- end -}}

{{/*
Inject extra environment populated by secrets, if populated
*/}}
{{- define "ms.extraSecretEnvironmentVars" -}}
{{- if .extraSecretEnvironmentVars -}}
{{- range .extraSecretEnvironmentVars }}
- name: {{ .envName }}
  valueFrom:
   secretKeyRef:
     name: {{ .secretName }}
     key: {{ .secretKey }}
{{- end -}}
{{- end -}}
{{- end -}}
