import { RoleName } from '../constants/roles';

export interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface OidcDiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  scopes_supported: string[];
  response_types_supported: string[];
  grant_types_supported: string[];
}

export interface TokenExchangeResult {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface IdTokenClaims {
  sub: string;
  email: string;
  name: string;
  groups?: string[];
  iss: string;
  aud: string;
  exp: number;
  iat: number;
}

export interface AuthenticatedUser {
  id: string;
  oidcSubject: string;
  email: string;
  displayName: string;
  role: RoleName;
  idpGroups: string[];
}

export interface AuditAuthEvent {
  actorId: string;
  actorRole: RoleName;
  action: string;
  resourceType: string;
  resourceId: string;
  changeDetail: {
    oidc_subject: string;
    email: string;
    idp_groups: string[];
    ip_address?: string;
    user_agent?: string;
  };
  requestId?: string;
  occurredAt: Date;
}

export interface PKCEChallenge {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
}
