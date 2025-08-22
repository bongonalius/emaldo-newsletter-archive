// app/api/simple-auth/login/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const AUTH_COOKIE = "ea_auth";   // must match middleware.ts
const EMAIL_COOKIE = "ea_email";

function isProd() {
  return process.env.NODE_ENV === "production";
}

export async function POST(req: Request) {
  // ---- 1) Parse body safely
  let email = "";
  let password = "";
  try {
    const body = await req.json();
    email = String(body?.email ?? "").trim();
    password = String(body?.password ?? "");
  } catch {
    // ignore, handled by validation below
  }

  const allowedDomain = (process.env.ALLOWED_EMAIL_DOMAIN || "").toLowerCase();
  const domain = email.split("@")[1]?.toLowerCase();

  if (!email || !password) {
    return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
  }
  if (!allowedDomain) {
    return NextResponse.json(
      { error: "Server misconfigured (ALLOWED_EMAIL_DOMAIN missing)" },
      { status: 500 }
    );
  }
  if (!domain || domain !== allowedDomain) {
    return NextResponse.json({ error: `Email must be @${allowedDomain}` }, { status: 400 });
  }

  // ---- 2) Verify password (DB-stored bcrypt hash takes precedence)
  let ok = false;
  try {
    const secret = await prisma.secret.findUnique({ where: { key: "shared_password_hash" } });
    if (secret?.value) {
      ok = await bcrypt.compare(password, secret.value);
    } else {
      const fallback = process.env.SHARED_PASSWORD || "";
      ok = fallback.length > 0 && password === fallback;
    }
  } catch {
    return NextResponse.json({ error: "Auth check failed" }, { status: 500 });
  }

  if (!ok) {
    const res = NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    // Clear any stray cookies on failure
    res.cookies.set(AUTH_COOKIE, "", { path: "/", maxAge: 0 });
    res.cookies.set(EMAIL_COOKIE, "", { path: "/", maxAge: 0 });
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  // ---- 3) Success → set cookies the middleware expects
  const res = NextResponse.json({ ok: true, next: "/archive" });

  // IMPORTANT: Do NOT set the "domain" attribute; let the browser scope to current host.
  res.cookies.set(AUTH_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd(),      // secure on Vercel, not required locally
    path: "/",
    maxAge: 60 * 60 * 8,   // 8 hours
  });

  // Optional helper cookie for UI (not httpOnly so client can read it)
  res.cookies.set(EMAIL_COOKIE, email, {
    httpOnly: false,
    sameSite: "lax",
    secure: isProd(),
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  // Never cache auth responses
  res.headers.set("Cache-Control", "no-store");
  return res;
}
