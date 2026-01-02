import { getConfig } from "./config.mjs";
import {
  ensureAccessToken,
  refreshAccessTokenIfExpired,
} from "./auth.mjs";

function buildUrl(pathname, query) {
  const { baseUrl } = getConfig();
  const url = new URL(baseUrl);
  const basePath = url.pathname.replace(/\/$/, "");
  const rel = pathname.startsWith("/") ? pathname : `/${pathname}`;
  url.pathname = `${basePath}${rel}`;
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

async function performFetch(url, options) {
  const res = await fetch(url, options);
  return res;
}

export async function apiRequest(pathname, { method = "GET", query, body } = {}) {
  const url = buildUrl(pathname, query);

  let token = await ensureAccessToken();
  const baseHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  let response = await performFetch(url, {
    method,
    headers: baseHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    const refreshed = await refreshAccessTokenIfExpired();
    if (!refreshed) {
      throw new Error(
        "Received 401 from API but access token is not expired yet; not attempting refresh.",
      );
    }

    token = await ensureAccessToken();
    const retryHeaders = {
      ...baseHeaders,
      Authorization: `Bearer ${token}`,
    };

    response = await performFetch(url, {
      method,
      headers: retryHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  if (!response.ok) {
    let detail = "";
    try {
      const text = await response.text();
      if (text) {
        // Truncate to avoid flooding logs but keep validation hints.
        detail = ` Body: ${text.slice(0, 300)}`;
      }
    } catch {
      // ignore
    }
    throw new Error(
      `Request failed: ${response.status} ${response.statusText}.${detail}`,
    );
  }

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

export async function discordPostMessage(content) {
  const { discordWebhookUrl } = getConfig();
  const res = await fetch(discordWebhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content }),
  });

  if (!res.ok) {
    throw new Error(`Failed to post Discord message: ${res.status} ${res.statusText}`);
  }
}
