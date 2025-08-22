export const KLAVIYO_BASE = 'https://a.klaviyo.com';

function headers() {
  const key = process.env.KLAVIYO_API_KEY;
  if (!key) throw new Error('KLAVIYO_API_KEY missing');
  return {
    Authorization: `Klaviyo-API-Key ${key}`,
    revision: process.env.KLAVIYO_API_REVISION || '2024-10-15', // pick a conservative known date
    'content-type': 'application/json'
  } as Record<string, string>;
}

export async function kget(path: string) {
  const res = await fetch(`${KLAVIYO_BASE}${path}`, { headers: headers(), cache: 'no-store' });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Klaviyo GET ${path} → ${res.status} :: ${body}`);
  }
  return res.json();
}

export async function kpost(path: string, body: any) {
  const res = await fetch(`${KLAVIYO_BASE}${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Klaviyo POST ${path} → ${res.status} :: ${text}`);
  }
  return res.json();
}
