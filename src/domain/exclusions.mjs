const EXCLUDED_EMP_IDS = new Set(["DO230167"]);
const EXCLUDED_EMP_NOS = new Set(["2022 - 078"]);

export function isExcludedEmpIdNo(empId, empNo) {
  const id = empId != null ? String(empId).trim() : "";
  const no = empNo != null ? String(empNo).trim() : "";

  if (id && EXCLUDED_EMP_IDS.has(id)) return true;
  if (no && EXCLUDED_EMP_NOS.has(no)) return true;
  return false;
}

export function isExcludedEmployeeRecord(record) {
  if (!record || typeof record !== "object") return false;
  const empId =
    record.empId || record.empid || record.emp_id || record.EmpId;
  const empNo =
    record.empNo || record.empno || record.emp_no || record.EmpNo;
  return isExcludedEmpIdNo(empId, empNo);
}

