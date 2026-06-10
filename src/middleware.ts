import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PREFIXES = [
  "/super-admin/dashboard",
  "/super-admin/profile",
  "/super-admin/settings",
  "/admin/",
  "/vendor/portal",
  "/vendor/relationships",
  "/vendor/orders",
  "/vendor/products",
  "/vendor/settings",
  "/vendor/employees",
  "/vendor/profile",
  "/vendor/shipping",
  "/restaurant/portal",
  "/restaurant/relationships",
  "/restaurant/place-order",
  "/restaurant/orders",
  "/restaurant/employees",
  "/restaurant/vendor",
  "/restaurant/profile",
  "/restaurant/settings",
  "/shipping-company/",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix),
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  // Client-side guards handle auth (localStorage JWT). Middleware only adds security headers.
  const response = NextResponse.next();
  response.headers.set("x-pathname", pathname);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js)$).*)"],
};
