/** Parse API/DB timestamps into a JavaScript Date (UTC-aware). */
export function parsePortalDate(date: string | Date | number | null | undefined): Date | null {
  if (date === undefined || date === null) return null;

  if (date instanceof Date) {
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof date === "number") {
    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof date === "string") {
    const trimmed = date.trim();
    if (!trimmed) return null;

    // ISO 8601 with timezone — keep Z/offset so the instant is correct everywhere.
    if (/[zZ]$/.test(trimmed) || /[+-]\d{2}:?\d{2}$/.test(trimmed)) {
      const parsed = new Date(trimmed);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    // Naive datetime strings from the DB are stored in UTC.
    const normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
    const parsed = new Date(`${normalized}Z`);
    if (!Number.isNaN(parsed.getTime())) return parsed;

    const fallback = new Date(trimmed);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  return null;
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

export function formatPortalTimestamp(date: string | Date | number | null | undefined): string {
  const d = parsePortalDate(date);
  if (!d || d.getFullYear() <= 1970) return "Unknown";

  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
