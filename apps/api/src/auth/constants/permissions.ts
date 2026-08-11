export const PERMISSIONS = {
  // Cluster management
  CLUSTER_VIEW: 'cluster:view',
  CLUSTER_REGISTER: 'cluster:register',
  CLUSTER_UNREGISTER: 'cluster:unregister',

  // Upgrade operations
  UPGRADE_EXECUTE_NONPROD: 'upgrade:execute:nonprod',
  UPGRADE_EXECUTE_PROD: 'upgrade:execute:prod',
  UPGRADE_VIEW: 'upgrade:view',
  UPGRADE_CANCEL: 'upgrade:cancel',
  UPGRADE_ROLLBACK: 'upgrade:rollback',

  // Health and remediation
  HEALTH_VIEW: 'health:view',
  REMEDIATION_APPROVE_NONDESTRUCTIVE: 'remediation:approve:nondestructive',
  REMEDIATION_APPROVE_DESTRUCTIVE: 'remediation:approve:destructive',

  // Backup management
  BACKUP_MANAGE: 'backup:manage',
  BACKUP_VIEW: 'backup:view',

  // Scheduling and campaigns
  SCHEDULE_MANAGE: 'schedule:manage',
  SCHEDULE_VIEW: 'schedule:view',
  CAMPAIGN_MANAGE: 'campaign:manage',
  CAMPAIGN_VIEW: 'campaign:view',

  // Audit and compliance
  AUDIT_VIEW: 'audit:view',
  AUDIT_EXPORT: 'audit:export',

  // Admin actions
  ADMIN_USER_MANAGE: 'admin:user:manage',
  ADMIN_CONFIG_MANAGE: 'admin:config:manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
