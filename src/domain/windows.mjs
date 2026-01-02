export function parseWibDateTime(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return new Date(value.getTime());
  }
  if (typeof value !== "string") {
    return new Date(value);
  }

  let normalized = value;
  if (normalized.endsWith("Z")) {
    normalized = normalized.slice(0, -1);
  }

  return new Date(normalized);
}

export function formatDateYmd(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getToday() {
  return new Date();
}

export function getDailyWindow(now = getToday()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  return {
    yesterday,
    today,
    yesterdayStr: formatDateYmd(yesterday),
    todayStr: formatDateYmd(today),
  };
}

export function getWeeklyWindow(now = getToday()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = today.getDay();

  const mondayOffset = (dayOfWeek + 6) % 7;
  const monday = new Date(today);
  monday.setDate(monday.getDate() - mondayOffset);

  const friday = new Date(monday);
  friday.setDate(friday.getDate() + 4);

  return {
    start: monday,
    end: friday,
    startStr: formatDateYmd(monday),
    endStr: formatDateYmd(friday),
  };
}

export function getPreviousMonthWindow(now = getToday()) {
  const year = now.getFullYear();
  const month = now.getMonth();

  const firstOfThisMonth = new Date(year, month, 1);
  const lastOfPreviousMonth = new Date(firstOfThisMonth);
  lastOfPreviousMonth.setDate(0);

  const firstOfPreviousMonth = new Date(
    lastOfPreviousMonth.getFullYear(),
    lastOfPreviousMonth.getMonth(),
    1,
  );

  return {
    start: firstOfPreviousMonth,
    end: lastOfPreviousMonth,
    startStr: formatDateYmd(firstOfPreviousMonth),
    endStr: formatDateYmd(lastOfPreviousMonth),
    monthKey: `${lastOfPreviousMonth.getFullYear()}-${String(
      lastOfPreviousMonth.getMonth() + 1,
    ).padStart(2, "0")}`,
  };
}

export function isDateWithin(dateStr, startDateStr, endDateStr) {
  const d = formatDateYmd(parseWibDateTime(dateStr));
  return d >= startDateStr && d <= endDateStr;
}

