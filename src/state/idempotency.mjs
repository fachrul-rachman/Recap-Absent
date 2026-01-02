import { loadState, saveState } from "./stateFile.mjs";

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

export function makeDailyKey(dateStr) {
  return `daily:${dateStr}`;
}

export function makeWeeklyKey(startStr, endStr) {
  return `weekly:${startStr}_to_${endStr}`;
}

export function makeMonthlyKey(monthKey) {
  return `monthly:${monthKey}`;
}

export async function checkAlreadyPosted(key, { force }) {
  const state = await loadState();
  const already = Boolean(state.lastPosts && state.lastPosts[key]);

  if (already && !force) {
    return { shouldPost: false, state, key };
  }

  return { shouldPost: true, state, key };
}

export async function markPosted(key, content, stateMaybe) {
  const state = stateMaybe || (await loadState());
  const hash = hashString(content);
  const nowIso = new Date().toISOString();

  if (!state.lastPosts || typeof state.lastPosts !== "object") {
    state.lastPosts = {};
  }

  state.lastPosts[key] = {
    postedAtIso: nowIso,
    discordMessageHash: hash,
  };

  await saveState(state);
}

