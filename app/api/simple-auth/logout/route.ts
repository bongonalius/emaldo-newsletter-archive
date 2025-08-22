import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("emaldo_auth", "", { httpOnly: true, path: "/", maxAge: 0 });
  res.cookies.set("emaldo_email", "", { httpOnly: false, path: "/", maxAge: 0 });
  return res;
}
