export const UI_LOCALE = "zh-CN";

function toDate(value: Date | string | number) {
  return value instanceof Date ? value : new Date(value);
}

export function formatUiDate(
  value: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
) {
  return toDate(value).toLocaleDateString(UI_LOCALE, options);
}

export function formatUiTime(
  value: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
) {
  return toDate(value).toLocaleTimeString(UI_LOCALE, options);
}

export function formatUiDateTime(
  value: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
) {
  return toDate(value).toLocaleString(UI_LOCALE, options);
}

export function formatRelativeFromNow(value: Date | string | number) {
  const diffMs = Date.now() - toDate(value).getTime();
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;

  return `${Math.floor(hours / 24)} 天前`;
}
