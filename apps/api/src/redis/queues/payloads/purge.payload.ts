export interface PurgePayload {
  dataCategory: 'logs' | 'audit' | 'events' | 'jobs' | 'backups';
  retentionDays: number;
}
