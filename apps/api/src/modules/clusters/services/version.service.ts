import { Injectable, Logger } from '@nestjs/common';

export interface EligibleVersion {
  version: string;
  isRecommended: boolean;
  releaseDate: string;
  endOfSupport: string;
  isSupported: boolean;
}

export interface ClusterVersionInfo {
  currentVersion: string;
  eligibleVersions: EligibleVersion[];
  recommendedVersion: string | null;
  maxSkip: number;
  canUpgrade: boolean;
  supportStatus: 'supported' | 'deprecated' | 'unsupported';
}

@Injectable()
export class VersionService {
  private readonly logger = new Logger(VersionService.name);

  private readonly EKS_VERSIONS = [
    {
      version: '1.24',
      releaseDate: '2023-05-24',
      endOfSupport: '2024-07-31',
    },
    {
      version: '1.25',
      releaseDate: '2023-08-24',
      endOfSupport: '2025-02-15',
    },
    {
      version: '1.26',
      releaseDate: '2023-11-14',
      endOfSupport: '2025-06-11',
    },
    {
      version: '1.27',
      releaseDate: '2024-02-26',
      endOfSupport: '2025-07-26',
    },
    {
      version: '1.28',
      releaseDate: '2024-05-26',
      endOfSupport: '2025-11-26',
    },
    {
      version: '1.29',
      releaseDate: '2024-08-15',
      endOfSupport: '2026-03-23',
    },
    {
      version: '1.30',
      releaseDate: '2024-11-12',
      endOfSupport: '2026-07-12',
    },
    {
      version: '1.31',
      releaseDate: '2025-02-10',
      endOfSupport: '2026-10-10',
    },
    {
      version: '1.32',
      releaseDate: '2025-05-01',
      endOfSupport: '2027-01-15',
    },
    {
      version: '1.33',
      releaseDate: '2025-08-01',
      endOfSupport: '2027-04-15',
    },
    {
      version: '1.34',
      releaseDate: '2025-11-01',
      endOfSupport: '2027-07-15',
    },
    {
      version: '1.35',
      releaseDate: '2026-02-01',
      endOfSupport: '2027-10-15',
    },
  ];

  private readonly MAX_VERSION_SKIP = 2;

  computeEligibleVersions(currentVersion: string): ClusterVersionInfo {
    const currentMinor = this.parseVersion(currentVersion);
    const now = new Date();

    const allVersions = this.EKS_VERSIONS.map((v) => {
      const minor = this.parseVersion(v.version);
      const endOfSupport = new Date(v.endOfSupport);
      const isSupported = endOfSupport > now;

      return {
        version: v.version,
        minor,
        releaseDate: v.releaseDate,
        endOfSupport: v.endOfSupport,
        isSupported,
      };
    });

    const eligibleVersions = allVersions
      .filter((v) => {
        const diff = v.minor - currentMinor;
        return diff > 0 && diff <= this.MAX_VERSION_SKIP;
      })
      .map((v) => ({
        version: v.version,
        isRecommended: v.minor === currentMinor + 1,
        releaseDate: v.releaseDate,
        endOfSupport: v.endOfSupport,
        isSupported: v.isSupported,
      }));

    const recommendedVersion =
      eligibleVersions.find((v) => v.isRecommended)?.version || null;

    const canUpgrade = eligibleVersions.length > 0;

    const currentVersionInfo = allVersions.find(
      (v) => v.minor === currentMinor,
    );

    let supportStatus: 'supported' | 'deprecated' | 'unsupported';
    if (!currentVersionInfo) {
      supportStatus = 'unsupported';
    } else if (!currentVersionInfo.isSupported) {
      supportStatus = 'unsupported';
    } else {
      const daysUntilEOS = Math.floor(
        (new Date(currentVersionInfo.endOfSupport).getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      supportStatus = daysUntilEOS < 90 ? 'deprecated' : 'supported';
    }

    return {
      currentVersion,
      eligibleVersions,
      recommendedVersion,
      maxSkip: this.MAX_VERSION_SKIP,
      canUpgrade,
      supportStatus,
    };
  }

  private parseVersion(version: string): number {
    const match = version.match(/^1\.(\d+)/);
    if (!match) {
      throw new Error(`Invalid version format: ${version}`);
    }
    return parseInt(match[1], 10);
  }

  isVersionValid(version: string): boolean {
    try {
      this.parseVersion(version);
      return this.EKS_VERSIONS.some((v) => v.version === version);
    } catch {
      return false;
    }
  }

  canUpgradeDirectly(fromVersion: string, toVersion: string): boolean {
    try {
      const fromMinor = this.parseVersion(fromVersion);
      const toMinor = this.parseVersion(toVersion);
      const diff = toMinor - fromMinor;
      return diff > 0 && diff <= this.MAX_VERSION_SKIP;
    } catch {
      return false;
    }
  }
}
