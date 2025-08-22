import { NextResponse } from 'next/server';
import DOMPurify from 'isomorphic-dompurify';
import { kget, kpost } from '@/lib/klaviyo';
import { prisma } from '@/lib/prisma';

/**
 * Resilient Klaviyo importer
 * - Tries several campaign list URLs (some accounts/revisions 404 on certain filters)
 * - Filters to sent campaigns in code
 * - For each message, resolves template (include relation or fallback endpoint) then renders HTML
 * - Upserts by messageId; logs results; returns JSON even on error
 */

type KJson = Record<string, any>;

/** Try a list of URLs until one succeeds. Return `data` array (or empty). */
async function tryCampaignList(cursor: string | null): Promise<KJson[]> {
  const urls: string[] = [];

  // 1) Most specific filter (may 404 on some revisions)
  const andFilter = encodeURIComponent(`and(equals(messages.channel,"email"),equals(status,"sent"))`);
  urls.push(
    cursor
      ? `/api/campaigns?filter=${andFilter}&page[cursor]=${encodeURIComponent(cursor)}`
      : `/api/campaigns?filter=${andFilter}`
  );

  // 2) Channel-only filter (filter sent later in code)
  const chanFilter = encodeURIComponent(`equals(messages.channel,"email")`);
  urls.push(
    cursor
      ? `/api/campaigns?filter=${chanFilter}&page[cursor]=${encodeURIComponent(cursor)}`
      : `/api/campaigns?filter=${chanFilter}`
  );

  // 3) No filter (some tenants allow this; we’ll filter in code)
  urls.push(
    cursor
      ? `/api/campaigns?page[cursor]=${encodeURIComponent(cursor)}`
      : `/api/campaigns`
  );

  for (const url of urls) {
    try {
      const res = await kget(url);
      const list = Array.isArray(res?.data) ? res.data : [];
      // attach pagination link for outer loop to consume
      (list as any).__next = res?.links?.next ?? null;
      return list;
    } catch (e: any) {
      // If 404 or other error, try next variant
      continue;
    }
  }
  // If all failed, surface a clean error
  throw new Error('All campaign list variants failed (404).');
}

export async function POST() {
  const log = await prisma.importLog.create({ data: { status: 'RUNNING' } });

  let added = 0;
  let updated = 0;

  try {
    let cursor: string | null = null;

    do {
      const campaigns = await tryCampaignList(cursor);
      // pagination next link (attached by helper)
      const nextLink: string | null = (campaigns as any).__next ?? null;

      // Only keep sent + email campaigns (defensive)
      const filtered: KJson[] = campaigns.filter((c: any) => {
        const status = c?.attributes?.status;
        const channel = c?.attributes?.messages?.[0]?.attributes?.channel
          ?? c?.attributes?.message_channel
          ?? c?.attributes?.channel
          ?? null;
        const isEmail = String(channel || '').toLowerCase() === 'email';
        return status === 'sent' || isEmail; // keep if email or sent; we’ll re-check message send below
      });

      for (const c of filtered) {
        const cid = c?.id as string;
        if (!cid) continue;

        // Fetch messages for the campaign
        const msgsResp = await kget(`/api/campaigns/${cid}/campaign-messages`);
        const messages: KJson[] = Array.isArray(msgsResp?.data) ? msgsResp.data : [];

        for (const m of messages) {
          try {
            const mid = m?.id as string;
            if (!mid) continue;

            // Pull message meta (subject, send times, etc.)
            const meta = await kget(`/api/campaign-messages/${mid}`);

            // Skip if not actually sent yet (best-effort guard)
            const sentAtStr =
              meta?.data?.attributes?.send_times?.[0]?.datetime ||
              c?.attributes?.send_time ||
              null;
            if (!sentAtStr) {
              // not yet sent; skip
              continue;
            }

            // Resolve template: prefer ?include=template, else dedicated endpoint
            const msgWithTpl = await kget(`/api/campaign-messages/${mid}?include=template`);
            const tplRelId = msgWithTpl?.data?.relationships?.template?.data?.id;
            const tplInclId = Array.isArray(msgWithTpl?.included)
              ? msgWithTpl.included.find((i: any) => i?.type === 'template')?.id
              : undefined;

            let templateIdToRender: string | undefined =
              (tplRelId || tplInclId) as string | undefined;

            if (!templateIdToRender) {
              try {
                const tplResp = await kget(`/api/campaign-messages/${mid}/template`);
                templateIdToRender = tplResp?.data?.id as string | undefined;
              } catch {
                // ignore, will skip below if still not found
              }
            }
            if (!templateIdToRender) continue;

            // Render final HTML/text with neutral context (no personalization)
            const rendered = await kpost(`/api/template-render`, {
              data: {
                type: 'template',
                id: templateIdToRender,
                attributes: { context: {} },
              },
            });

            const subject =
              meta?.data?.attributes?.definition?.content?.subject ||
              c?.attributes?.name ||
              'Newsletter';

            const fromEmail = meta?.data?.attributes?.from_email ?? null;
            const previewText =
              meta?.data?.attributes?.definition?.content?.preview_text ?? null;

            const htmlRaw = rendered?.data?.attributes?.html ?? '';
            const textRaw = rendered?.data?.attributes?.text ?? null;

            const cleanHtml = DOMPurify.sanitize(htmlRaw);
            const sentAt = new Date(sentAtStr);

            // Idempotent upsert on messageId
            const existing = await prisma.newsletter.findUnique({
              where: { messageId: mid },
            });

            if (existing) {
              await prisma.newsletter.update({
                where: { messageId: mid },
                data: {
                  subject,
                  fromEmail,
                  previewText,
                  sentAt,
                  html: cleanHtml,
                  text: textRaw,
                },
              });
              updated++;
            } else {
              await prisma.newsletter.create({
                data: {
                  campaignId: cid,
                  messageId: mid,
                  subject,
                  fromEmail,
                  previewText,
                  sentAt,
                  html: cleanHtml,
                  text: textRaw,
                  tags: [],
                },
              });
              added++;
            }
          } catch {
            // continue to next message
            continue;
          }
        }
      }

      // advance pagination cursor if present
      cursor = nextLink ? new URL(nextLink).searchParams.get('page[cursor]') : null;
    } while (cursor);

    await prisma.importLog.update({
      where: { id: log.id },
      data: {
        status: 'SUCCESS',
        note: `added=${added}, updated=${updated}`,
        finishedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, added, updated });
  } catch (e: any) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: {
        status: 'ERROR',
        note: e?.message ?? 'unknown',
        finishedAt: new Date(),
      },
    });

    return NextResponse.json(
      { ok: false, error: e?.message ?? 'Server error' },
      { status: 500 }
    );
  }
}
