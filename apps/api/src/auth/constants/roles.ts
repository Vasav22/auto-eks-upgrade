export const ROLES = {
  UPGRADE_OPERATOR: 'upgrade_operator',
  SRE_ONCALL: 'sre_oncall',
  CLUSTER_ADMIN: 'cluster_admin',
  CHANGE_COORDINATOR: 'change_coordinator',
  COMPLIANCE_REVIEWER: 'compliance_reviewer',
  // Aliases used across controllers
  ADMIN: 'admin',
  OPERATOR: 'operator',
  VIEWER: 'viewer',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

export interface GroupToRoleMapping {
  idpGroup: string;
  role: RoleName;
  priority: number;
}

// Default mapping (can be overridden via configuration)
export const DEFAULT_GROUP_MAPPINGS: GroupToRoleMapping[] = [
  { idpGroup: 'eks-cluster-admins', role: ROLES.CLUSTER_ADMIN, priority: 1 },
  { idpGroup: 'eks-change-coordinators', role: ROLES.CHANGE_COORDINATOR, priority: 2 },
  { idpGroup: 'eks-sre-oncall', role: ROLES.SRE_ONCALL, priority: 3 },
  { idpGroup: 'eks-upgrade-operators', role: ROLES.UPGRADE_OPERATOR, priority: 4 },
  { idpGroup: 'eks-compliance-reviewers', role: ROLES.COMPLIANCE_REVIEWER, priority: 5 },
];
