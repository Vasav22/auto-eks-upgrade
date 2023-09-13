{{/* vim: set filetype=mustache: */}}

{{/*
Datadog APM Selector Labels
*/}}
{{- define "datadogApm.selectorLabels" -}}
{{- if .Values.datadogApm -}}
{{- if .Values.datadogApm.enabled -}}
tags.datadoghq.com/env: {{ .Values.clusterName }}
tags.datadoghq.com/service: {{ default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
tags.datadoghq.com/version: {{ .Values.image.tag }}
{{- end -}}
{{- end -}}
{{- end -}}

{{/*
Datadog APM Init Container
*/}}
{{- define "datadogApm.initContainer" -}}
{{- if .Values.datadogApm -}}
{{- if .Values.datadogApm.enabled -}}
initContainers:
- command:
  - sh
  - -c
  - |
    /bin/sh <<'EOF'
    cp /opt/dd-java-agent.jar /opt/dd-agent/dd-java-agent.jar
    EOF
  image: 440953937617.dkr.ecr.us-east-2.amazonaws.com/opsera-pipeline/datadog-apm-tracer-init:java-0.106.0
  imagePullPolicy: Always
  name: datadog-java-agent-copy
  resources: {}
  terminationMessagePath: /dev/termination-log
  terminationMessagePolicy: File
  volumeMounts:
  - mountPath: /opt/dd-agent
    name: dd-agent-path
{{- end -}}
{{- end -}}
{{- end -}}

{{/*
Datadog APM Init Container Extra
*/}}
{{- define "datadogApm.initContainerExtra" -}}
{{- if .Values.datadogApm -}}
{{- if .Values.datadogApm.enabled -}}
- command:
  - sh
  - -c
  - |
    /bin/sh <<'EOF'
    apt update && apt install -y curl
    curl -s -L -o /opt/dd-agent/dd-java-agent.jar 'https://dtdg.co/latest-java-tracer'
    EOF
  image: 440953937617.dkr.ecr.us-east-2.amazonaws.com/opsera-pipeline/ubuntu:latest
  imagePullPolicy: Always
  name: init-myservice
  resources: {}
  terminationMessagePath: /dev/termination-log
  terminationMessagePolicy: File
  volumeMounts:
  - mountPath: /opt/dd-agent
    name: dd-agent-path
{{- end -}}
{{- end -}}
{{- end -}}

{{/*
Datadog APM Container Volumes
*/}}
{{- define "datadogApm.volumes" -}}
{{- if .Values.datadogApm -}}
{{- if .Values.datadogApm.enabled -}}
- hostPath:
    path: /opt/dd-agent
    type: ""
  name: dd-agent-path
- hostPath:
    path: /var/run/datadog
    type: ""
  name: apmsocketpath
{{- end -}}
{{- end -}}
{{- end -}}

{{/*
Datadog APM Container Volume Mounts
*/}}
{{- define "datadogApm.volumeMounts" -}}
{{- if .Values.datadogApm -}}
{{- if .Values.datadogApm.enabled -}}
- mountPath: /var/run/datadog
  name: apmsocketpath
- mountPath: /opt/dd-agent
  name: dd-agent-path
{{- end -}}
{{- end -}}
{{- end -}}

{{/*
Datadog APM Environment Variable
*/}}
{{- define "datadogApm.environmentVars" -}}
{{- if .Values.datadogApm -}}
{{- if .Values.datadogApm.enabled -}}
- name: DD_ENV
  valueFrom:
    fieldRef:
      apiVersion: v1
      fieldPath: metadata.labels['tags.datadoghq.com/env']
- name: DD_SERVICE
  valueFrom:
    fieldRef:
      apiVersion: v1
      fieldPath: metadata.labels['tags.datadoghq.com/service']
- name: DD_VERSION
  valueFrom:
    fieldRef:
      apiVersion: v1
      fieldPath: metadata.labels['tags.datadoghq.com/version']
- name: DD_LOGS_INJECTION
  value: "true"
- name: DD_PROFILING_ENABLED
  value: "false"
- name: JAVA_OPTS
  value: "-javaagent:/opt/dd-agent/dd-java-agent.jar"
{{- end -}}
{{- end -}}
{{- end -}}
