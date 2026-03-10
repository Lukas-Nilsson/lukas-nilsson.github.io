import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/supabase/auth-guard';
import { createTimeEntry, updateTimeEntry, deleteTimeEntry, getAllTasks, updateTask } from '@/lib/clickup';
import { getAccessToken, createEvent, updateEvent, deleteEvent, CalendarToken } from '@/lib/google-calendar';
import { createClient } from '@/lib/supabase/server';

/**
 * Helper: get a valid Google Calendar access token from stored credentials.
 * Uses the 'personal' account by default.
 */
async function getGCalToken(account = 'personal'): Promise<{ access_token: string; supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never } | null> {
    const supabase = await createClient();
    const { data: token } = await supabase
        .from('calendar_tokens')
        .select('*')
        .eq('account', account)
        .single();

    if (!token) return null;

    try {
        const { access_token, expires_at } = await getAccessToken(token as CalendarToken);
        // Update stored token
        await supabase.from('calendar_tokens').update({
            access_token,
            token_expiry: expires_at.toISOString(),
        }).eq('account', account);
        return { access_token, supabase } as { access_token: string; supabase: Awaited<ReturnType<typeof createClient>> };
    } catch (e) {
        console.error('[schedule] GCal token refresh failed:', e);
        return null;
    }
}

/**
 * POST /api/dashboard/tasks/schedule
 * Schedule a work session for a ClickUp task.
 * Creates: ClickUp time entry + Google Calendar event + Supabase record.
 * 
 * Body: { clickup_id, start_time (ISO), end_time (ISO), task_name? }
 */
export async function POST(req: NextRequest) {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    try {
        const { clickup_id, start_time, end_time, task_name } = await req.json();
        if (!clickup_id || !start_time || !end_time) {
            return NextResponse.json({ error: 'Missing clickup_id, start_time, or end_time' }, { status: 400 });
        }

        const startMs = new Date(start_time).getTime();
        const endMs = new Date(end_time).getTime();

        if (endMs <= startMs) {
            return NextResponse.json({ error: 'end_time must be after start_time' }, { status: 400 });
        }

        // 1. Create ClickUp time entry
        const entry = await createTimeEntry(clickup_id, startMs, endMs);

        // 2. Create Google Calendar event
        let google_event_id: string | null = null;
        let google_etag: string | null = null;
        const gcal = await getGCalToken();
        if (gcal) {
            try {
                const title = task_name || `ClickUp: ${clickup_id}`;
                const googleEvent = await createEvent(gcal.access_token, 'primary', {
                    summary: title,
                    description: `ClickUp task: ${clickup_id}\nTime entry: ${entry.id}`,
                    start: { dateTime: start_time, timeZone: 'Australia/Melbourne' },
                    end: { dateTime: end_time, timeZone: 'Australia/Melbourne' },
                });
                google_event_id = googleEvent.id;
                google_etag = googleEvent.etag;

                // 3. Save to Supabase calendar_events for tracking
                const now = new Date().toISOString();
                await gcal.supabase.from('calendar_events').insert({
                    google_event_id,
                    google_calendar_id: 'primary',
                    account: 'personal',
                    title,
                    start_time,
                    end_time,
                    all_day: false,
                    source: 'clickup_time',
                    source_id: clickup_id,
                    status: 'confirmed',
                    google_etag,
                    synced_at: now,
                    created_at: now,
                    updated_at: now,
                    metadata: JSON.stringify({ time_entry_id: entry.id, clickup_task_id: clickup_id }),
                });
            } catch (e) {
                console.error('[schedule POST] GCal push failed, time entry still created:', e);
            }
        }

        // Bust the task cache
        await getAllTasks({ bustCache: true });

        return NextResponse.json({ ok: true, time_entry: entry, google_event_id });
    } catch (e) {
        console.error('[schedule POST]', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

/**
 * PATCH /api/dashboard/tasks/schedule
 * Update a time entry and optionally update the ClickUp task status.
 * Also syncs changes to Google Calendar.
 * 
 * Body: { entry_id, start_time? (ISO), end_time? (ISO), clickup_task_id?, task_status? }
 */
export async function PATCH(req: NextRequest) {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    try {
        const { entry_id, start_time, end_time, clickup_task_id, task_status } = await req.json();
        if (!entry_id) {
            return NextResponse.json({ error: 'Missing entry_id' }, { status: 400 });
        }

        // Update ClickUp time entry (start/end)
        const updates: { start?: number; end?: number; duration?: number } = {};
        if (start_time) updates.start = new Date(start_time).getTime();
        if (end_time) updates.end = new Date(end_time).getTime();
        if (updates.start && updates.end) updates.duration = updates.end - updates.start;

        let entry = null;
        if (Object.keys(updates).length > 0) {
            entry = await updateTimeEntry(entry_id, updates);
        }

        // Optionally update ClickUp task status
        if (clickup_task_id && task_status) {
            await updateTask(clickup_task_id, { status: task_status });
            await getAllTasks({ bustCache: true });
        }

        // Sync to Google Calendar — find the matching Supabase event by time_entry_id in metadata
        try {
            const gcal = await getGCalToken();
            if (gcal) {
                // Find the Supabase event with this time_entry_id in metadata
                const { data: events } = await gcal.supabase
                    .from('calendar_events')
                    .select('*')
                    .eq('source', 'clickup_time')
                    .ilike('metadata', `%${entry_id}%`);

                const supaEvent = events?.[0];
                if (supaEvent?.google_event_id) {
                    const gcalUpdates: Record<string, unknown> = {};
                    if (start_time) gcalUpdates.start = { dateTime: start_time, timeZone: 'Australia/Melbourne' };
                    if (end_time) gcalUpdates.end = { dateTime: end_time, timeZone: 'Australia/Melbourne' };

                    if (Object.keys(gcalUpdates).length > 0) {
                        await updateEvent(gcal.access_token, 'primary', supaEvent.google_event_id, gcalUpdates);
                        // Update Supabase record
                        const supaUpdates: Record<string, string> = { updated_at: new Date().toISOString() };
                        if (start_time) supaUpdates.start_time = start_time;
                        if (end_time) supaUpdates.end_time = end_time;
                        await gcal.supabase.from('calendar_events')
                            .update(supaUpdates)
                            .eq('id', supaEvent.id);
                    }
                }
            }
        } catch (e) {
            console.error('[schedule PATCH] GCal sync failed:', e);
        }

        return NextResponse.json({ ok: true, time_entry: entry });
    } catch (e) {
        console.error('[schedule PATCH]', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

/**
 * DELETE /api/dashboard/tasks/schedule?entry_id=...
 * Delete a time entry and its Google Calendar event.
 */
export async function DELETE(req: NextRequest) {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    try {
        const entryId = req.nextUrl.searchParams.get('entry_id');
        if (!entryId) {
            return NextResponse.json({ error: 'Missing entry_id' }, { status: 400 });
        }

        // Delete ClickUp time entry
        await deleteTimeEntry(entryId);

        // Delete from Google Calendar + Supabase
        try {
            const gcal = await getGCalToken();
            if (gcal) {
                const { data: events } = await gcal.supabase
                    .from('calendar_events')
                    .select('*')
                    .eq('source', 'clickup_time')
                    .ilike('metadata', `%${entryId}%`);

                const supaEvent = events?.[0];
                if (supaEvent?.google_event_id) {
                    await deleteEvent(gcal.access_token, 'primary', supaEvent.google_event_id);
                    await gcal.supabase.from('calendar_events').delete().eq('id', supaEvent.id);
                }
            }
        } catch (e) {
            console.error('[schedule DELETE] GCal cleanup failed:', e);
        }

        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error('[schedule DELETE]', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
