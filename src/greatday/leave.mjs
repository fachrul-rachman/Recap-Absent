import { fetchAllPages } from "./paging.mjs";

export async function getAllLeaves() {
  // Swagger: /leave is POST with FilterLeaveDto body (page, limit, etc).
  return fetchAllPages("/leave", {
    method: "POST",
    bodyBase: { limit: 100 },
  });
}
