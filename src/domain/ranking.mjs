export function rankTopN(list, n) {
  const sorted = [...list].sort((a, b) => {
    if (b.totalMinutes !== a.totalMinutes) {
      return b.totalMinutes - a.totalMinutes;
    }
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    const aId = String(a.empId ?? "");
    const bId = String(b.empId ?? "");
    return aId.localeCompare(bId);
  });

  return sorted.slice(0, n);
}

