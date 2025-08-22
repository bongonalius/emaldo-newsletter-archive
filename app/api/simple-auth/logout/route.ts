// /app/api/simple-auth/logout/route.ts
import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true, message: "Logged out" });

  // Clear both cookies set during login
  res.cookies.set("ea_auth", "", {
    httpOnly: true,
    path: "/",
    maxAge: 0, // expire immediately
  });

  res.cookies.set("emaldo_email", "", {
    httpOnly: false,
    path: "/",
    maxAge: 0,
  });

  return res;
}
