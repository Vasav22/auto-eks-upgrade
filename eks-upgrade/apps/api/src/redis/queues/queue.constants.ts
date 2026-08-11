export const UPGRADE_POLL_QUEUE = 'upgrade-poll';
export const HEALTH_CHECK_QUEUE = 'health-check';
export const BACKUP_QUEUE = 'backup';
export const DISCOVERY_QUEUE = 'discovery';
export const PURGE_QUEUE = 'purge';

export const QUEUE_CONCURRENCY = {
  [UPGRADE_POLL_QUEUE]: 10,
  [HEALTH_CHECK_QUEUE]: 5,
  [BACKUP_QUEUE]: 3,
  [DISCOVERY_QUEUE]: 2,
  [PURGE_QUEUE]: 1,
} as const;

export const QUEUE_NAMES = [
  UPGRADE_POLL_QUEUE,
  HEALTH_CHECK_QUEUE,
  BACKUP_QUEUE,
  DISCOVERY_QUEUE,
  PURGE_QUEUE,
] as const;

export type QueueName = (typeof QUEUE_NAMES)[number];
