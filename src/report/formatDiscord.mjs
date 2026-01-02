import { limitLines } from "./limits.mjs";

function resolveEmployeeFromRecord(record, employeeIndex) {
  if (!employeeIndex) return null;
  const empId = record.empId || record.empid || record.emp_id;
  const empNo = record.empNo || record.empno || record.emp_no;

  if (empId && employeeIndex.byEmpId.has(empId)) {
    return employeeIndex.byEmpId.get(empId);
  }
  if (empNo && employeeIndex.byEmpNo.has(empNo)) {
    return employeeIndex.byEmpNo.get(empNo);
  }
  return null;
}

function resolveEmployeeFromAgg(agg, employeeIndex) {
  if (!employeeIndex) return null;
  const empId = agg.empId || agg.empid || agg.emp_id;
  const empNo = agg.empNo || agg.empno || agg.emp_no;

  if (empId && employeeIndex.byEmpId.has(empId)) {
    return employeeIndex.byEmpId.get(empId);
  }
  if (empNo && employeeIndex.byEmpNo.has(empNo)) {
    return employeeIndex.byEmpNo.get(empNo);
  }
  return null;
}

function displayNameFromRecord(record, employeeIndex) {
  const fromIndex = resolveEmployeeFromRecord(record, employeeIndex);
  if (fromIndex && fromIndex.display) return fromIndex.display;

  const fullName =
    record.fullName ||
    record.fullname ||
    record.empName ||
    record.empname ||
    "";

  if (fullName) return fullName;
  return "Nama tidak diketahui";
}

function displayNameFromAgg(agg, employeeIndex) {
  const fromIndex = resolveEmployeeFromAgg(agg, employeeIndex);
  if (fromIndex && fromIndex.display) return fromIndex.display;

  if (agg.name) return agg.name;
  return "Nama tidak diketahui";
}

function limitList(items) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  const { shown, remaining } = limitLines(list);
  return { shown, remaining };
}

function renderTreeSection(headerLine, items, renderItem) {
  const { shown, remaining } = limitList(items);
  const lines = [];

  lines.push(headerLine);

  if (shown.length === 0) {
    lines.push("└─ ◦ -");
  } else {
    for (const it of shown) {
      lines.push(`└─ ${renderItem(it)}`);
    }
    if (remaining > 0) {
      lines.push(`└─ ◦ ... dan ${remaining} lainnya`);
    }
  }

  return lines;
}

function formatLabelDate(ymd) {
  if (!ymd) return ymd;
  const [y, m, d] = ymd.split("-").map((x) => Number.parseInt(x, 10));
  if ([y, m, d].some((n) => Number.isNaN(n))) return ymd;
  const date = new Date(y, m - 1, d);
  try {
    const weekday = date.toLocaleDateString("id-ID", { weekday: "long" });
    return `${weekday}, ${ymd}`;
  } catch {
    return ymd;
  }
}

function formatIndonesianMonthKey(monthKey) {
  if (!monthKey) return monthKey;
  const [y, m] = monthKey.split("-").map((x) => Number.parseInt(x, 10));
  if ([y, m].some((n) => Number.isNaN(n))) return monthKey;
  const date = new Date(y, m - 1, 1);
  try {
    return date.toLocaleDateString("id-ID", {
      month: "long",
      year: "numeric",
    });
  } catch {
    return monthKey;
  }
}

export function formatDailyDiscord(summary, employeeIndex) {
  const parts = [];

  const yesterdayLabel = formatLabelDate(summary.yesterdayStr);
  const todayLabel = formatLabelDate(summary.todayStr);

  const approvedYesterday = summary.approvedLeavesYesterday || [];
  const absencesYesterday = summary.absencesYesterday || [];
  const tardinessYesterday = summary.tardinessYesterday || [];
  const earlyLeavesYesterday = summary.earlyLeavesYesterday || [];
  const overtimeYesterdayAgg = summary.overtimeYesterdayAgg || [];

  const notPresentToday = summary.notPresentToday || [];
  const pendingLeavesToday = summary.pendingLeavesToday || [];
  const tardinessToday = summary.tardinessToday || [];

  const approvedLines = approvedYesterday.map((l) =>
    displayNameFromRecord(l, employeeIndex),
  );

  const absentLines = absencesYesterday.map((r) =>
    displayNameFromRecord(r, employeeIndex),
  );

  const lateYesterdayLines = tardinessYesterday.map((t) => {
    const name = displayNameFromRecord(t.record, employeeIndex);
    const seconds =
      typeof t.secondsLate === "number" ? t.secondsLate : null;
    const minutes =
      typeof t.minutesLate === "number" ? t.minutesLate : null;

    if (seconds != null && seconds > 0 && seconds < 60) {
      return `${name} - ${seconds} detik`;
    }

    const safeMinutes = minutes != null ? minutes : 0;
    return `${name} - ${safeMinutes} menit`;
  });

  const earlyLeaveLines = earlyLeavesYesterday.map((e) => {
    const name = displayNameFromRecord(e.record, employeeIndex);
    const minutes = e.minutesEarly != null ? e.minutesEarly : 0;
    return `${name} - ${minutes}m`;
  });

  const overtimeLines = overtimeYesterdayAgg.map((o) => {
    const name = displayNameFromAgg(o, employeeIndex);
    return `${name} - ${o.totalMinutes}m`;
  });

  const notPresentLines = notPresentToday.map((emp) =>
    displayNameFromRecord(emp, employeeIndex),
  );

  const pendingLeaveTodayLines = pendingLeavesToday.map((l) =>
    displayNameFromRecord(l, employeeIndex),
  );

  const lateTodayLines = tardinessToday.map((t) => {
    const name = displayNameFromRecord(t.record, employeeIndex);
    const seconds =
      typeof t.secondsLate === "number" ? t.secondsLate : null;
    const minutes =
      typeof t.minutesLate === "number" ? t.minutesLate : null;

    if (seconds != null && seconds > 0 && seconds < 60) {
      return `${name} - ${seconds} detik`;
    }

    const safeMinutes = minutes != null ? minutes : 0;
    return `${name} - ${safeMinutes} menit`;
  });

  const approvedAbsenceCount = approvedYesterday.length;
  const absentCount = absencesYesterday.length;
  const lateYesterdayCount = tardinessYesterday.length;
  const earlyLeaveCount = earlyLeavesYesterday.length;
  const overtimeCount = overtimeYesterdayAgg.length;

  const notPresentCount = notPresentToday.length;
  const pendingLeaveTodayCount = pendingLeavesToday.length;
  const lateTodayCount = tardinessToday.length;

  // Rekap Final
  parts.push(`**📌 Rekap Final (${yesterdayLabel})**`);
  parts.push("────────────────────────");
  parts.push("");

  parts.push(
    ...renderTreeSection(
      `✅ Approved absence (cuti/izin/sakit): ${approvedAbsenceCount}`,
      approvedLines,
      (line) => `👤 ${line}`,
    ),
  );
  parts.push("");

  parts.push(
    ...renderTreeSection(
      `❌ Absent/Alpha: ${absentCount}`,
      absentLines,
      (line) => `👤 ${line}`,
    ),
  );
  parts.push("");

  parts.push(
    ...renderTreeSection(
      `⏰ Telat: ${lateYesterdayCount}`,
      lateYesterdayLines,
      (line) => {
        const idx = line.lastIndexOf("-");
        if (idx === -1) return `👤 ${line}`;
        const name = line.slice(0, idx).trim();
        const minutes = line.slice(idx + 1).trim();
        return `👤 ${name} ⏱️ ${minutes}`;
      },
    ),
  );
  parts.push("");

  parts.push(
    ...renderTreeSection(
      `🏃 Pulang awal: ${earlyLeaveCount}`,
      earlyLeaveLines,
      (line) => `👤 ${line}`,
    ),
  );
  parts.push("");

  parts.push(
    ...renderTreeSection(
      `🕒 Lembur (approved): ${overtimeCount}`,
      overtimeLines,
      (line) => {
        const idx = line.lastIndexOf("-");
        if (idx === -1) return `👤 ${line}`;
        const name = line.slice(0, idx).trim();
        const minutes = line.slice(idx + 1).trim();
        return `👤 ${name}  🌙 ${minutes}`;
      },
    ),
  );
  parts.push("");

  parts.push("━━━━━━━━━━━━━━━━━━━━━━━━");
  parts.push("");
  
  // Monitoring pagi
  parts.push(`**📌 Monitoring Pagi (${todayLabel} • 09:00)**`);
  parts.push("────────────────────────");
  parts.push("");

  parts.push(
    ...renderTreeSection(
      `🕗 Belum hadir: ${notPresentCount}`,
      notPresentLines,
      (line) => `👤 ${line}`,
    ),
  );
  parts.push("");

  parts.push(
    ...renderTreeSection(
      `📄 Pending leave: ${pendingLeaveTodayCount}`,
      pendingLeaveTodayLines,
      (line) => `👤 ${line}`,
    ),
  );
  parts.push("");

  parts.push(
    ...renderTreeSection(
      `⏰ Telat (hari ini): ${lateTodayCount}`,
      lateTodayLines,
      (line) => {
        const idx = line.lastIndexOf("-");
        if (idx === -1) return `👤 ${line}`;
        const name = line.slice(0, idx).trim();
        const minutes = line.slice(idx + 1).trim();
        return `👤 ${name} ⏱️ ${minutes}`;
      },
    ),
  );
  parts.push("");

  parts.push(
    "ℹ️ Catatan: Data hari ini masih bisa berubah kalau ada approve/reject baru dari HR.",
  );

  return parts.join("\n");
}

export function formatWeeklyDiscord(aggregates, employeeIndex) {
  const parts = [];

  parts.push(
    `**📌 Rekap Mingguan (${aggregates.startStr} s/d ${aggregates.endStr})**`,
  );
  parts.push("────────────────────────");
  parts.push("");

  const tardinessAgg = aggregates.tardinessAgg || [];
  const overtimeAgg = aggregates.overtimeAgg || [];
  const leaveAgg = aggregates.leaveAgg || [];

  const lateLines = tardinessAgg.map((t) => {
    const name = displayNameFromAgg(t, employeeIndex);
    return `${name} - ${t.count}x (${t.totalMinutes}m)`;
  });

  const overtimeLines = overtimeAgg.map((o) => {
    const name = displayNameFromAgg(o, employeeIndex);
    return `${name} - ${o.count}x (${o.totalMinutes}m)`;
  });

  const leaveLines = leaveAgg.map((l) => {
    const name = displayNameFromAgg(l, employeeIndex);
    return `${name} - ${l.count}x`;
  });

  parts.push(
    ...renderTreeSection(
      `⏰ Telat (total per orang): ${tardinessAgg.length}`,
      lateLines,
      (line) => `👤 ${line}`,
    ),
  );
  parts.push("");

  parts.push(
    ...renderTreeSection(
      `🕒 Lembur (total per orang): ${overtimeAgg.length}`,
      overtimeLines,
      (line) => `👤 ${line}`,
    ),
  );
  parts.push("");

  parts.push(
    ...renderTreeSection(
      `✅ Cuti approved (per orang): ${leaveAgg.length}`,
      leaveLines,
      (line) => `👤 ${line}`,
    ),
  );

  return parts.join("\n");
}

export function formatMonthlyDiscord(
  { monthKey, tardinessTop, overtimeTop, aggregates, employees },
  employeeIndex,
) {
  const parts = [];

  const monthLabel = formatIndonesianMonthKey(monthKey);

  const employeeCount = Array.isArray(employees)
    ? employees.length
    : null;

  const tardinessAgg = aggregates?.tardinessAgg || [];
  const overtimeAgg = aggregates?.overtimeAgg || [];
  const absences = aggregates?.absences || [];
  const totalLeaveDays = aggregates?.totalLeaveDays ?? 0;

  const totalLateCount = tardinessAgg.reduce(
    (sum, t) => sum + (t.count || 0),
    0,
  );
  const totalLateMinutes = tardinessAgg.reduce(
    (sum, t) => sum + (t.totalMinutes || 0),
    0,
  );
  const totalOvertimeMinutes = overtimeAgg.reduce(
    (sum, o) => sum + (o.totalMinutes || 0),
    0,
  );
  const totalOvertimeHours = totalOvertimeMinutes / 60;

  parts.push(`**📌 Rekap Bulanan (${monthLabel})**`);
  parts.push("────────────────────────");
  parts.push("");

  if (employeeCount != null) {
    parts.push(`👥 Total karyawan: ${employeeCount}`);
  }
  parts.push(
    `⏰ Telat: ${totalLateCount} (total ${totalLateMinutes}m)`,
  );
  parts.push(`❌ Absent/Alpha: ${absences.length}`);
  parts.push(
    `✅ Approved absence (cuti/izin/sakit): ${totalLeaveDays} hari`,
  );
  parts.push(
    `🕒 Lembur (approved): ${totalOvertimeMinutes}m (${totalOvertimeHours.toFixed(
      1,
    )} jam)`,
  );
  parts.push("");

  const topLateLines = (tardinessTop || []).map((t, idx) => {
    const name = displayNameFromAgg(t, employeeIndex);
    return `#${idx + 1} ${name} - ${t.count}x (${t.totalMinutes}m)`;
  });

  const topOvertimeLines = (overtimeTop || []).map((o, idx) => {
    const name = displayNameFromAgg(o, employeeIndex);
    const minutes = o.totalMinutes || 0;
    const hours = minutes / 60;
    return `#${idx + 1} ${name} - ${minutes}m (${hours.toFixed(1)} jam)`;
  });

  parts.push(
    ...renderTreeSection("⏰ Top 5 Telat", topLateLines, (line) => line),
  );
  parts.push("");
  parts.push(
    ...renderTreeSection("🕒 Top 5 Lembur", topOvertimeLines, (line) => line),
  );

  return parts.join("\n");
}
