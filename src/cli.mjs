import "./env.mjs";
import { runDaily, runWeekly, runMonthly } from "./runners.mjs";

function parseArgs(argv) {
  const args = [...argv];
  const mode = args.shift();
  const flags = new Set();

  for (const arg of args) {
    if (arg === "--force") {
      flags.add("force");
    }
  }

  return {
    mode,
    force: flags.has("force"),
  };
}

async function main() {
  const { mode, force } = parseArgs(process.argv.slice(2));

  if (!mode || !["daily", "weekly", "monthly"].includes(mode)) {
    // Usage only, no secrets printed.
    console.error(
      'Usage: node src/cli.mjs <daily|weekly|monthly> [--force]',
    );
    process.exitCode = 1;
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
      console.log(result.reason);
    } else {
      console.log(`Successfully posted ${mode} report.`);
    }
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    console.error(`Error running ${mode} report: ${message}`);
    process.exitCode = 1;
  }
}

main();
