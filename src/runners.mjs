import { getAttendanceByPeriod } from "./greatday/attendance.mjs";
import { getAllLeaves } from "./greatday/leave.mjs";
import { getAllOvertime } from "./greatday/overtime.mjs";
import { getAllEmployees } from "./greatday/employees.mjs";
import {
  getDailyWindow,
  getWeeklyWindow,
  getPreviousMonthWindow,
} from "./domain/windows.mjs";
import {
  buildDailySummary,
  buildWindowAggregates,
} from "./domain/aggregate.mjs";
import { rankTopN } from "./domain/ranking.mjs";
import {
  makeDailyKey,
  makeWeeklyKey,
  makeMonthlyKey,
  checkAlreadyPosted,
  markPosted,
} from "./state/idempotency.mjs";
import {
  formatDailyDiscord,
  formatWeeklyDiscord,
  formatMonthlyDiscord,
} from "./report/formatDiscord.mjs";
import { discordPostMessage } from "./http.mjs";
import { isExcludedEmployeeRecord } from "./domain/exclusions.mjs";

function buildEmployeeIndex(employees) {
  const byEmpId = new Map();
  const byEmpNo = new Map();

  for (const e of employees || []) {
    if (isExcludedEmployeeRecord(e)) continue;
    const empId = e.empId || e.empid || e.emp_id;
    const empNo = e.empNo || e.empno || e.emp_no;
    const fullName =
      e.fullName ||
      [e.firstName, e.middleName, e.lastName]
        .filter(Boolean)
        .join(" ") ||
      e.userName ||
      "";
    const posName = e.posNameEn || "";
    const display = fullName
      ? posName
        ? `${fullName} (${posName})`
        : fullName
      : "(nama tidak tersedia)";

    const info = { fullName, empNo, posName, display };

    if (empId && !byEmpId.has(empId)) {
      byEmpId.set(empId, info);
    }
    if (empNo && !byEmpNo.has(empNo)) {
      byEmpNo.set(empNo, info);
    }
  }

  return { byEmpId, byEmpNo };
}

export async function runDaily({ force }) {
  const { yesterdayStr, todayStr } = getDailyWindow();

  const [
    yesterdayAttendance,
    todayAttendance,
    leaves,
    overtime,
    employees,
  ] = await Promise.all([
    getAttendanceByPeriod(yesterdayStr, yesterdayStr),
    getAttendanceByPeriod(todayStr, todayStr),
    getAllLeaves(),
    getAllOvertime(),
    getAllEmployees(),
  ]);

  const employeeIndex = buildEmployeeIndex(employees);

  const summary = buildDailySummary({
    yesterdayAttendance,
    todayAttendance,
    leaves,
    overtime,
    yesterdayStr,
    todayStr,
    employees,
  });

  const content = formatDailyDiscord(summary, employeeIndex);
  const key = makeDailyKey(yesterdayStr);
  const { shouldPost, state, reason } = await checkAlreadyPosted(key, {
    force,
  });

  if (!shouldPost) {
    return {
      skipped: true,
      reason: reason || `Already posted for ${key}. Use --force to override.`,
    };
  }

  await discordPostMessage(content);
  await markPosted(key, content, state);

  return { skipped: false };
}

export async function runWeekly({ force }) {
  const { startStr, endStr } = getWeeklyWindow();

  const attendance = await getAttendanceByPeriod(startStr, endStr);
  const [leaves, overtime, employees] = await Promise.all([
    getAllLeaves(),
    getAllOvertime(),
    getAllEmployees(),
  ]);

  const employeeIndex = buildEmployeeIndex(employees);

  const aggregates = buildWindowAggregates({
    attendance,
    overtime,
    leaves,
    startStr,
    endStr,
  });

  const content = formatWeeklyDiscord(aggregates, employeeIndex);
  const key = makeWeeklyKey(startStr, endStr);
  const { shouldPost, state, reason } = await checkAlreadyPosted(key, {
    force,
  });

  if (!shouldPost) {
    return {
      skipped: true,
      reason: reason || `Already posted for ${key}. Use --force to override.`,
    };
  }

  await discordPostMessage(content);
  await markPosted(key, content, state);

  return { skipped: false };
}

export async function runMonthly({ force }) {
  const { startStr, endStr, monthKey } = getPreviousMonthWindow();

  const attendance = await getAttendanceByPeriod(startStr, endStr);
  const [leaves, overtime, employees] = await Promise.all([
    getAllLeaves(),
    getAllOvertime(),
    getAllEmployees(),
  ]);

  const aggregates = buildWindowAggregates({
    attendance,
    overtime,
    leaves,
    startStr,
    endStr,
  });

  const tardinessTop = rankTopN(aggregates.tardinessAgg, 5);
  const overtimeTop = rankTopN(aggregates.overtimeAgg, 5);

  const employeeIndex = buildEmployeeIndex(employees);

  const content = formatMonthlyDiscord(
    {
      monthKey,
      tardinessTop,
      overtimeTop,
      aggregates,
      employees,
    },
    employeeIndex,
  );

  const key = makeMonthlyKey(monthKey);
  const { shouldPost, state, reason } = await checkAlreadyPosted(key, {
    force,
  });

  if (!shouldPost) {
    return {
      skipped: true,
      reason: reason || `Already posted for ${key}. Use --force to override.`,
    };
  }

  await discordPostMessage(content);
  await markPosted(key, content, state);

  return { skipped: false };
}
