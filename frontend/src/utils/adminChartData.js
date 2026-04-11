/**
 * Merge two `{ d, c }[]` daily series into sorted labels and aligned value arrays.
 */
export function mergeTwoDailySeries(seriesA, seriesB) {
  const dates = new Set();
  for (const r of seriesA || []) {
    if (r?.d) {
      dates.add(r.d);
    }
  }
  for (const r of seriesB || []) {
    if (r?.d) {
      dates.add(r.d);
    }
  }
  const labels = [...dates].sort();
  const mapA = Object.fromEntries((seriesA || []).filter((r) => r?.d).map((r) => [r.d, Number(r.c) || 0]));
  const mapB = Object.fromEntries((seriesB || []).filter((r) => r?.d).map((r) => [r.d, Number(r.c) || 0]));
  return {
    labels,
    a: labels.map((d) => mapA[d] ?? 0),
    b: labels.map((d) => mapB[d] ?? 0),
  };
}

/**
 * Top N exam slices + optional "Other" for doughnut / bar charts.
 */
export function examAttemptsForChart(rows, topN = 6) {
  const list = [...(rows || [])].sort((x, y) => Number(y.attempts_count) - Number(x.attempts_count));
  const top = list.slice(0, topN);
  const rest = list.slice(topN).reduce((s, r) => s + Number(r.attempts_count || 0), 0);
  const labels = top.map((r) => r.name || r.code || 'Exam');
  const data = top.map((r) => Number(r.attempts_count) || 0);
  if (rest > 0) {
    labels.push('Other');
    data.push(rest);
  }
  return { labels, data };
}
