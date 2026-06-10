/** Parse DB timestamps as local time (matches Activity Log page). */
export function parsePortalDate(date: string | Date | number | null | undefined): Date | null {
  if (date === undefined || date === null) return null;

  if (typeof date === "number") {
    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof date === "string") {
    const trimmed = date.trim();
    if (!trimmed) return null;
    // MySQL datetimes are local; JSON often adds a trailing Z — treat as local, not UTC.
    const localValue = trimmed.endsWith("Z") ? trimmed.slice(0, -1) : trimmed;
    const parsed = new Date(localValue);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatRelativeTime(date: string | Date | number | null | undefined): string {
  const d = parsePortalDate(date);
  if (!d || d.getFullYear() <= 1970) return "";

  const now = new Date();
  let diffMs = now.getTime() - d.getTime();
  if (diffMs < 0) diffMs = 0;

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec} sec ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? "s" : ""} ago`;

  const diffDays = Math.floor(diffHour / 24);
  if (diffDays < 30) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} month${diffMonths !== 1 ? "s" : ""} ago`;

  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears} year${diffYears !== 1 ? "s" : ""} ago`;
}
