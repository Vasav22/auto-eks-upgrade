{{/*
Expand the name of the chart.
*/}}
{{- define "opsera-jobengine-core-tenant.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "opsera-jobengine-core-tenant.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "opsera-jobengine-core-tenant.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "opsera-jobengine-core-tenant.labels" -}}
helm.sh/chart: {{ include "opsera-jobengine-core-tenant.chart" . }}
{{ include "opsera-jobengine-core-tenant.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "opsera-jobengine-core-tenant.selectorLabels" -}}
app.kubernetes.io/name: {{ include "opsera-jobengine-core-tenant.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Datadog Service Check Annotations
*/}}
{{- define "opsera-jobengine-core-tenant.annotations" -}}
ad.datadoghq.com/service.check_names: '["http_check"]'
ad.datadoghq.com/service.init_configs: '[{}]'
ad.datadoghq.com/service.instances: "[\n  {\n    \"name\": \"opsera-node-pipeline-monitor-service\",\n
  \   \"url\": \"http://%%host%%:%%port%%/status\",\n    \"timeout\": 1,\n  \"http_response_status_code\": 200\n  }\n] \n"
{{- end -}}


{{/*
Create the name of the service account to use
*/}}
{{- define "opsera-jobengine-core-tenant.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "opsera-jobengine-core-tenant.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Get EFS Volume ID created at the time of cluster provisioning
*/}}
{{- define "opsera-jobengine-core-tenant.efsVolumeId" -}}
{{- $pvName := .Values.k8sIntegratorVolumeName }}
{{- if (lookup "v1" "PersistentVolume" "" $pvName) }}
{{- (lookup "v1" "PersistentVolume" "" $pvName ).spec.csi.volumeHandle }}
{{- else }}
{{- if (lookup "v1" "PersistentVolume" "" "opsera-shared-workspace") }}
{{- (lookup "v1" "PersistentVolume" "" "opsera-shared-workspace").spec.csi.volumeHandle }}
{{- else }}
{{- "" }}
{{- end }}
{{- end }}
{{- end }}
