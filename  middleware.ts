// middleware.ts (repo root)
import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE = "ea_auth"; // must match the cookie set in /api/simple-auth/login

// Open paths that don't require auth
const OPEN_PREFIXES = [
  "/signin",
  "/api/simple-auth", // login/logout
  "/_next",           // Next assets
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/public"
];

function isOpenPath(pathname: string) {
  return (
    OPEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p)) ||
    // allow direct file requests like /images/foo.png
    /\.[a-zA-Z0-9]+$/.test(pathname)
  );
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Never block open paths
  if (isOpenPath(pathname)) return NextResponse.next();

  // Check session cookie
  const authed = req.cookies.get(AUTH_COOKIE)?.value === "1";
  if (authed) {
    // Also instruct CDN not to cache protected responses
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  // Redirect to /signin with return path
  const url = req.nextUrl.clone();
  url.pathname = "/signin";
  url.searchParams.set("redirect", pathname || "/archive");
  return NextResponse.redirect(url);
}

// Run on everything except explicitly open assets above
export const config = {
  matcher: ["/((?!_next/|favicon.ico|robots.txt|sitemap.xml|public/).*)"],
};
