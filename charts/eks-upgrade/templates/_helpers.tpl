{{/*
Expand the name of the chart.
*/}}
{{- define "eks-upgrade.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "eks-upgrade.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s" .Chart.Name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{/*
Chart label
*/}}
{{- define "eks-upgrade.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "eks-upgrade.labels" -}}
helm.sh/chart: {{ include "eks-upgrade.chart" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
environment: {{ .Values.global.environment }}
cluster: {{ .Values.global.clusterName }}
{{- end }}

{{/*
Selector labels for a given component
Usage: include "eks-upgrade.selectorLabels" (dict "name" "eks-upgrade-api" "instance" .Release.Name)
*/}}
{{- define "eks-upgrade.selectorLabels" -}}
app.kubernetes.io/name: {{ .name }}
app.kubernetes.io/instance: {{ .instance }}
{{- end }}

{{/*
Image name helper — prepends global.imageRegistry if set
*/}}
{{- define "eks-upgrade.image" -}}
{{- $reg := .global.imageRegistry -}}
{{- if $reg -}}
{{- printf "%s/%s:%s" $reg .repository .tag -}}
{{- else -}}
{{- printf "%s:%s" .repository .tag -}}
{{- end }}
{{- end }}

{{/*
Namespace
*/}}
{{- define "eks-upgrade.namespace" -}}
{{- .Values.global.namespace }}
{{- end }}
