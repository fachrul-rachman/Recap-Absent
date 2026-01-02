import "./env.mjs";
import http from "node:http";
import { URL } from "node:url";
import { runDaily, runWeekly, runMonthly } from "./runners.mjs";

const port = Number.parseInt(process.env.PORT || "3002", 10);

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function parseBoolean(value) {
  if (value === undefined || value === null) return false;
  const v = String(value).toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "y";
}

function isAuthorized(req, url) {
  const expected = process.env.API_KEY;
  if (!expected) {
    // Jika API_KEY tidak diset, jangan blokir (mode non‑auth).
    return true;
  }

  const headerKey =
    (req.headers && (req.headers["x-api-key"] || req.headers["X-API-Key"])) || "";
  const queryKey = url.searchParams.get("apiKey") || url.searchParams.get("token") || "";

  const provided = String(headerKey || queryKey || "").trim();
  return provided.length > 0 && provided === expected;
}

async function handleRun(req, res, url) {
  const mode = url.searchParams.get("mode");
  const force = parseBoolean(url.searchParams.get("force"));

  if (!mode || !["daily", "weekly", "monthly"].includes(mode)) {
    sendJson(res, 400, {
      status: "error",
      error: "Invalid mode. Expected one of: daily, weekly, monthly.",
    });
    return;
  }

  try {
    let result;
    if (mode === "daily") {
      result = await runDaily({ force });
    } else if (mode === "weekly") {
      result = await runWeekly({ force });
    } else {
      result = await runMonthly({ force });
    }

    if (result && result.skipped) {
      sendJson(res, 200, {
        status: "skipped",
        mode,
        reason: result.reason,
      });
      return;
    }

    sendJson(res, 200, {
      status: "ok",
      mode,
      skipped: false,
      message: `Successfully posted ${mode} report.`,
    });
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    sendJson(res, 500, {
      status: "error",
      error: message,
    });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, {
        status: "ok",
        service: "greatday-attendance-recap",
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/run") {
      if (!isAuthorized(req, url)) {
        sendJson(res, 401, {
          status: "error",
          error: "Unauthorized",
        });
        return;
      }
      await handleRun(req, res, url);
      return;
    }

    sendJson(res, 404, {
      status: "error",
      error: "Not Found",
    });
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    sendJson(res, 500, {
      status: "error",
      error: message,
    });
  }
});

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`HTTP server listening on port ${port}`);
});
