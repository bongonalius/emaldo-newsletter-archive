import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));
  const domain = String(email || "").split("@")[1]?.toLowerCase();
  const allowed = (process.env.ALLOWED_EMAIL_DOMAIN || "").toLowerCase();

  if (!email || !password) {
    return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
  }
  if (!domain || domain !== allowed) {
    return NextResponse.json({ error: `Email must be @${allowed}` }, { status: 400 });
  }

  // 1) Prefer DB-stored hash
  const secret = await prisma.secret.findUnique({ where: { key: "shared_password_hash" } });
  let ok = false;

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

  // Set simple cookies
  const res = NextResponse.json({ ok: true, next: "/archive" });
  res.cookies.set("emaldo_auth", "ok", { httpOnly: true, path: "/", sameSite: "lax" });
  res.cookies.set("emaldo_email", email, { httpOnly: false, path: "/", sameSite: "lax" });
  return res;
}
