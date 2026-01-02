import path from "node:path";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getConfig() {
  const baseUrl = process.env.BASE_URL || "https://dev.greatdayhr.com/api";
  const secretKey = requireEnv("SECRET_KEY");
  const accessSecret = requireEnv("ACCESS_SECRET");
  const discordWebhookUrl = requireEnv("DISCORD_WEBHOOK_URL");

  const stateFileEnv = process.env.STATE_FILE || "state.json";
  const stateFile = path.isAbsolute(stateFileEnv)
    ? stateFileEnv
    : path.join(process.cwd(), stateFileEnv);

  return {
    baseUrl,
    secretKey,
    accessSecret,
    discordWebhookUrl,
    stateFile,
  };
}

