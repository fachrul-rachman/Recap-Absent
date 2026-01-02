import { apiRequest } from "../http.mjs";

export async function getAttendanceByPeriod(startDate, endDate, { empId, empNo } = {}) {
  const query = {
    startDate,
    endDate,
  };

  if (empId) query.empId = empId;
  if (empNo) query.empNo = empNo;

  const payload = await apiRequest("/attendances/byPeriod", {
    method: "GET",
    query,
  });

  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && Array.isArray(payload.data)) {
    return payload.data;
  }

  return [];
}

