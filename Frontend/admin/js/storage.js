const ACCESS_TOKEN_KEY = "cc_access_token";
const REFRESH_TOKEN_KEY = "cc_refresh_token";
const CURRENT_USER_KEY = "cc_current_user";
const CURRENT_USER_GROUPS_KEY = "cc_current_user_groups";

function normalizeToken(token) {
  if (!token) {
    return "";
  }

  if (typeof token !== "string") {
    return String(token).trim();
  }

  // Accept values like "Bearer <jwt>" and persist only the JWT payload.
  return token.replace(/^Bearer\s+/i, "").trim();
}

export function setAccessToken(token) {
  const normalized = normalizeToken(token);
  if (normalized) {
    localStorage.setItem(ACCESS_TOKEN_KEY, normalized);
  }
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setRefreshToken(token) {
  const normalized = normalizeToken(token);
  if (normalized) {
    localStorage.setItem(REFRESH_TOKEN_KEY, normalized);
  }
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function setCurrentUser(user) {
  if (!user || typeof user !== "object") {
    localStorage.removeItem(CURRENT_USER_KEY);
    return;
  }

  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
}

export function getCurrentUser() {
  const rawUser = localStorage.getItem(CURRENT_USER_KEY);
  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser);
  } catch {
    return null;
  }
}

export function setCurrentUserGroups(groups) {
  const normalizedGroups = Array.isArray(groups)
    ? groups.map((group) => String(group).trim()).filter(Boolean)
    : [];

  if (!normalizedGroups.length) {
    localStorage.removeItem(CURRENT_USER_GROUPS_KEY);
    return;
  }

  localStorage.setItem(CURRENT_USER_GROUPS_KEY, JSON.stringify(normalizedGroups));
}

export function getCurrentUserGroups() {
  const rawGroups = localStorage.getItem(CURRENT_USER_GROUPS_KEY);
  if (!rawGroups) {
    return [];
  }

  try {
    const parsedGroups = JSON.parse(rawGroups);
    return Array.isArray(parsedGroups)
      ? parsedGroups.map((group) => String(group).trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

export function clearCurrentUser() {
  localStorage.removeItem(CURRENT_USER_KEY);
  localStorage.removeItem(CURRENT_USER_GROUPS_KEY);
}
