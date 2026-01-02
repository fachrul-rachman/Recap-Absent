import { getConfig } from "./config.mjs";
import { parseWibDateTime } from "./domain/windows.mjs";

let tokenState = null;

function buildUrl(pathname) {
  const { baseUrl } = getConfig();
  const url = new URL(baseUrl);
  const basePath = url.pathname.replace(/\/$/, "");
  const rel = pathname.startsWith("/") ? pathname : `/${pathname}`;
  url.pathname = `${basePath}${rel}`;
  return url;
}

function setTokenFromResponse(payload) {
  if (
    !payload ||
    typeof payload.access_token !== "string" ||
    typeof payload.refresh_token !== "string"
  ) {
    throw new Error("Auth response missing access_token or refresh_token.");
  }

  tokenState = {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    createdAtRaw: payload.created_at ?? null,
    expiredAtRaw: payload.expired_at ?? null,
  };
}

export function isAccessTokenExpired(now = new Date()) {
  if (!tokenState || !tokenState.expiredAtRaw) {
    return true;
  }
  const expiredAt = parseWibDateTime(tokenState.expiredAtRaw);
  if (!expiredAt || Number.isNaN(expiredAt.getTime())) {
    return true;
  }
  return now > expiredAt;
}

export async function login() {
  const cfg = getConfig();
  const url = buildUrl("/auth/login");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      accessKey: cfg.secretKey,
      accessSecret: cfg.accessSecret,
    }),
  });

  if (!res.ok) {
    throw new Error(`Login failed: ${res.status} ${res.statusText}`);
  }

  const payload = await res.json();
  setTokenFromResponse(payload);
  return tokenState.accessToken;
}

export async function ensureAccessToken() {
  if (!tokenState || isAccessTokenExpired()) {
    return login();
  }
  return tokenState.accessToken;
}

export async function refreshAccessTokenIfExpired(now = new Date()) {
  if (!tokenState || !tokenState.refreshToken || !tokenState.expiredAtRaw) {
    return false;
  }

  const expiredAt = parseWibDateTime(tokenState.expiredAtRaw);
  if (!expiredAt || Number.isNaN(expiredAt.getTime())) {
    return false;
  }

  if (now <= expiredAt) {
    return false;
  }

  const url = buildUrl("/auth/refresh");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      refreshToken: tokenState.refreshToken,
    }),
  });

  if (!res.ok) {
    throw new Error(`Refresh token failed: ${res.status} ${res.statusText}`);
  }

  const payload = await res.json();
  setTokenFromResponse(payload);
  return true;
}
