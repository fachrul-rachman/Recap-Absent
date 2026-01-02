import fs from "node:fs/promises";
import path from "node:path";
import { getConfig } from "../config.mjs";

async function ensureStateFileExists(filePath) {
  try {
    await fs.access(filePath);
  } catch {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      filePath,
      JSON.stringify({ lastPosts: {} }, null, 2),
      "utf8",
    );
  }
}

export async function loadState() {
  const { stateFile } = getConfig();
  await ensureStateFileExists(stateFile);

  const raw = await fs.readFile(stateFile, "utf8");
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { lastPosts: {} };
    }
    if (!parsed.lastPosts || typeof parsed.lastPosts !== "object") {
      parsed.lastPosts = {};
    }
    return parsed;
  } catch {
    return { lastPosts: {} };
  }
}

export async function saveState(state) {
  const { stateFile } = getConfig();
  const data = {
    lastPosts: state.lastPosts || {},
  };
  await fs.writeFile(stateFile, JSON.stringify(data, null, 2), "utf8");
}

