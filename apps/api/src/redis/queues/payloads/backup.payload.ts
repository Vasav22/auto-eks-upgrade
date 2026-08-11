export interface BackupPayload {
  clusterId: string;
  backupScope: 'full' | 'incremental' | 'config-only';
  storageLocation: string;
}
