import { Injectable, Logger } from '@nestjs/common';
import * as yaml from 'js-yaml';

export interface HelmChartConfig {
  name: string;
  version: string;
  namespace: string;
  replicas: number;
  image: {
    repository: string;
    tag: string;
    pullPolicy: string;
  };
  resources: {
    requests: {
      cpu: string;
      memory: string;
    };
    limits: {
      cpu: string;
      memory: string;
    };
  };
  service: {
    type: string;
    port: number;
    targetPort: number;
  };
  ingress?: {
    enabled: boolean;
    host?: string;
    path?: string;
    tls?: boolean;
  };
  env?: Record<string, string>;
  secrets?: Record<string, string>;
}

@Injectable()
export class HelmTemplateService {
  private readonly logger = new Logger(HelmTemplateService.name);

  generateChart(config: HelmChartConfig): Record<string, string> {
    const files: Record<string, string> = {};

    files['Chart.yaml'] = this.generateChartYaml(config);
    files['values.yaml'] = this.generateValuesYaml(config);
    files['templates/deployment.yaml'] = this.generateDeploymentYaml(config);
    files['templates/service.yaml'] = this.generateServiceYaml(config);
    files['templates/_helpers.tpl'] = this.generateHelpersTpl(config);

    if (config.ingress?.enabled) {
      files['templates/ingress.yaml'] = this.generateIngressYaml(config);
    }

    if (config.secrets && Object.keys(config.secrets).length > 0) {
      files['templates/secret.yaml'] = this.generateSecretYaml(config);
    }

    if (config.env && Object.keys(config.env).length > 0) {
      files['templates/configmap.yaml'] = this.generateConfigMapYaml(config);
    }

    this.logger.log(`Generated Helm chart for ${config.name}`);

    return files;
  }

  private generateChartYaml(config: HelmChartConfig): string {
    const chart = {
      apiVersion: 'v2',
      name: config.name,
      description: `Helm chart for ${config.name}`,
      type: 'application',
      version: config.version,
      appVersion: config.image.tag,
    };

    return yaml.dump(chart);
  }

  private generateValuesYaml(config: HelmChartConfig): string {
    const values = {
      replicaCount: config.replicas,
      image: {
        repository: config.image.repository,
        pullPolicy: config.image.pullPolicy,
        tag: config.image.tag,
      },
      service: {
        type: config.service.type,
        port: config.service.port,
        targetPort: config.service.targetPort,
      },
      resources: config.resources,
      ingress: config.ingress || { enabled: false },
    };

    return yaml.dump(values);
  }

  private generateDeploymentYaml(config: HelmChartConfig): string {
    const deployment = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: '{{ include "chart.fullname" . }}',
        labels: {
          '{{- include "chart.labels" . | nindent 4 }}': null,
        },
      },
      spec: {
        replicas: '{{ .Values.replicaCount }}',
        selector: {
          matchLabels: {
            '{{- include "chart.selectorLabels" . | nindent 6 }}': null,
          },
        },
        template: {
          metadata: {
            labels: {
              '{{- include "chart.selectorLabels" . | nindent 8 }}': null,
            },
          },
          spec: {
            containers: [
              {
                name: config.name,
                image: '{{ .Values.image.repository }}:{{ .Values.image.tag }}',
                imagePullPolicy: '{{ .Values.image.pullPolicy }}',
                ports: [
                  {
                    name: 'http',
                    containerPort: '{{ .Values.service.targetPort }}',
                    protocol: 'TCP',
                  },
                ],
                resources: '{{- toYaml .Values.resources | nindent 12 }}',
              },
            ],
          },
        },
      },
    };

    return yaml.dump(deployment);
  }

  private generateServiceYaml(config: HelmChartConfig): string {
    const service = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: '{{ include "chart.fullname" . }}',
        labels: {
          '{{- include "chart.labels" . | nindent 4 }}': null,
        },
      },
      spec: {
        type: '{{ .Values.service.type }}',
        ports: [
          {
            port: '{{ .Values.service.port }}',
            targetPort: 'http',
            protocol: 'TCP',
            name: 'http',
          },
        ],
        selector: {
          '{{- include "chart.selectorLabels" . | nindent 4 }}': null,
        },
      },
    };

    return yaml.dump(service);
  }

  private generateIngressYaml(config: HelmChartConfig): string {
    const ingress = {
      '{{- if .Values.ingress.enabled -}}': null,
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: {
        name: '{{ include "chart.fullname" . }}',
        labels: {
          '{{- include "chart.labels" . | nindent 4 }}': null,
        },
      },
      spec: {
        rules: [
          {
            host: '{{ .Values.ingress.host }}',
            http: {
              paths: [
                {
                  path: '{{ .Values.ingress.path | default "/" }}',
                  pathType: 'Prefix',
                  backend: {
                    service: {
                      name: '{{ include "chart.fullname" . }}',
                      port: {
                        number: '{{ .Values.service.port }}',
                      },
                    },
                  },
                },
              ],
            },
          },
        ],
      },
      '{{- end }}': null,
    };

    return yaml.dump(ingress);
  }

  private generateSecretYaml(config: HelmChartConfig): string {
    const secret = {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name: '{{ include "chart.fullname" . }}',
        labels: {
          '{{- include "chart.labels" . | nindent 4 }}': null,
        },
      },
      type: 'Opaque',
      data: {},
    };

    return yaml.dump(secret);
  }

  private generateConfigMapYaml(config: HelmChartConfig): string {
    const configMap = {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: '{{ include "chart.fullname" . }}',
        labels: {
          '{{- include "chart.labels" . | nindent 4 }}': null,
        },
      },
      data: {},
    };

    return yaml.dump(configMap);
  }

  private generateHelpersTpl(config: HelmChartConfig): string {
    return `{{/*
Expand the name of the chart.
*/}}
{{- define "chart.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "chart.fullname" -}}
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
{{- define "chart.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "chart.labels" -}}
helm.sh/chart: {{ include "chart.chart" . }}
{{ include "chart.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "chart.selectorLabels" -}}
app.kubernetes.io/name: {{ include "chart.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
`;
  }
}
