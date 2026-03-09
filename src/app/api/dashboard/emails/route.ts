import { requireAuth } from '@/lib/supabase/auth-guard';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAccessToken } from '@/lib/google-calendar';
import { NextResponse } from 'next/server';

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';

/**
 * GET /api/dashboard/emails
 *
 * Fetches recent important/unread emails from Gmail.
 * Returns up to 8 emails with subject, from, date, snippet, and Gmail link.
 */
export async function GET() {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    try {
        const supabase = createAdminClient();

        // Get Google token (use personal account)
        const { data: tokenRow } = await supabase
            .from('integration_tokens')
            .select('*')
            .eq('provider', 'google')
            .eq('account', 'personal')
            .single();

        if (!tokenRow?.refresh_token) {
            return NextResponse.json({ emails: [], error: 'Google not connected' });
        }

        const { access_token } = await getAccessToken(tokenRow);

        // Fetch recent important/unread messages
        const listRes = await fetch(
            `${GMAIL_API}/users/me/messages?maxResults=8&q=is:unread OR is:important newer_than:2d`,
            { headers: { Authorization: `Bearer ${access_token}` } }
        );

        if (!listRes.ok) {
            const text = await listRes.text();
            // If 403/401, likely missing Gmail scope
            if (listRes.status === 403 || listRes.status === 401) {
                return NextResponse.json({
                    emails: [],
                    error: 'Gmail scope not authorized. Re-connect Google account to grant email access.',
                    needsReauth: true,
                });
            }
            return NextResponse.json({ emails: [], error: `Gmail API error: ${text}` });
        }

        const listData = await listRes.json();
        const messageIds: string[] = (listData.messages ?? []).map((m: { id: string }) => m.id);

        if (!messageIds.length) {
            return NextResponse.json({ emails: [] });
        }

        // Fetch each message's metadata
        const emails = await Promise.all(
            messageIds.slice(0, 8).map(async (id) => {
                const msgRes = await fetch(
                    `${GMAIL_API}/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
                    { headers: { Authorization: `Bearer ${access_token}` } }
                );
                if (!msgRes.ok) return null;
                const msg = await msgRes.json();

                const headers = msg.payload?.headers ?? [];
                const getHeader = (name: string) =>
                    headers.find((h: { name: string; value: string }) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

                const from = getHeader('From');
                // Extract name from "Name <email>" format
                const fromName = from.includes('<') ? from.split('<')[0].trim().replace(/"/g, '') : from;

                return {
                    id: msg.id,
                    threadId: msg.threadId,
                    subject: getHeader('Subject') || '(no subject)',
                    from: fromName,
                    fromEmail: from.match(/<(.+)>/)?.[1] ?? from,
                    date: getHeader('Date'),
                    snippet: msg.snippet ?? '',
                    unread: (msg.labelIds ?? []).includes('UNREAD'),
                    important: (msg.labelIds ?? []).includes('IMPORTANT'),
                    url: `https://mail.google.com/mail/u/0/#inbox/${msg.threadId}`,
                };
            })
        );

        return NextResponse.json({
            emails: emails.filter(Boolean),
        });

    } catch (err) {
        console.error('[emails] Error:', err);
        return NextResponse.json({ emails: [], error: String(err) });
    }
}
