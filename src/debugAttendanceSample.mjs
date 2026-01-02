import "./env.mjs";
import { getAttendanceByPeriod } from "./greatday/attendance.mjs";
import { getAllEmployees } from "./greatday/employees.mjs";
import { parseWibDateTime, formatDateYmd } from "./domain/windows.mjs";

function normalize(str) {
  return (str || "").toString().toLowerCase().trim();
}

function buildEmployeeIndex(employees) {
  const byEmpId = new Map();

  for (const e of employees || []) {
    const empId = e.empId || e.empid || e.emp_id;

    const fullName =
      e.fullName ||
      e.fullname ||
      e.empName ||
      e.empname ||
      e.userName ||
      "";

    if (empId && !byEmpId.has(empId)) {
      byEmpId.set(empId, { empId, fullName });
    }
  }

  return { byEmpId };
}

async function main() {
  const [, , dateArg, ...nameParts] = process.argv;
  const targetDateStr = dateArg || "2025-11-03";
  const targetNameKeyword = nameParts.length
    ? nameParts.join(" ").toLowerCase()
    : "r. riko prananto";

  const [year, month, day] = targetDateStr
    .split("-")
    .map((x) => Number.parseInt(x, 10));

  const targetDate = new Date(Date.UTC(year, month - 1, day));
  const prevDate = new Date(targetDate.getTime());
  prevDate.setUTCDate(prevDate.getUTCDate() - 1);
  const nextDate = new Date(targetDate.getTime());
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);

  const prevStr = formatDateYmd(prevDate);
  const nextStr = formatDateYmd(nextDate);

  const [employees, attendance] = await Promise.all([
    getAllEmployees(),
    // Ambil window kecil sekitar targetDate, lalu filter di bawah.
    getAttendanceByPeriod(prevStr, nextStr),
  ]);

  const { byEmpId } = buildEmployeeIndex(employees);

  // Cari empId yang namanya mengandung keyword
  const candidateEmpIds = [];
  for (const { empId, fullName } of byEmpId.values()) {
    if (normalize(fullName).includes(targetNameKeyword)) {
      candidateEmpIds.push({ empId, fullName });
    }
  }

  console.log(
    "Candidate employees matching name:",
    candidateEmpIds.length,
  );
  for (const c of candidateEmpIds) {
    console.log(`- ${c.empId} — ${c.fullName}`);
  }

  console.log("\nAttendance records on", targetDateStr, ":\n");

  for (const r of attendance || []) {
    const shiftStart = r.shiftstarttime
      ? parseWibDateTime(r.shiftstarttime)
      : null;
    const dayStr = shiftStart ? formatDateYmd(shiftStart) : null;
    if (dayStr !== targetDateStr) continue;

    const empId = r.empId || r.empid || r.emp_id;

    const emp = empId ? byEmpId.get(empId) : null;
    const name = emp ? emp.fullName : "(nama tidak diketahui)";

    console.log(
      `${dayStr} — ${name} (empId=${empId}) — attendCode=${r.attendCode}, daytype=${r.daytype}, starttime=${r.starttime}, endtime=${r.endtime}`,
    );
  }
}

main().catch((err) => {
  console.error("Error in debugAttendanceSample:", err && err.message);
  process.exitCode = 1;
});
