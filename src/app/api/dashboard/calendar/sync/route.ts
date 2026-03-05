import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/supabase/auth-guard';
import { NextResponse } from 'next/server';
import { getAccessToken, listEvents } from '@/lib/google-calendar';
import type { CalendarToken } from '@/lib/google-calendar';

/**
 * POST /api/dashboard/calendar/sync
 * Triggers a background Google Calendar sync and returns the result.
 * Separated from GET so data reads are never blocked by sync latency.
 */
export async function POST() {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    try {
        const supabase = createAdminClient();
        const result = await syncFromGoogle(supabase);
        return NextResponse.json(result);
    } catch (e) {
        console.error('[calendar sync]', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

// ─── Sync Helper (batch upserts) ────────────────────────────────────────────

async function syncFromGoogle(
    supabase: ReturnType<typeof createAdminClient>,
): Promise<{ synced: boolean; eventCount: number; lastSyncedAt: string }> {
    const { data: tokens } = await supabase
        .from('calendar_tokens')
        .select('*');

    if (!tokens?.length) {
        return { synced: false, eventCount: 0, lastSyncedAt: new Date().toISOString() };
    }

    let totalEvents = 0;
    const now = new Date().toISOString();

    for (const token of tokens) {
        try {
            const { access_token, expires_at } = await getAccessToken(token as CalendarToken);

            // Update stored access token
            await supabase.from('calendar_tokens').update({
                access_token,
                token_expiry: expires_at.toISOString(),
            }).eq('account', token.account);

            // Fetch events (use syncToken for incremental, or wide date range)
            const result = await listEvents(access_token, 'primary', {
                syncToken: token.sync_token ?? undefined,
                timeMin: token.sync_token ? undefined : new Date(Date.now() - 30 * 86400000).toISOString(),
                timeMax: token.sync_token ? undefined : new Date(Date.now() + 90 * 86400000).toISOString(),
            });

            // Update sync token
            if (result.nextSyncToken) {
                await supabase.from('calendar_tokens').update({
                    sync_token: result.nextSyncToken,
                }).eq('account', token.account);
            }

            // Separate cancelled vs active events
            const cancelled = result.events.filter(ge => ge.status === 'cancelled');
            const active = result.events.filter(ge => ge.status !== 'cancelled');

            // Batch cancel
            if (cancelled.length > 0) {
                const cancelIds = cancelled.map(ge => ge.id);
                await supabase.from('calendar_events')
                    .update({ status: 'cancelled', updated_at: now })
                    .in('google_event_id', cancelIds)
                    .eq('google_calendar_id', 'primary');
            }

            // Batch upsert active events
            if (active.length > 0) {
                const rows = active.map(ge => {
                    const isAllDay = !!ge.start.date;
                    return {
                        google_event_id: ge.id,
                        google_calendar_id: 'primary',
                        account: token.account,
                        title: ge.summary ?? '(No title)',
                        description: ge.description ?? null,
                        location: ge.location ?? null,
                        start_time: isAllDay
                            ? new Date(ge.start.date + 'T00:00:00+11:00').toISOString()
                            : ge.start.dateTime!,
                        end_time: isAllDay
                            ? new Date(ge.end.date + 'T00:00:00+11:00').toISOString()
                            : ge.end.dateTime!,
                        all_day: isAllDay,
                        status: ge.status ?? 'confirmed',
                        recurrence: ge.recurrence?.[0] ?? null,
                        google_etag: ge.etag,
                        synced_at: now,
                        updated_at: now,
                    };
                });

                await supabase.from('calendar_events').upsert(rows, {
                    onConflict: 'google_event_id,google_calendar_id',
                    ignoreDuplicates: false,
                });
            }

            totalEvents += active.length + cancelled.length;
        } catch (e) {
            console.error(`[calendar sync] ${token.account} failed:`, e);
        }
    }

    return { synced: true, eventCount: totalEvents, lastSyncedAt: now };
}
