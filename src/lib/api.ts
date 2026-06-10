/**
 * Resolves API paths for local dev and production.
 * - If NEXT_PUBLIC_API_URL is set, calls Railway/backend directly.
 * - Otherwise uses same-origin /api/* which Vercel proxies to the backend.
 */
export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (base) return `${base}${normalized}`;
  return normalized;
}
