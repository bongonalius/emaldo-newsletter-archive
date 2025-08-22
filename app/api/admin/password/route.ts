import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const c = cookies();
  const email = c.get("emaldo_email")?.value?.toLowerCase() || "";
  const admin = (process.env.ADMIN_EMAIL || "").toLowerCase();
  if (email !== admin) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const current: string = body?.current ?? "";
  const nextPass: string = body?.next ?? "";

  if (!nextPass || nextPass.length < 8) {
    return NextResponse.json({ ok: false, error: "New password must be at least 8 characters" }, { status: 400 });
  }

  const secret = await prisma.secret.findUnique({ where: { key: "shared_password_hash" } });
  let currentOk = false;

  if (secret?.value) {
    currentOk = await bcrypt.compare(current, secret.value);
  } else {
    const sharedEnv = process.env.SHARED_PASSWORD || "";
    currentOk = sharedEnv.length > 0 && current === sharedEnv;
  }

  if (!currentOk) {
    return NextResponse.json({ ok: false, error: "Current password is incorrect" }, { status: 401 });
  }

  const hash = await bcrypt.hash(nextPass, 10);
  await prisma.secret.upsert({
    where: { key: "shared_password_hash" },
    update: { value: hash },
    create: { key: "shared_password_hash", value: hash },
  });

  return NextResponse.json({ ok: true });
}
