import { apiRequest } from "../http.mjs";

function extractItems(payload) {
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
    `Unable to determine list container in paged response. Supported shapes: root array, data, items, rows. Received keys: ${keys.join(
      ", ",
    )}`,
  );
}

export async function fetchAllPages(
  pathname,
  { method = "GET", queryBase = {}, bodyBase = null } = {},
) {
  const allItems = [];
  let page = 1;
  let totalPage = null;

  // GET /path?page=...&...
  // Loop until page > totalPage (with safety break).
  // Validate totalPage integer >= 1.

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (page > 500) {
      throw new Error("Paging safety break triggered: page > 500.");
    }

    const options = { method };
    if (method === "GET") {
      options.query = { ...queryBase, page };
    } else {
      options.body = { ...(bodyBase || {}), page };
      if (queryBase && Object.keys(queryBase).length > 0) {
        options.query = { ...queryBase };
      }
    }

    const payload = await apiRequest(pathname, options);

    const items = extractItems(payload);
    allItems.push(...items);

    if (totalPage == null) {
      const tp =
        payload && typeof payload.totalPage === "number"
          ? payload.totalPage
          : 1;
      if (!Number.isInteger(tp) || tp < 1) {
        throw new Error(`Invalid totalPage value in response: ${String(tp)}`);
      }
      totalPage = tp;
    }

    page += 1;
    if (page > totalPage) {
      break;
    }
  }

  return allItems;
}
