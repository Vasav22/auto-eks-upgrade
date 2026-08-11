import { Injectable, Logger, BadRequestException } from '@nestjs/common';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface VersionSkewValidation extends ValidationResult {
  controlPlaneVersion: string;
  nodeGroupVersions: string[];
  maxSkew: number;
}

@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);
  private readonly MAX_NODE_SKEW = 2;
  private readonly MAX_CONTROL_PLANE_SKIP = 2;

  /**
   * BR-01: EKS Version-Skew Validation
   * Validates that node groups are within 2 minor versions of control plane
   */
  validateVersionSkew(
    controlPlaneVersion: string,
    nodeGroupVersions: string[],
  ): VersionSkewValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    const controlPlaneMinor = this.parseMinorVersion(controlPlaneVersion);

    for (const nodeVersion of nodeGroupVersions) {
      const nodeMinor = this.parseMinorVersion(nodeVersion);
      const skew = controlPlaneMinor - nodeMinor;

      if (skew < 0) {
        errors.push(
          `Node group version ${nodeVersion} is ahead of control plane ${controlPlaneVersion}`,
        );
      } else if (skew > this.MAX_NODE_SKEW) {
        errors.push(
          `Node group version ${nodeVersion} is ${skew} versions behind control plane ${controlPlaneVersion} (max ${this.MAX_NODE_SKEW})`,
        );
      } else if (skew === this.MAX_NODE_SKEW) {
        warnings.push(
          `Node group version ${nodeVersion} is at maximum skew (${this.MAX_NODE_SKEW} versions behind)`,
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      controlPlaneVersion,
      nodeGroupVersions,
      maxSkew: this.MAX_NODE_SKEW,
    };
  }

  /**
   * BR-02: Validate all node groups are aligned before control plane upgrade
   */
  validateNodeGroupAlignment(nodeGroupVersions: string[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (nodeGroupVersions.length === 0) {
      return { isValid: true, errors, warnings };
    }

    const uniqueVersions = [...new Set(nodeGroupVersions)];

    if (uniqueVersions.length > 1) {
      errors.push(
        `All node groups must be on the same version. Found: ${uniqueVersions.join(', ')}`,
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * BR-03/BR-04: Validate node group version ceilings
   * Node groups can be upgraded if they're within skew limits of current control plane
   */
  validateNodeGroupUpgrade(
    currentNodeVersion: string,
    targetNodeVersion: string,
    controlPlaneVersion: string,
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const currentMinor = this.parseMinorVersion(currentNodeVersion);
    const targetMinor = this.parseMinorVersion(targetNodeVersion);
    const controlPlaneMinor = this.parseMinorVersion(controlPlaneVersion);

    // Can't upgrade past control plane
    if (targetMinor > controlPlaneMinor) {
      errors.push(
        `Cannot upgrade node group to ${targetNodeVersion} - exceeds control plane version ${controlPlaneVersion}`,
      );
    }

    // Can't skip more than 2 versions
    const skipCount = targetMinor - currentMinor;
    if (skipCount > this.MAX_CONTROL_PLANE_SKIP) {
      errors.push(
        `Cannot skip ${skipCount} versions (max ${this.MAX_CONTROL_PLANE_SKIP}). Current: ${currentNodeVersion}, Target: ${targetNodeVersion}`,
      );
    }

    if (skipCount < 0) {
      errors.push(
        `Cannot downgrade node group from ${currentNodeVersion} to ${targetNodeVersion}`,
      );
    }

    if (targetMinor === controlPlaneMinor) {
      warnings.push(
        `Node group will be at the same version as control plane after upgrade`,
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate control plane upgrade path
   */
  validateControlPlaneUpgrade(
    currentVersion: string,
    targetVersion: string,
    nodeGroupVersions: string[],
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const currentMinor = this.parseMinorVersion(currentVersion);
    const targetMinor = this.parseMinorVersion(targetVersion);

    // Validate version skip
    const skipCount = targetMinor - currentMinor;
    if (skipCount > this.MAX_CONTROL_PLANE_SKIP) {
      errors.push(
        `Cannot skip ${skipCount} versions (max ${this.MAX_CONTROL_PLANE_SKIP}). Must upgrade incrementally.`,
      );
    }

    if (skipCount <= 0) {
      errors.push(
        `Invalid upgrade path from ${currentVersion} to ${targetVersion}`,
      );
    }

    // Validate node group alignment (BR-02)
    const alignmentResult = this.validateNodeGroupAlignment(nodeGroupVersions);
    errors.push(...alignmentResult.errors);
    warnings.push(...alignmentResult.warnings);

    // Validate post-upgrade skew
    for (const nodeVersion of nodeGroupVersions) {
      const nodeMinor = this.parseMinorVersion(nodeVersion);
      const postUpgradeSkew = targetMinor - nodeMinor;

      if (postUpgradeSkew > this.MAX_NODE_SKEW) {
        errors.push(
          `Upgrading to ${targetVersion} would create skew of ${postUpgradeSkew} with node group ${nodeVersion} (max ${this.MAX_NODE_SKEW})`,
        );
        errors.push(
          `Must upgrade node groups first before upgrading control plane to ${targetVersion}`,
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private parseMinorVersion(version: string): number {
    const match = version.match(/^1\.(\d+)/);
    if (!match) {
      throw new BadRequestException(`Invalid version format: ${version}`);
    }
    return parseInt(match[1], 10);
  }
}
