// middleware.ts
import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE = "ea_auth";

// Keep this tiny so we can prove middleware is running.
// If not signed in, redirect everything except a few open paths.
const OPEN_PREFIXES = [
  "/signin",
  "/api/simple-auth",         // login/logout endpoints
  "/_next",                   // Next assets
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/public",
];

function isOpen(pathname: string) {
  if (OPEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) return true;
  // allow files like /images/foo.png
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) return true;
  return false;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isOpen(pathname)) {
    const res = NextResponse.next();
    res.headers.set("x-mw", "open");
    return res;
  }

  const authed = req.cookies.get(AUTH_COOKIE)?.value === "1";
  if (authed) {
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "no-store");
    res.headers.set("x-mw", "pass");
    return res;
  }

  const url = req.nextUrl.clone();
  url.pathname = "/signin";
  url.searchParams.set("redirect", pathname || "/archive");

  const res = NextResponse.redirect(url, 307);
  res.headers.set("x-mw", "redirect-signin");
  return res;
}

// Match everything except Next’s internal assets and a few public files.
export const config = {
  matcher: ["/((?!_next/|favicon.ico|robots.txt|sitemap.xml|public/).*)"],
};
