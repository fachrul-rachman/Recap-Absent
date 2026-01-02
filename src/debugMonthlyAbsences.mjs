import "./env.mjs";
import { getAttendanceByPeriod } from "./greatday/attendance.mjs";
import { getAllEmployees } from "./greatday/employees.mjs";
import { computeAbsenceEvents } from "./domain/metrics.mjs";
import { parseWibDateTime, formatDateYmd } from "./domain/windows.mjs";

function buildEmployeeIndex(employees) {
  const byEmpId = new Map();
  const byEmpNo = new Map();

  for (const e of employees || []) {
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

async function main() {
  // Window tetap: November 2025 (01 s/d 30)
  const startStr = "2025-11-01";
  const endStr = "2025-11-30";

  const [attendance, employees] = await Promise.all([
    getAttendanceByPeriod(startStr, endStr),
    getAllEmployees(),
  ]);

  const employeeIndex = buildEmployeeIndex(employees);

  const absenceEvents = computeAbsenceEvents(
    attendance,
    startStr,
    endStr,
  );

  const rows = absenceEvents.map((r) => {
    const shiftStart = r.shiftstarttime
      ? parseWibDateTime(r.shiftstarttime)
      : null;
    const dayStr = shiftStart ? formatDateYmd(shiftStart) : "(tanpa tanggal)";

    const empId = r.empId || r.empid || r.emp_id;
    const empNo = r.empNo || r.empno || r.emp_no;

    let name = "";
    const fromIndex =
      (empId && employeeIndex.byEmpId.get(empId)) ||
      (empNo && employeeIndex.byEmpNo.get(empNo)) ||
      null;

    if (fromIndex && fromIndex.display) {
      name = fromIndex.display;
    } else {
      name =
        r.fullName ||
        r.fullname ||
        r.empName ||
        r.empname ||
        "(nama tidak diketahui)";
    }

    return {
      dayStr,
      name,
      attendCode: r.attendCode,
      daytype: r.daytype,
    };
  });

  rows.sort((a, b) => {
    if (a.dayStr < b.dayStr) return -1;
    if (a.dayStr > b.dayStr) return 1;
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
  });

  for (const row of rows) {
    console.log(
      `${row.dayStr} — ${row.name} — attendCode=${row.attendCode}, daytype=${row.daytype}`,
    );
  }

  console.log(`\nTotal ABS events (script view): ${rows.length}`);
}

main().catch((err) => {
  console.error("Error in debugMonthlyAbsences:", err && err.message);
  process.exitCode = 1;
});

