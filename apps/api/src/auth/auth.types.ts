export interface GoogleProfile {
  id: string;
  displayName: string;
  emails?: Array<{ value: string; verified: boolean }>;
}

export interface JwtPayload {
  sub: string;
  email: string;
  organizationId: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  organizationId: string;
  role: string;
}

/**
 * The `GET /api/me` session view: JWT claims enriched with the user's
 * current department assignments. Department scope is resolved fresh from
 * the UserDepartment table on every request (see UserService) rather than
 * signed into the JWT, so admin reassignment takes effect without a token
 * refresh.
 */
export interface SessionResponseDto extends AuthenticatedUser {
  departmentIds: string[];
  primaryDepartmentId: string | null;
}

/** One-time code exchanged by the web callback for a session JWT. */
export interface ExchangeSessionResponse {
  accessToken: string;
}
