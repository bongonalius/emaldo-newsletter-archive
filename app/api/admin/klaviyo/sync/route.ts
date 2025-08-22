import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import DOMPurify from 'isomorphic-dompurify';
import { kget, kpost } from '@/lib/klaviyo';
import { prisma } from '@/lib/prisma';

type J = Record<string, any>;

export async function POST() {
  // --- Admin-only guard (simple cookie-based auth) ---
  const c = cookies();
  const email = c.get('emaldo_email')?.value?.toLowerCase() || '';
  const admin = (process.env.ADMIN_EMAIL || '').toLowerCase();
  if (email !== admin) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  // --- Import log + counters ---
  const log = await prisma.importLog.create({ data: { status: 'RUNNING' } });

  let added = 0;
  let updated = 0;

  // Optional diagnostics
  let totalCampaigns = 0;
  let eligibleCampaigns = 0;
  let totalMessages = 0;
  let skippedNotSent = 0;
  let skippedNoTemplate = 0;

  try {
    // Klaviyo requires a channel filter to list campaigns.
    // We request email campaigns, then filter to status === "Sent" in code.
    const filterExpr = encodeURIComponent(`equals(messages.channel,'email')`);
    let cursor: string | null = null;

    do {
      const url = cursor
        ? `/api/campaigns?filter=${filterExpr}&page[cursor]=${encodeURIComponent(cursor)}`
        : `/api/campaigns?filter=${filterExpr}`;

      const resp = await kget(url);
      const campaigns: J[] = Array.isArray(resp?.data) ? resp.data : [];
      totalCampaigns += campaigns.length;

      for (const c of campaigns) {
        const cid: string | undefined = c?.id;
        const status: string | undefined = c?.attributes?.status; // "Sent", "Draft", ...
        if (!cid) continue;

        if (status !== 'Sent') {
          skippedNotSent++;
          continue;
        }
        eligibleCampaigns++;

        // Fetch messages for this campaign
        const msgsResp = await kget(`/api/campaigns/${cid}/campaign-messages`);
        const messages: J[] = Array.isArray(msgsResp?.data) ? msgsResp.data : [];
        totalMessages += messages.length;

        for (const m of messages) {
          try {
            const mid: string | undefined = m?.id;
            if (!mid) continue;

            // Pull message meta (subject, send times, etc.)
            const meta = await kget(`/api/campaign-messages/${mid}`);

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
                // ignore; we'll skip below if still not found
              }
            }

            if (!templateIdToRender) {
              skippedNoTemplate++;
              continue;
            }

            // Render final HTML/Text with a neutral context (no personalization)
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

            const sentAtStr =
              meta?.data?.attributes?.send_times?.[0]?.datetime ||
              c?.attributes?.send_time ||
              null;
            if (!sentAtStr) {
              skippedNotSent++;
              continue;
            }

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
            // continue with next message
            continue;
          }
        }
      }

      // pagination
      cursor = resp?.links?.next
        ? new URL(resp.links.next).searchParams.get('page[cursor]')
        : null;
    } while (cursor);

    // Success log + response
    await prisma.importLog.update({
      where: { id: log.id },
      data: {
        status: 'SUCCESS',
        note: `added=${added}, updated=${updated}, totalCampaigns=${totalCampaigns}, eligibleSent=${eligibleCampaigns}, msgs=${totalMessages}, skippedNotSent=${skippedNotSent}, skippedNoTemplate=${skippedNoTemplate}`,
        finishedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      added,
      updated,
      stats: {
        totalCampaigns,
        eligibleSent: eligibleCampaigns,
        totalMessages,
        skippedNotSent,
        skippedNoTemplate,
      },
    });
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
