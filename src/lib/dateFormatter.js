function toDate(value) {
  if (value instanceof Date) return new Date(value.getTime());
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateDDMMYYYY(value, fallback = 'N/A') {
  const date = toDate(value);
  if (!date) return fallback;

  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function formatDateRangeDDMMYYYY(startValue, endValue, fallback = 'N/A') {
  const start = formatDateDDMMYYYY(startValue, fallback);
  const end = formatDateDDMMYYYY(endValue, fallback);
  if (start === fallback && end === fallback) return fallback;
  return `${start} - ${end}`;
}
