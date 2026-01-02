import { fetchAllPages } from "./paging.mjs";

export async function getAllOvertime() {
  // Swagger: /overtime is POST with FilterOvertimeDto body (page, limit, etc).
  return fetchAllPages("/overtime", {
    method: "POST",
    bodyBase: { limit: 100 },
  });
}
