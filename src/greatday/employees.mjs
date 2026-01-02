import { apiRequest } from "../http.mjs";

export async function getAllEmployees({ activeOnly = true } = {}) {
  // According to swagger, /employees is POST with FilterEmployeeDto
  // in the body, supporting page/limit/query/empId/empNo etc.
  // The response uses ResponseEmployee which represents a single employee;
  // the actual list may be root array or wrapped (handled below).
  const body = {
    page: 1,
    // swagger: "Limit the number of data each page (Max. 100)"
    limit: 100,
  };
  if (activeOnly) {
    body.empStatus = "active";
  }

  const payload = await apiRequest("/employees", {
    method: "POST",
    body,
  });

  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && Array.isArray(payload.data)) {
    return payload.data;
  }
  if (payload && Array.isArray(payload.items)) {
    return payload.items;
  }
  if (payload && Array.isArray(payload.rows)) {
    return payload.rows;
  }

  const keys = payload && typeof payload === "object" ? Object.keys(payload) : [];
  throw new Error(
    `Unable to determine employee list container. Supported shapes: root array, data, items, rows. Received keys: ${keys.join(
      ", ",
    )}`,
  );
}
