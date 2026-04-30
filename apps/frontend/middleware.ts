import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_TOKEN_COOKIE = "omnichannel_auth_token";
const AUTH_EMAIL_COOKIE = "omnichannel_auth_email";
const ADMIN_EMAIL = "mk20040307@gmail.com";

const PUBLIC_ONLY_ROUTES = ["/signin", "/signup"];
const PROTECTED_ROUTES = ["/widget", "/admin"];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function isPublicOnlyPath(pathname: string): boolean {
  return PUBLIC_ONLY_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_TOKEN_COOKIE)?.value;
  const email = request.cookies.get(AUTH_EMAIL_COOKIE)?.value?.toLowerCase();
  const isAuthenticated = Boolean(token);

  if (isPublicOnlyPath(pathname) && isAuthenticated) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isProtectedPath(pathname) && !isAuthenticated) {
    const redirectUrl = new URL("/signin", request.url);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (!isAuthenticated) {
      const redirectUrl = new URL("/signin", request.url);
      redirectUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(redirectUrl);
    }
    if (email !== ADMIN_EMAIL) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/signin/:path*", "/signup/:path*", "/widget/:path*", "/admin/:path*"]
};
