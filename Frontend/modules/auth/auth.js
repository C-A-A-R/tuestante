import { apiRequest, postRequest } from "../../js/api.js";
import {
  clearCurrentUser,
  clearTokens,
  setAccessToken,
  setCurrentUser,
  setCurrentUserGroups,
  setRefreshToken,
} from "../../js/storage.js";

const AUTH_BASE_PATH = "/user";

function extractToken(response, key) {
  if (!response || typeof response !== "object") {
    return null;
  }

  if (response[key]) {
    return response[key];
  }

  if (response.tokens && response.tokens[key]) {
    return response.tokens[key];
  }

  if (response.data && response.data[key]) {
    return response.data[key];
  }

  return null;
}

function persistJwtTokens(response) {
  const accessToken = extractToken(response, "access") ?? extractToken(response, "access_token") ?? extractToken(response, "token");
  const refreshToken = extractToken(response, "refresh") ?? extractToken(response, "refresh_token");

  if (accessToken) {
    setAccessToken(accessToken);
  }
  if (refreshToken) {
    setRefreshToken(refreshToken);
  }
}

function persistSessionUser(response) {
  setCurrentUser(response?.user ?? null);
  setCurrentUserGroups(response?.grupos ?? response?.groups ?? []);
}

export async function registerUser(data) {
  return postRequest(`${AUTH_BASE_PATH}/register/`, data, { auth: false });
}

export async function loginUser(data) {
  const result = await postRequest(`${AUTH_BASE_PATH}/login/`, data, { auth: false });
  persistJwtTokens(result);
  persistSessionUser(result);
  return result;
}

export async function logoutUser(refreshToken) {
  const result = await postRequest(
    `${AUTH_BASE_PATH}/logout/`,
    { refresh_token: refreshToken },
    { auth: false }
  );
  clearTokens();
  clearCurrentUser();
  return result;
}

export async function refreshSession(refreshToken) {
  const result = await postRequest(
    `${AUTH_BASE_PATH}/token/refresh/`,
    { refresh_token: refreshToken },
    { auth: false }
  );
  persistJwtTokens(result);
  return result;
}

export async function changePassword(data) {
  return apiRequest({
    path: `${AUTH_BASE_PATH}/password/change/`,
    method: "POST",
    body: data,
  });
}
