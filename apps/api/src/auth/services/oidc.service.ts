import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  OidcConfig,
  OidcDiscoveryDocument,
  PKCEChallenge,
} from '../interfaces/auth.interfaces';

@Injectable()
export class OidcService {
  private readonly logger = new Logger(OidcService.name);
  private discoveryDocument: OidcDiscoveryDocument | null = null;

  constructor(private configService: ConfigService) {}

  async getDiscoveryDocument(): Promise<OidcDiscoveryDocument> {
    if (this.discoveryDocument) {
      return this.discoveryDocument;
    }

    const issuer = this.configService.get<string>('OIDC_ISSUER_URL');
    if (!issuer) {
      throw new Error('OIDC_ISSUER_URL not configured');
    }

    try {
      const discoveryUrl = `${issuer}/.well-known/openid-configuration`;
      const response = await fetch(discoveryUrl);

      if (!response.ok) {
        throw new Error(`Discovery document fetch failed: ${response.statusText}`);
      }

      this.discoveryDocument = await response.json() as OidcDiscoveryDocument;
      this.logger.log(`OIDC discovery document loaded from ${issuer}`);

      return this.discoveryDocument;
    } catch (error: unknown) {
      this.logger.error(`Failed to fetch OIDC discovery document: ${(error as Error).message}`);
      throw error;
    }
  }

  generatePKCEChallenge(): PKCEChallenge {
    const codeVerifier = this.base64URLEncode(crypto.randomBytes(32));
    const hash = crypto.createHash('sha256').update(codeVerifier).digest();
    const codeChallenge = this.base64URLEncode(hash);

    return {
      codeVerifier,
      codeChallenge,
      codeChallengeMethod: 'S256',
    };
  }

  async buildAuthorizationUrl(state: string, pkceChallenge: PKCEChallenge): Promise<string> {
    const discovery = await this.getDiscoveryDocument();
    const clientId = this.configService.get<string>('OIDC_CLIENT_ID');
    const redirectUri = this.configService.get<string>('OIDC_REDIRECT_URI');
    const scopes = ['openid', 'profile', 'email', 'groups'];

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId!,
      redirect_uri: redirectUri!,
      scope: scopes.join(' '),
      state,
      code_challenge: pkceChallenge.codeChallenge,
      code_challenge_method: pkceChallenge.codeChallengeMethod,
    });

    return `${discovery.authorization_endpoint}?${params.toString()}`;
  }

  private base64URLEncode(buffer: Buffer): string {
    return buffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
}
