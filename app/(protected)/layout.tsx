import { redirect } from "next/navigation";
import { StackServerApp } from "@stackframe/nextjs/app";

export const dynamic = "force-dynamic"; // never cache protected pages

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const app = new StackServerApp();
  const user = await app.getUser(); // null if not signed in

  if (!user) {
    redirect(`/handler/sign-in?redirect=/archive`);
  }

  const email = (user.email || "").toLowerCase();
  if (!email.endsWith("@emaldo.com")) {
    redirect("/not-allowed");
  }

  return <>{children}</>;
}
