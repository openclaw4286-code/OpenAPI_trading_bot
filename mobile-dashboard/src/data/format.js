// Display formatters. Keep parsing/UI math in one place so the screens
// only deal with already-formatted strings.

export const formatKrw = (n, { sign = false } = {}) => {
  if (n == null || Number.isNaN(n)) return '-';
  const abs = Math.abs(Math.round(n));
  const body = `₩${abs.toLocaleString('ko-KR')}`;
  if (!sign) return body;
  if (n > 0) return `+${body}`;
  if (n < 0) return `-${body}`;
  return body;
};

export const formatPct = (frac, { sign = false, digits = 2 } = {}) => {
  if (frac == null || Number.isNaN(frac)) return '-';
  const v = (frac * 100).toFixed(digits);
  if (!sign) return `${v}%`;
  if (frac > 0) return `+${v}%`;
  if (frac < 0) return `${v}%`;
  return `${v}%`;
};

export const formatPrice = (n) =>
  n == null ? '-' : Math.round(n).toLocaleString('ko-KR');

export const formatRMultiple = (r) => {
  if (r == null || Number.isNaN(r)) return '-';
  const sign = r > 0 ? '+' : '';
  return `${sign}${r.toFixed(2)}R`;
};

// "12s ago" / "3m ago" relative formatter for short-lived timestamps.
export const formatAgo = (tsMs) => {
  const diff = Math.max(0, Date.now() - tsMs);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
};

export const sentimentColor = (n) => {
  if (n > 0) return 'var(--state-positive)';
  if (n < 0) return 'var(--state-negative)';
  return 'var(--text-secondary)';
};
