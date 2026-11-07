export const DEFAULT_BACKEND_ORIGIN = "http://localhost:8000";

export const backendOrigin = window.__API_BASE_ORIGIN__ || DEFAULT_BACKEND_ORIGIN;

export const API_BASE_URL = `${backendOrigin}/api`;
export const ADMIN_BASE_URL = `${backendOrigin}/admin/`;
export const SWAGGER_URL = `${backendOrigin}/swagger/`;
export const REDOC_URL = `${backendOrigin}/redoc/`;
export const OPENAPI_JSON_URL = `${backendOrigin}/swagger.json`;
export const OPENAPI_YAML_URL = `${backendOrigin}/swagger.yaml`;

// Google OAuth Client ID (puede sobreescribirse globalmente con window.__GOOGLE_CLIENT_ID__)
export const GOOGLE_CLIENT_ID = window.__GOOGLE_CLIENT_ID__ || "807644267079-4ngg37insa1biom4421bj7k2599v307s.apps.googleusercontent.com";
