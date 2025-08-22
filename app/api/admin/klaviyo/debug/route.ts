import { NextResponse } from 'next/server';
import { kget } from '@/lib/klaviyo';

export async function GET() {
  const revision = process.env.KLAVIYO_API_REVISION || 'unset';
  const key = process.env.KLAVIYO_API_KEY || 'unset';

  // Hide most of the key in the response
  const keyMasked =
    key === 'unset' ? 'unset' : `${key.slice(0, 4)}…${key.slice(-4)} (${key.length} chars)`;

  const results: any = { revision, keyMasked, checks: [] as any[] };

  async function tryCheck(label: string, path: string) {
    try {
      const res = await kget(path);
      const len = Array.isArray(res?.data) ? res.data.length : 0;
      results.checks.push({ label, path, ok: true, length: len, sample: res?.data?.[0] ?? null });
    } catch (e: any) {
      results.checks.push({ label, path, ok: false, error: e?.message ?? String(e) });
    }
  }

  // Try multiple variants so we can see what's available on your tenant/revision
  await tryCheck('campaigns (no filter)', `/api/campaigns`);
  await tryCheck(
    'campaigns filter: channel=email',
    `/api/campaigns?filter=${encodeURIComponent(`equals(messages.channel,"email")`)}`
  );
  await tryCheck(
    'campaigns filter: channel=email AND status=sent',
    `/api/campaigns?filter=${encodeURIComponent(`and(equals(messages.channel,"email"),equals(status,"sent"))`)}`
  );

  // (Optional) other resources to see if JSON:API is working in general
  await tryCheck('lists (sanity)', `/api/lists`);
  await tryCheck('segments (sanity)', `/api/segments`);

  return NextResponse.json(results, { status: 200 });
}
