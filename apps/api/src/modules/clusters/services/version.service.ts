import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EKSClient, DescribeAddonVersionsCommand } from '@aws-sdk/client-eks';

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

interface VersionMeta {
  releaseDate: string;
  endOfSupport: string;
}

@Injectable()
export class VersionService implements OnModuleInit {
  private readonly logger = new Logger(VersionService.name);
  private readonly MAX_VERSION_SKIP = 2;
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  /** Versions discovered from AWS. Sorted ascending. */
  private liveVersions: string[] = [];
  private cacheExpiresAt: Date | null = null;

  /**
   * Known EOS dates sourced from the EKS version lifecycle page:
   * https://docs.aws.amazon.com/eks/latest/userguide/kubernetes-versions.html
   * Update this table when AWS publishes new EOS dates.
   */
  private readonly VERSION_META: Record<string, VersionMeta> = {
    '1.24': { releaseDate: '2023-05-24', endOfSupport: '2024-07-31' },
    '1.25': { releaseDate: '2023-08-24', endOfSupport: '2025-02-15' },
    '1.26': { releaseDate: '2023-11-14', endOfSupport: '2025-06-11' },
    '1.27': { releaseDate: '2024-02-26', endOfSupport: '2025-07-26' },
    '1.28': { releaseDate: '2024-05-26', endOfSupport: '2025-11-26' },
    '1.29': { releaseDate: '2024-08-15', endOfSupport: '2026-03-23' },
    '1.30': { releaseDate: '2024-11-12', endOfSupport: '2026-07-12' },
    '1.31': { releaseDate: '2025-02-10', endOfSupport: '2026-10-10' },
    '1.32': { releaseDate: '2025-05-01', endOfSupport: '2027-01-15' },
    '1.33': { releaseDate: '2025-08-01', endOfSupport: '2027-04-15' },
    '1.34': { releaseDate: '2025-11-01', endOfSupport: '2027-07-15' },
    '1.35': { releaseDate: '2026-02-01', endOfSupport: '2027-10-15' },
    '1.36': { releaseDate: '2026-05-01', endOfSupport: '2028-01-15' },
    '1.37': { releaseDate: '2026-08-01', endOfSupport: '2028-04-15' },
    '1.38': { releaseDate: '2026-11-01', endOfSupport: '2028-07-15' },
  };

  async onModuleInit() {
    await this.refreshVersionsFromAws();
  }

  /**
   * Fetches the set of Kubernetes versions that EKS currently supports by
   * querying the vpc-cni addon's compatibility matrix. This is the recommended
   * way to discover supported cluster versions without scraping docs.
   */
  async refreshVersionsFromAws(): Promise<void> {
    try {
      const client = new EKSClient({ region: 'us-east-1' });
      const response = await client.send(
        new DescribeAddonVersionsCommand({ addonName: 'vpc-cni' }),
      );

      const versionSet = new Set<string>();
      for (const addon of response.addons ?? []) {
        for (const addonVersion of addon.addonVersions ?? []) {
          for (const compat of addonVersion.compatibilities ?? []) {
            const v = compat.clusterVersion;
            if (v && /^1\.\d+$/.test(v)) {
              versionSet.add(v);
            }
          }
        }
      }

      if (versionSet.size > 0) {
        this.liveVersions = Array.from(versionSet).sort((a, b) =>
          this.parseVersion(a) - this.parseVersion(b),
        );
        this.cacheExpiresAt = new Date(Date.now() + this.CACHE_TTL_MS);
        this.logger.log(
          `Fetched ${this.liveVersions.length} supported EKS versions from AWS: ${this.liveVersions.join(', ')}`,
        );
      } else {
        this.logger.warn('AWS returned no addon versions; falling back to static list');
        this.useFallback();
      }
    } catch (err) {
      this.logger.warn(
        `Could not fetch EKS versions from AWS (${(err as Error).message}); using static fallback`,
      );
      this.useFallback();
    }
  }

  private useFallback(): void {
    this.liveVersions = Object.keys(this.VERSION_META).sort(
      (a, b) => this.parseVersion(a) - this.parseVersion(b),
    );
    // Short TTL so we retry AWS soon
    this.cacheExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
  }

  private getVersions(): string[] {
    if (!this.cacheExpiresAt || new Date() > this.cacheExpiresAt) {
      // Trigger background refresh; serve stale list for this request
      void this.refreshVersionsFromAws();
    }
    return this.liveVersions.length > 0
      ? this.liveVersions
      : Object.keys(this.VERSION_META).sort(
          (a, b) => this.parseVersion(a) - this.parseVersion(b),
        );
  }

  computeEligibleVersions(currentVersion: string): ClusterVersionInfo {
    const currentMinor = this.parseVersion(currentVersion);
    const now = new Date();
    const allVersions = this.getVersions();

    const enriched = allVersions.map((version) => {
      const meta = this.VERSION_META[version];
      const endOfSupport = meta?.endOfSupport ?? '2099-01-01';
      const releaseDate = meta?.releaseDate ?? '2020-01-01';
      const isSupported = new Date(endOfSupport) > now;
      return { version, minor: this.parseVersion(version), releaseDate, endOfSupport, isSupported };
    });

    const eligibleVersions = enriched
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
      eligibleVersions.find((v) => v.isRecommended)?.version ?? null;

    const canUpgrade = eligibleVersions.length > 0;

    const currentMeta = enriched.find((v) => v.minor === currentMinor);
    let supportStatus: 'supported' | 'deprecated' | 'unsupported';
    if (!currentMeta || !currentMeta.isSupported) {
      supportStatus = 'unsupported';
    } else {
      const daysUntilEOS = Math.floor(
        (new Date(currentMeta.endOfSupport).getTime() - now.getTime()) /
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
      const minor = this.parseVersion(version);
      return this.getVersions().some((v) => this.parseVersion(v) === minor);
    } catch {
      return false;
    }
  }

  canUpgradeDirectly(fromVersion: string, toVersion: string): boolean {
    try {
      const diff = this.parseVersion(toVersion) - this.parseVersion(fromVersion);
      return diff > 0 && diff <= this.MAX_VERSION_SKIP;
    } catch {
      return false;
    }
  }
}
