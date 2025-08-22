"use client";
import React, { useEffect, useState } from "react";

type Me = {
  ok: boolean;
  email: string;
  isAdmin: boolean;
};

export default function Header({ onImport }: { onImport?: () => Promise<void> }) {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch("/api/simple-auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then(setMe)
      .catch(() => setMe({ ok: false, email: "", isAdmin: false }));
  }, []);

  async function logout() {
    await fetch("/api/simple-auth/logout", { method: "POST" });
    window.location.href = "/signin";
  }

  const isAdmin = !!me?.isAdmin;

  return (
    <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b h-16">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-3">
        <div className="text-lg font-semibold">Emaldo® Newsletter Archive</div>

        <div className="ml-auto flex items-center gap-3">
          {/* Removed the old readOnly search input, since the real search is in /archive */}
          {isAdmin && onImport && (
            <button
              onClick={onImport}
              className="rounded-xl border px-3 py-2 hover:shadow"
              title="Run Klaviyo import"
            >
              Run Import
            </button>
          )}

          <button onClick={logout} className="rounded-xl border px-3 py-2 hover:shadow">
            Sign out
          </button>

          {isAdmin && (
            <a href="/admin/security" className="rounded-xl border px-3 py-2 hover:shadow">
              Security
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
