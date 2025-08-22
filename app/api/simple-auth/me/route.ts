import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // Read cookies from the request (Next.js passes them via headers)
  // In App Router, we can't use cookies() in a route handler typed as Request easily;
  // instead parse from Cookie header:
  const cookie = (request.headers.get("cookie") || "");
  const map = Object.fromEntries(
    cookie.split(";").map(s => s.trim().split("=").map(decodeURIComponent)).filter(x => x.length === 2)
  );
  const email = map["emaldo_email"] || "";
  const admin = (process.env.ADMIN_EMAIL || "").toLowerCase();
  const isAdmin = email.toLowerCase() === admin;
  const ok = map["emaldo_auth"] === "ok";
  return NextResponse.json({ ok, email, isAdmin });
}
