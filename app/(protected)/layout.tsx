// app/(protected)/layout.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic"; // don't cache protected pages

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  // Must match /api/simple-auth/login: ea_auth = "1"
  const authed = cookies().get("ea_auth")?.value === "1";
  if (!authed) {
    redirect("/signin?redirect=/archive");
  }
  return <>{children}</>;
}
