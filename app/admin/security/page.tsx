"use client";
import { useEffect, useState } from "react";

export default function SecurityPage() {
  const [current, setCurrent] = useState("");
  const [nextPass, setNextPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/simple-auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setIsAdmin(!!d?.isAdmin))
      .catch(() => setIsAdmin(false));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    if (nextPass !== confirm) { setErr("New passwords do not match"); return; }

    try {
      const res = await fetch("/api/admin/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ current, next: nextPass }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to update password");
      setMsg("Password updated successfully.");
      setCurrent(""); setNextPass(""); setConfirm("");
    } catch (e:any) {
      setErr(e.message);
    }
  }

  if (!isAdmin) return <main className="max-w-xl mx-auto p-6">Forbidden</main>;

  return (
    <main className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-semibold">Security</h1>
      <p className="text-sm text-gray-600 mt-1">
        Change the shared password used by all <strong>@emaldo.com</strong> users to sign in.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <input type="password" placeholder="Current password" value={current}
          onChange={(e) => setCurrent(e.target.value)} className="w-full border rounded-xl px-3 py-2" required />
        <input type="password" placeholder="New password (min 8 chars)" value={nextPass}
          onChange={(e) => setNextPass(e.target.value)} className="w-full border rounded-xl px-3 py-2" required minLength={8} />
        <input type="password" placeholder="Confirm new password" value={confirm}
          onChange={(e) => setConfirm(e.target.value)} className="w-full border rounded-xl px-3 py-2" required minLength={8} />
        <button className="rounded-xl bg-black text-white px-4 py-2.5 hover:opacity-90">Update Password</button>
        {msg && <div className="text-green-700 text-sm">{msg}</div>}
        {err && <div className="text-red-600 text-sm">{err}</div>}
      </form>
    </main>
  );
}
