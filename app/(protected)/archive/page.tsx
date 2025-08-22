"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";

type Newsletter = {
  id: string;
  subject: string;
  previewText: string | null;
  sentAt: string; // ISO
};

function normalizeResponse(d: any): Newsletter[] {
  const raw: any[] = Array.isArray(d)
    ? d
    : Array.isArray(d?.items)
    ? d.items
    : Array.isArray(d?.data)
    ? d.data
    : [];

  return raw
    .map((n: any) => ({
      id: String(n?.id ?? n?.messageId ?? crypto.randomUUID()),
      subject: String(n?.subject ?? ""),
      previewText: n?.previewText ?? null,
      sentAt: String(n?.sentAt ?? n?.createdAt ?? new Date().toISOString()),
    }))
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
}

function monthLabel(date: Date) {
  return date.toLocaleString(undefined, { month: "long" });
}

export default function ArchivePage() {
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/newsletters", { cache: "no-store" });
        const j = await r.json();
        if (!cancelled) setNewsletters(normalizeResponse(j));
      } catch {
        if (!cancelled) setNewsletters([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function runImport() {
    setLoading(true);
    try {
      await fetch("/api/admin/klaviyo/sync", { method: "POST" });
      const r = await fetch("/api/newsletters", { cache: "no-store" });
      const j = await r.json();
      setNewsletters(normalizeResponse(j));
    } finally {
      setLoading(false);
    }
  }

  const list = useMemo(() => {
    const src = newsletters;
    const q = query.trim().toLowerCase();
    if (!q) return src;
    return src.filter((n) => {
      const dateStr = new Date(n.sentAt).toLocaleString().toLowerCase();
      return (
        n.subject.toLowerCase().includes(q) ||
        (n.previewText ?? "").toLowerCase().includes(q) ||
        dateStr.includes(q)
      );
    });
  }, [query, newsletters]);

  const grouped = useMemo(() => {
    const buckets = new Map<number, Map<number, Newsletter[]>>();
    for (const n of list) {
      const d = new Date(n.sentAt);
      const y = d.getFullYear();
      const m = d.getMonth();
      if (!buckets.has(y)) buckets.set(y, new Map());
      const byMonth = buckets.get(y)!;
      if (!byMonth.has(m)) byMonth.set(m, []);
      byMonth.get(m)!.push(n);
    }
    const years = Array.from(buckets.keys()).sort((a, b) => b - a);
    return years.map((y) => {
      const monthsMap = buckets.get(y)!;
      const months = Array.from(monthsMap.keys()).sort((a, b) => b - a);
      return { year: y, months: months.map((m) => ({ month: m, items: monthsMap.get(m)! })) };
    });
  }, [list]);

  return (
    <div>
      <Header onImport={runImport} />

      <main className="max-w-6xl mx-auto p-6 mt-16">
        <div className="mb-6 flex gap-3 items-center">
          <input
            className="border rounded-xl px-3 py-2 flex-1"
            placeholder="Search by subject, preview or date…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {loading && <span className="text-sm text-gray-500">Importing…</span>}
        </div>

        {grouped.length === 0 ? (
          <p className="text-gray-500">No newsletters match your search.</p>
        ) : (
          <div className="relative">
            <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-200" aria-hidden />
            <div className="space-y-10">
              {grouped.map(({ year, months }) => (
                <section key={year}>
                  <h2 className="text-xl font-semibold mb-4">{year}</h2>
                  <div className="space-y-8">
                    {months.map(({ month, items }) => {
                      const label = monthLabel(new Date(year, month, 1));
                      return (
                        <div key={`${year}-${month}`}>
                          <div className="sticky top-16 z-0 bg-gray-50/80 backdrop-blur -mx-6 px-6 py-2 border-y">
                            <h3 className="text-sm font-medium uppercase tracking-wide text-gray-600">
                              {label}
                            </h3>
                          </div>
                          <ul className="mt-4 space-y-3">
                            {items.map((n) => {
                              const when = new Date(n.sentAt).toLocaleString();
                              return (
                                <li key={n.id} className="relative pl-10">
                                  <span
                                    className="absolute left-2 top-4 h-2.5 w-2.5 rounded-full bg-gray-300 ring-4 ring-gray-50"
                                    aria-hidden
                                  />
                                  {/* CLICKABLE CARD */}
                                  <Link
                                    href={`/newsletters/${encodeURIComponent(n.id)}`}
                                    prefetch={false}
                                    className="block rounded-xl border bg-white p-4 hover:shadow focus:outline-none focus:ring-2 focus:ring-black/20 transition"
                                  >
                                    <div className="text-xs text-gray-500 mb-1">{when}</div>
                                    <div className="font-semibold leading-snug">{n.subject}</div>
                                    {n.previewText && (
                                      <div className="text-sm text-gray-600 mt-1 line-clamp-2">
                                        {n.previewText}
                                      </div>
                                    )}
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
