// app/api/simple-auth/login/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  // Body
  const { email, password } = await req.json().catch(() => ({} as any));

  // Query (?redirect=/path)
  const url = new URL(req.url);
  const redirect = url.searchParams.get("redirect") || "/archive";

  const allowed = (process.env.ALLOWED_EMAIL_DOMAIN || "").toLowerCase();
  const domain = String(email || "").split("@")[1]?.toLowerCase();

  if (!email || !password) {
    return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
  }
  if (!allowed) {
    return NextResponse.json({ error: "Server misconfigured: ALLOWED_EMAIL_DOMAIN missing" }, { status: 500 });
  }
  if (!domain || domain !== allowed) {
    return NextResponse.json({ error: `Email must be @${allowed}` }, { status: 400 });
  }

  // 1) Prefer DB-stored hash
  let ok = false;
  const secret = await prisma.secret.findUnique({ where: { key: "shared_password_hash" } });
  if (secret?.value) {
    ok = await bcrypt.compare(password, secret.value);
  } else {
    // 2) Fallback to env SHARED_PASSWORD if no DB value yet
    const shared = process.env.SHARED_PASSWORD || "";
    ok = shared.length > 0 && password === shared;
  }

  if (!ok) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  // --- Auth OK: set cookies ---
  const res = NextResponse.json({ ok: true, next: redirect });

  // Session cookie used by middleware
  res.cookies.set("ea_auth", "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  // Convenience (non-HTTPOnly) email cookie
  res.cookies.set("emaldo_email", email, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return res;
}
