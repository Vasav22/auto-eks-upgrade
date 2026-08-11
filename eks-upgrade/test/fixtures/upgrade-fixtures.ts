import {
  UpgradeJob,
  UpgradeEvent,
} from '../../apps/api/src/database/entities';

export function createUpgradeJob(
  overrides?: Partial<UpgradeJob>,
): Partial<UpgradeJob> {
  return {
    id: 'job-uuid-001',
    clusterId: 'cluster-uuid-001',
    nodeGroupId: null,
    jobType: 'control_plane',
    fromVersion: '1.28',
    toVersion: '1.29',
    status: 'pending',
    awsUpdateId: null,
    initiatedBy: 'user-uuid-001',
    campaignId: null,
    backupId: null,
    dryRunId: null,
    errorDetail: null,
    startedAt: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createUpgradeEvent(
  overrides?: Partial<UpgradeEvent>,
): Partial<UpgradeEvent> {
  return {
    id: 'event-uuid-001',
    jobId: 'job-uuid-001',
    eventType: 'status_change',
    message: 'Upgrade job status changed to in_progress',
    details: {
      previous_status: 'pending',
      new_status: 'in_progress',
    },
    occurredAt: new Date(),
    ...overrides,
  };
}

export function createSampleUpgradeJobs(): Partial<UpgradeJob>[] {
  const now = new Date();

  return [
    // Pending job
    createUpgradeJob({
      id: 'job-pending-001',
      clusterId: 'cluster-prod-001',
      fromVersion: '1.28',
      toVersion: '1.29',
      status: 'pending',
      initiatedBy: 'user-operator-001',
      createdAt: new Date(now.getTime() - 3600000), // 1 hour ago
    }),

    // In-progress job
    createUpgradeJob({
      id: 'job-inprogress-001',
      clusterId: 'cluster-staging-001',
      fromVersion: '1.29',
      toVersion: '1.30',
      status: 'in_progress',
      awsUpdateId: 'update-abc123',
      initiatedBy: 'user-operator-002',
      startedAt: new Date(now.getTime() - 1800000), // 30 mins ago
      createdAt: new Date(now.getTime() - 2400000), // 40 mins ago
    }),

    // Succeeded job
    createUpgradeJob({
      id: 'job-succeeded-001',
      clusterId: 'cluster-dev-001',
      fromVersion: '1.27',
      toVersion: '1.28',
      status: 'succeeded',
      awsUpdateId: 'update-def456',
      initiatedBy: 'user-operator-001',
      startedAt: new Date(now.getTime() - 7200000), // 2 hours ago
      completedAt: new Date(now.getTime() - 3600000), // 1 hour ago
      createdAt: new Date(now.getTime() - 10800000), // 3 hours ago
    }),

    // Failed job
    createUpgradeJob({
      id: 'job-failed-001',
      clusterId: 'cluster-staging-002',
      fromVersion: '1.28',
      toVersion: '1.29',
      status: 'failed',
      awsUpdateId: 'update-ghi789',
      initiatedBy: 'user-operator-003',
      errorDetail: {
        error_code: 'ResourceInUseException',
        error_message: 'Cluster has in-progress update',
        aws_request_id: 'req-xyz-789',
      },
      startedAt: new Date(now.getTime() - 86400000), // 1 day ago
      completedAt: new Date(now.getTime() - 82800000), // 23 hours ago
      createdAt: new Date(now.getTime() - 90000000), // 25 hours ago
    }),

    // Cancelled job
    createUpgradeJob({
      id: 'job-cancelled-001',
      clusterId: 'cluster-prod-002',
      fromVersion: '1.28',
      toVersion: '1.29',
      status: 'cancelled',
      awsUpdateId: 'update-jkl012',
      initiatedBy: 'user-sre-001',
      startedAt: new Date(now.getTime() - 172800000), // 2 days ago
      completedAt: new Date(now.getTime() - 172000000), // ~2 days ago
      createdAt: new Date(now.getTime() - 180000000), // ~2 days ago
    }),
  ];
}

export function createSampleUpgradeEvents(): Partial<UpgradeEvent>[] {
  const jobs = createSampleUpgradeJobs();
  const events: Partial<UpgradeEvent>[] = [];

  // Events for pending job
  const pendingJob = jobs[0];
  const pendingJobTime = new Date((pendingJob.createdAt as Date).getTime());
  events.push(
    createUpgradeEvent({
      id: 'event-pending-001',
      jobId: pendingJob.id,
      eventType: 'job_created',
      message: 'Upgrade job created',
      details: { from_version: '1.28', to_version: '1.29' },
      occurredAt: pendingJobTime,
    }),
  );

  // Events for in-progress job
  const inProgressJob = jobs[1];
  const inProgressTime = new Date((inProgressJob.createdAt as Date).getTime());
  for (let i = 0; i < 15; i++) {
    events.push(
      createUpgradeEvent({
        id: `event-inprogress-${String(i).padStart(3, '0')}`,
        jobId: inProgressJob.id,
        eventType: i === 0 ? 'job_created' : i === 1 ? 'validation_started' : i === 2 ? 'backup_started' : i === 3 ? 'backup_completed' : i === 4 ? 'upgrade_started' : 'progress_update',
        message: i === 0 ? 'Upgrade job created' : i === 1 ? 'Validation started' : i === 2 ? 'Backup started' : i === 3 ? 'Backup completed' : i === 4 ? 'Upgrade started' : `Progress: ${i * 5}%`,
        details: i >= 5 ? { progress_percentage: i * 5 } : null,
        occurredAt: new Date(inProgressTime.getTime() + i * 120000),
      }),
    );
  }

  // Events for succeeded job
  const succeededJob = jobs[2];
  const succeededTime = new Date((succeededJob.createdAt as Date).getTime());
  for (let i = 0; i < 20; i++) {
    events.push(
      createUpgradeEvent({
        id: `event-succeeded-${String(i).padStart(3, '0')}`,
        jobId: succeededJob.id,
        eventType: i === 0 ? 'job_created' : i === 19 ? 'job_completed' : 'progress_update',
        message: i === 0 ? 'Upgrade job created' : i === 19 ? 'Upgrade completed successfully' : `Progress: ${i * 5}%`,
        details: i === 19 ? { duration_seconds: 3600 } : { progress_percentage: i * 5 },
        occurredAt: new Date(succeededTime.getTime() + i * 180000),
      }),
    );
  }

  // Events for failed job
  const failedJob = jobs[3];
  const failedTime = new Date((failedJob.createdAt as Date).getTime());
  for (let i = 0; i < 10; i++) {
    events.push(
      createUpgradeEvent({
        id: `event-failed-${String(i).padStart(3, '0')}`,
        jobId: failedJob.id,
        eventType: i === 0 ? 'job_created' : i === 9 ? 'job_failed' : 'progress_update',
        message: i === 0 ? 'Upgrade job created' : i === 9 ? 'Upgrade failed: ResourceInUseException' : `Progress: ${i * 10}%`,
        details: i === 9 ? { error_code: 'ResourceInUseException' } : null,
        occurredAt: new Date(failedTime.getTime() + i * 360000),
      }),
    );
  }

  // Events for cancelled job
  const cancelledJob = jobs[4];
  const cancelledTime = new Date((cancelledJob.createdAt as Date).getTime());
  for (let i = 0; i < 5; i++) {
    events.push(
      createUpgradeEvent({
        id: `event-cancelled-${String(i).padStart(3, '0')}`,
        jobId: cancelledJob.id,
        eventType: i === 0 ? 'job_created' : i === 4 ? 'job_cancelled' : 'progress_update',
        message: i === 0 ? 'Upgrade job created' : i === 4 ? 'Upgrade cancelled by operator' : `Progress: ${i * 20}%`,
        details: i === 4 ? { cancelled_by: 'user-sre-001' } : null,
        occurredAt: new Date(cancelledTime.getTime() + i * 600000),
      }),
    );
  }

  return events;
}

export const UPGRADE_JOB_TYPES = ['control_plane', 'node_group'] as const;

export const UPGRADE_JOB_STATUSES = [
  'pending',
  'validating',
  'backing_up',
  'in_progress',
  'succeeded',
  'failed',
  'cancelled',
] as const;

export const UPGRADE_EVENT_TYPES = [
  'job_created',
  'validation_started',
  'validation_completed',
  'validation_failed',
  'backup_started',
  'backup_completed',
  'backup_failed',
  'upgrade_started',
  'progress_update',
  'health_check_passed',
  'health_check_failed',
  'rollback_initiated',
  'rollback_completed',
  'job_completed',
  'job_failed',
  'job_cancelled',
] as const;
