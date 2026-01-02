export const MAX_LINES_PER_SECTION = 30;

export function limitLines(lines, max = MAX_LINES_PER_SECTION) {
  if (!Array.isArray(lines)) {
    return { shown: [], remaining: 0 };
  }

  if (lines.length <= max) {
    return { shown: lines, remaining: 0 };
  }

  return {
    shown: lines.slice(0, max),
    remaining: lines.length - max,
  };
}

