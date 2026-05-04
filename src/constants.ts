export const SERVER_NAME = "oura-mcp-server";
export const SERVER_VERSION = "0.1.0";
export const NPM_PACKAGE_NAME = "oura-mcp-unofficial";
export const PINNED_NPM_PACKAGE = `${NPM_PACKAGE_NAME}@${SERVER_VERSION}`;

export const OURA_API_BASE_URL = "https://api.ouraring.com/v2";
export const OURA_AUTH_URL = "https://cloud.ouraring.com/oauth/authorize";
export const OURA_TOKEN_URL = "https://api.ouraring.com/oauth/token";
export const OURA_REVOKE_URL = "https://api.ouraring.com/oauth/revoke";
export const OURA_DEVELOPER_PORTAL_URL = "https://cloud.ouraring.com/oauth/applications";
export const OURA_DOCS_URL = "https://cloud.ouraring.com/docs/authentication";

export const DEFAULT_SCOPES = [
  "daily",
  "heartrate",
  "personal",
  "sleep",
  "workout",
  "spo2"
];

export const DEFAULT_LIMIT = 30;
export const MAX_OURA_LIMIT = 100;
export const DEFAULT_MAX_PAGES = 1;
export const MAX_PAGES = 10;
