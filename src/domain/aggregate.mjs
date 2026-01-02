import { formatDateYmd, parseWibDateTime } from "./windows.mjs";
import {
  computeDailyAttendanceMetrics,
  computeNotPresentByDate,
  computeTardinessEvents,
  computeOvertimeEvents,
  aggregateMinutesByEmployee,
} from "./metrics.mjs";
import { computeAbsenceEvents } from "./metrics.mjs";
import { isExcludedEmployeeRecord } from "./exclusions.mjs";

function dateFromYmd(str) {
  const parts = typeof str === "string" ? str.split("-") : [];
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map((x) => Number.parseInt(x, 10));
  if ([y, m, d].some((n) => Number.isNaN(n))) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

function diffDaysInclusive(startStr, endStr) {
  const start = dateFromYmd(startStr);
  const end = dateFromYmd(endStr);
  if (!start || !end) return 0;
  const ms = end.getTime() - start.getTime();
  if (ms < 0) return 0;
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.floor(ms / dayMs) + 1;
}

export function buildDailySummary({
  yesterdayAttendance,
  todayAttendance,
  leaves,
  overtime,
  yesterdayStr,
  todayStr,
  employees,
}) {
  const yesterdayMetrics = computeDailyAttendanceMetrics(
    yesterdayAttendance,
    yesterdayStr,
  );
  const presentTodayKeys = new Set();
  for (const r of todayAttendance || []) {
    const empId = r.empId || r.empid || r.emp_id;
    const empNo = r.empNo || r.empno || r.emp_no;
    if (empId) presentTodayKeys.add(`id:${empId}`);
    if (empNo) presentTodayKeys.add(`no:${empNo}`);
  }

  const notPresentToday = [];
  for (const e of employees || []) {
    if (isExcludedEmployeeRecord(e)) continue;
    const empId = e.empId || e.empid || e.emp_id;
    const empNo = e.empNo || e.empno || e.emp_no;

    let seen = false;
    if (empId && presentTodayKeys.has(`id:${empId}`)) {
      seen = true;
    } else if (empNo && presentTodayKeys.has(`no:${empNo}`)) {
      seen = true;
    }

    if (!seen) {
      notPresentToday.push(e);
    }
  }
  const todayTardiness = computeDailyAttendanceMetrics(
    todayAttendance,
    todayStr,
  ).tardiness;

  const filteredLeaves = (leaves || []).filter(
    (l) => !isExcludedEmployeeRecord(l),
  );

  const approvedLeavesYesterday = filteredLeaves.filter((l) => {
    if (l.status !== 3) return false;
    if (l.typeRequest !== "Leave Request") return false;

    const start = formatDateYmd(parseWibDateTime(l.leaveStartdate));
    const end = formatDateYmd(parseWibDateTime(l.leaveEnddate));
    return yesterdayStr >= start && yesterdayStr <= end;
  });

  const overtimeYesterdayEvents = computeOvertimeEvents(
    overtime,
    yesterdayStr,
    yesterdayStr,
  );
  const overtimeYesterdayAgg = aggregateMinutesByEmployee(
    overtimeYesterdayEvents,
    "minutesOvertime",
  );

  const pendingLeavesToday = filteredLeaves.filter((l) => {
    if (l.status !== 2) return false;
    if (l.typeRequest !== "Leave Request") return false;
    const start = formatDateYmd(parseWibDateTime(l.leaveStartdate));
    const end = formatDateYmd(parseWibDateTime(l.leaveEnddate));
    return todayStr >= start && todayStr <= end;
  });

  return {
    yesterdayStr,
    todayStr,
    approvedLeavesYesterday,
    absencesYesterday: yesterdayMetrics.absences,
    tardinessYesterday: yesterdayMetrics.tardiness,
    earlyLeavesYesterday: yesterdayMetrics.earlyLeaves,
    notPresentToday,
    pendingLeavesToday,
    tardinessToday: todayTardiness,
    overtimeYesterdayAgg,
  };
}

export function buildWindowAggregates({
  attendance,
  overtime,
  leaves,
  startStr,
  endStr,
}) {
  const tardinessEvents = computeTardinessEvents(
    attendance,
    startStr,
    endStr,
  );
  const absenceEvents = computeAbsenceEvents(
    attendance,
    startStr,
    endStr,
  );
  const tardinessAgg = aggregateMinutesByEmployee(
    tardinessEvents,
    "minutesLate",
  );

  const overtimeEvents = computeOvertimeEvents(
    overtime,
    startStr,
    endStr,
  );
  const overtimeAgg = aggregateMinutesByEmployee(
    overtimeEvents,
    "minutesOvertime",
  );

  const leaveAggMap = new Map();
  let totalLeaveDays = 0;
  for (const l of leaves || []) {
    if (isExcludedEmployeeRecord(l)) continue;
    if (l.status !== 3) continue;
    if (l.typeRequest !== "Leave Request") continue;

    const start = formatDateYmd(parseWibDateTime(l.leaveStartdate));
    const end = formatDateYmd(parseWibDateTime(l.leaveEnddate));
    if (end < startStr || start > endStr) continue;

    const overlapStart = start < startStr ? startStr : start;
    const overlapEnd = end > endStr ? endStr : end;
    totalLeaveDays += diffDaysInclusive(overlapStart, overlapEnd);

    const empId = l.empId || l.empid || l.emp_id;
    const name = l.fullName || l.fullname || "";
    if (!empId) continue;

    if (!leaveAggMap.has(empId)) {
      leaveAggMap.set(empId, {
        empId,
        name,
        count: 0,
      });
    }
    const agg = leaveAggMap.get(empId);
    agg.count += 1;
  }

  const leaveAgg = Array.from(leaveAggMap.values());

  return {
    startStr,
    endStr,
    tardinessAgg,
    overtimeAgg,
    leaveAgg,
    absences: absenceEvents,
    totalLeaveDays,
  };
}
