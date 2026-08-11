import { Injectable, Logger } from '@nestjs/common';
import { DEFAULT_GROUP_MAPPINGS, GroupToRoleMapping, RoleName } from '../constants/roles';

@Injectable()
export class RoleMapperService {
  private readonly logger = new Logger(RoleMapperService.name);
  private mappings: GroupToRoleMapping[] = DEFAULT_GROUP_MAPPINGS;

  mapGroupsToRole(idpGroups: string[]): RoleName {
    if (!idpGroups || idpGroups.length === 0) {
      throw new Error('No IdP groups provided for role mapping');
    }

    // Find all matching mappings
    const matchedMappings = this.mappings.filter((mapping) =>
      idpGroups.includes(mapping.idpGroup),
    );

    if (matchedMappings.length === 0) {
      throw new Error(
        `No role mapping found for IdP groups: ${idpGroups.join(', ')}`,
      );
    }

    // Return highest priority (lowest priority number) role
    matchedMappings.sort((a, b) => a.priority - b.priority);
    const selectedMapping = matchedMappings[0];

    this.logger.log(
      `Mapped groups ${idpGroups.join(', ')} to role ${selectedMapping.role}`,
    );

    return selectedMapping.role;
  }

  setMappings(mappings: GroupToRoleMapping[]): void {
    this.mappings = mappings;
    this.logger.log(`Updated role mappings with ${mappings.length} entries`);
  }
}
