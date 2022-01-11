{{/* vim: set filetype=mustache: */}}
{{/*
Expand the name of the chart.
*/}}
{{- define "opsera-jenkins-integrator.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "opsera-jenkins-integrator.fullname" -}}
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
{{- define "opsera-jenkins-integrator.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Common labels
*/}}
{{- define "opsera-jenkins-integrator.labels" -}}
helm.sh/chart: {{ include "opsera-jenkins-integrator.chart" . }}
tags.datadoghq.com/env: {{ .Values.datadog.metadata.tags.env }}
tags.datadoghq.com/service: {{ .Values.datadog.metadata.tags.service }}
tags.datadoghq.com/version: {{ .Values.datadog.metadata.tags.version }}
{{ include "opsera-jenkins-integrator.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{/*
Selector labels
*/}}
{{- define "opsera-jenkins-integrator.selectorLabels" -}}
app.kubernetes.io/name: {{ include "opsera-jenkins-integrator.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
tags.datadoghq.com/env: {{ .Values.datadog.metadata.tags.env }}
tags.datadoghq.com/service: {{ .Values.datadog.metadata.tags.service }}
tags.datadoghq.com/version: {{ .Values.datadog.metadata.tags.version }}
{{- end -}}

{{/*
Create the name of the service account to use
*/}}
{{- define "opsera-jenkins-integrator.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
    {{ default (include "opsera-jenkins-integrator.fullname" .) .Values.serviceAccount.name }}
{{- else -}}
    {{ default "default" .Values.serviceAccount.name }}
{{- end -}}
{{- end -}}
