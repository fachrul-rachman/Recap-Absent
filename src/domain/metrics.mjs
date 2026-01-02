import { parseWibDateTime, formatDateYmd } from "./windows.mjs";
import { isExcludedEmployeeRecord } from "./exclusions.mjs";

function diffMs(later, earlier) {
  return later.getTime() - earlier.getTime();
}

function diffMinutesFromMs(ms) {
  return Math.round(ms / 60000);
}

function diffSecondsFromMs(ms) {
  return Math.round(ms / 1000);
}

export function computeDailyAttendanceMetrics(records, targetDateStr) {
  const absences = [];
  const tardiness = [];
  const earlyLeaves = [];

  for (const r of records) {
    if (isExcludedEmployeeRecord(r)) continue;
    const shiftStart = r.shiftstarttime
      ? parseWibDateTime(r.shiftstarttime)
      : null;
    const dayStr = shiftStart ? formatDateYmd(shiftStart) : null;
    if (dayStr !== targetDateStr) continue;

    const attendCode = r.attendCode;
    const daytype = r.daytype;

    if (attendCode === "ABS" && daytype !== "OFF") {
      absences.push(r);
    }

    const startTime = r.starttime ? parseWibDateTime(r.starttime) : null;
    if (shiftStart && startTime && startTime > shiftStart) {
      const ms = diffMs(startTime, shiftStart);
      const minutesLate = diffMinutesFromMs(ms);
      const secondsLate = diffSecondsFromMs(ms);
      tardiness.push({ record: r, minutesLate, secondsLate });
    }

    const shiftEnd = r.shiftendtime
      ? parseWibDateTime(r.shiftendtime)
      : null;
    const endTime = r.endtime ? parseWibDateTime(r.endtime) : null;
    if (shiftEnd && endTime && endTime < shiftEnd) {
      const ms = diffMs(shiftEnd, endTime);
      const minutesEarly = diffMinutesFromMs(ms);
      earlyLeaves.push({ record: r, minutesEarly });
    }
  }

  return { absences, tardiness, earlyLeaves };
}

export function computeNotPresentByDate(records, targetDateStr) {
  const result = [];
  for (const r of records) {
    if (isExcludedEmployeeRecord(r)) continue;
    const shiftStart = r.shiftstarttime
      ? parseWibDateTime(r.shiftstarttime)
      : null;
    const dayStr = shiftStart ? formatDateYmd(shiftStart) : null;
    if (dayStr !== targetDateStr) continue;

    const startTime = r.starttime ? parseWibDateTime(r.starttime) : null;
    if (!startTime) {
      result.push(r);
    }
  }
  return result;
}

export function computeTardinessEvents(records, startDateStr, endDateStr) {
  const events = [];
  for (const r of records) {
    if (isExcludedEmployeeRecord(r)) continue;
    const shiftStart = r.shiftstarttime
      ? parseWibDateTime(r.shiftstarttime)
      : null;
    const startTime = r.starttime ? parseWibDateTime(r.starttime) : null;
    if (!shiftStart || !startTime || startTime <= shiftStart) continue;

    const dayStr = formatDateYmd(shiftStart);
    if (dayStr < startDateStr || dayStr > endDateStr) continue;

    const ms = diffMs(startTime, shiftStart);
    const minutesLate = diffMinutesFromMs(ms);
    const secondsLate = diffSecondsFromMs(ms);
    events.push({ record: r, minutesLate, secondsLate });
  }
  return events;
}

export function computeAbsenceEvents(records, startDateStr, endDateStr) {
  const events = [];
  for (const r of records) {
    if (isExcludedEmployeeRecord(r)) continue;
    const shiftStart = r.shiftstarttime
      ? parseWibDateTime(r.shiftstarttime)
      : null;
    if (!shiftStart) continue;

    const dayStr = formatDateYmd(shiftStart);
    if (dayStr < startDateStr || dayStr > endDateStr) continue;

    const attendCode = r.attendCode;
    const daytype = r.daytype;

    if (attendCode === "ABS" && daytype !== "OFF") {
      events.push(r);
    }
  }
  return events;
}

export function aggregateMinutesByEmployee(events, minutesField) {
  const map = new Map();

  for (const e of events) {
    const r = e.record;
    const empId = r.empId || r.empid || r.emp_id;
    const empNo = r.empNo || r.empno || r.emp_no;
    const name =
      r.fullName ||
      r.fullname ||
      r.empName ||
      r.empname ||
      r.emp_name ||
      "";
    const minutes = e[minutesField];

    if (!empId) continue;

    if (!map.has(empId)) {
      map.set(empId, {
        empId,
        empNo,
        name,
        count: 0,
        totalMinutes: 0,
      });
    }

    const agg = map.get(empId);
    agg.count += 1;
    agg.totalMinutes += minutes;
  }

  return Array.from(map.values());
}

export function computeOvertimeEvents(records, startDateStr, endDateStr) {
  const events = [];
  for (const r of records) {
    if (isExcludedEmployeeRecord(r)) continue;
    if (r.status !== 3) continue;

    const dateStr = r.ovtDate || r.ovtdate || r.date || null;
    if (!dateStr) continue;

    const day = formatDateYmd(parseWibDateTime(dateStr));
    if (day < startDateStr || day > endDateStr) continue;

    const hours =
      r.ovthours != null ? Number.parseFloat(r.ovthours) : Number.NaN;
    const minutes = Number.isFinite(hours) ? Math.round(hours * 60) : 0;

    events.push({ record: r, minutesOvertime: minutes });
  }
  return events;
}
