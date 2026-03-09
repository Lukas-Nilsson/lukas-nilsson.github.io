import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/supabase/auth-guard';
import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, createEvent, updateEvent, deleteEvent } from '@/lib/google-calendar';
import type { CalendarToken } from '@/lib/google-calendar';
import { getAllTasks, mapClickUpTask } from '@/lib/clickup';

/**
 * GET /api/dashboard/calendar?start=ISO&end=ISO
 * Returns cached events from Supabase + ClickUp tasks with due dates.
 */
export async function GET(req: NextRequest) {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    try {
        const supabase = createAdminClient();
        const start = req.nextUrl.searchParams.get('start');
        const end = req.nextUrl.searchParams.get('end');

        // Query cached events from Supabase (no Google sync — always fast)
        let query = supabase
            .from('calendar_events')
            .select('*')
            .neq('status', 'cancelled')
            .order('start_time', { ascending: true });

        if (start) query = query.gte('end_time', start);
        if (end) query = query.lte('start_time', end);

        const { data: events, error } = await query;
        if (error) throw error;

        // Get connected accounts
        const { data: tokens } = await supabase
            .from('calendar_tokens')
            .select('account,email');

        // ── ClickUp tasks with due dates → calendar items ──
        let clickupTaskEvents: Record<string, unknown>[] = [];
        try {
            const { tasks: clickupTasks } = await getAllTasks();

            const priorityLabels: Record<number, string> = { 1: 'urgent', 2: 'high', 3: 'normal', 4: 'low' };

            clickupTaskEvents = clickupTasks
                .filter(t => t.due_date && t.status?.status?.toLowerCase() !== 'complete' && t.status?.status?.toLowerCase() !== 'abandoned')
                .map(t => {
                    const mapped = mapClickUpTask(t);
                    const dueDate = new Date(Number(t.due_date));
                    const dueStr = dueDate.toISOString();
                    const priorityId = t.priority?.id ? Number(t.priority.id) : 3;
                    const rawDesc = typeof t.description === 'string' ? t.description : null;
                    return {
                        id: `clickup_${t.id}`,
                        google_event_id: null,
                        account: null,
                        title: `⚑ ${mapped.name}`,
                        description: rawDesc,
                        location: null,
                        start_time: dueStr,
                        end_time: dueStr,
                        all_day: true,
                        color: null,
                        source: 'clickup_task',
                        source_id: t.id,
                        status: 'confirmed',
                        is_flexible: false,
                        clickup_priority: priorityLabels[priorityId] ?? 'normal',
                        clickup_status: t.status?.status ?? 'to do',
                        clickup_category: mapped.category,
                        clickup_url: t.url,
                    };
                })
                // Filter by date range if provided
                .filter(t => {
                    if (start && new Date(t.start_time as string) < new Date(start)) return false;
                    if (end && new Date(t.start_time as string) > new Date(end)) return false;
                    return true;
                });
        } catch (e) {
            console.error('[calendar] ClickUp task fetch failed:', e);
        }

        return NextResponse.json({
            events: [...(events ?? []), ...clickupTaskEvents],
            connectedAccounts: (tokens ?? []).map(t => ({ account: t.account, email: t.email })),
        });
    } catch (e) {
        console.error('[calendar GET]', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

/**
 * POST /api/dashboard/calendar
 * Create a new event → Supabase + Google Calendar.
 */
export async function POST(req: NextRequest) {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    try {
        const supabase = createAdminClient();
        const body = await req.json();
        const {
            title, description, location, start_time, end_time,
            all_day, color, source, source_id, account, is_flexible,
        } = body;

        if (!title || !start_time || !end_time) {
            return NextResponse.json({ error: 'title, start_time, end_time required' }, { status: 400 });
        }

        const now = new Date().toISOString();
        let google_event_id = null;
        let google_etag = null;

        // Push to Google if an account is specified and connected
        if (account) {
            const { data: token } = await supabase
                .from('calendar_tokens')
                .select('*')
                .eq('account', account)
                .single();

            if (token) {
                try {
                    const { access_token, expires_at } = await getAccessToken(token as CalendarToken);
                    // Update stored token
                    await supabase.from('calendar_tokens').update({
                        access_token,
                        token_expiry: expires_at.toISOString(),
                    }).eq('account', account);

                    const googleEvent = await createEvent(access_token, 'primary', {
                        summary: title,
                        description: description ?? undefined,
                        location: location ?? undefined,
                        start: all_day
                            ? { date: start_time.split('T')[0] }
                            : { dateTime: start_time, timeZone: 'Australia/Melbourne' },
                        end: all_day
                            ? { date: end_time.split('T')[0] }
                            : { dateTime: end_time, timeZone: 'Australia/Melbourne' },
                    });
                    google_event_id = googleEvent.id;
                    google_etag = googleEvent.etag;
                } catch (e) {
                    console.error('[calendar POST] Google push failed, saving locally only:', e);
                }
            }
        }

        // Save to Supabase
        const { data: event, error } = await supabase.from('calendar_events').insert({
            google_event_id,
            google_calendar_id: account ? 'primary' : null,
            account: account ?? null,
            title,
            description: description ?? null,
            location: location ?? null,
            start_time,
            end_time,
            all_day: all_day ?? false,
            color: color ?? null,
            source: source ?? (account ? 'google' : 'task'),
            source_id: source_id ?? null,
            is_flexible: is_flexible ?? false,
            status: 'confirmed',
            google_etag,
            synced_at: google_event_id ? now : null,
            created_at: now,
            updated_at: now,
        }).select().single();

        if (error) throw error;

        return NextResponse.json({ ok: true, event });
    } catch (e) {
        console.error('[calendar POST]', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

/**
 * PATCH /api/dashboard/calendar
 * Update an existing event → sync to Google.
 */
export async function PATCH(req: NextRequest) {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    try {
        const supabase = createAdminClient();
        const body = await req.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'id required' }, { status: 400 });
        }

        // Get existing event
        const { data: existing } = await supabase
            .from('calendar_events')
            .select('*')
            .eq('id', id)
            .single();

        if (!existing) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        // Push update to Google if it's a Google-linked event
        if (existing.google_event_id && existing.account) {
            const { data: token } = await supabase
                .from('calendar_tokens')
                .select('*')
                .eq('account', existing.account)
                .single();

            if (token) {
                try {
                    const { access_token, expires_at } = await getAccessToken(token as CalendarToken);
                    await supabase.from('calendar_tokens').update({
                        access_token,
                        token_expiry: expires_at.toISOString(),
                    }).eq('account', existing.account);

                    const googleUpdates: Record<string, unknown> = {};
                    if (updates.title) googleUpdates.summary = updates.title;
                    if (updates.description !== undefined) googleUpdates.description = updates.description;
                    if (updates.location !== undefined) googleUpdates.location = updates.location;
                    if (updates.start_time) {
                        googleUpdates.start = updates.all_day
                            ? { date: updates.start_time.split('T')[0] }
                            : { dateTime: updates.start_time, timeZone: 'Australia/Melbourne' };
                    }
                    if (updates.end_time) {
                        googleUpdates.end = updates.all_day
                            ? { date: updates.end_time.split('T')[0] }
                            : { dateTime: updates.end_time, timeZone: 'Australia/Melbourne' };
                    }

                    if (Object.keys(googleUpdates).length > 0) {
                        const updated = await updateEvent(
                            access_token,
                            existing.google_calendar_id ?? 'primary',
                            existing.google_event_id,
                            googleUpdates,
                        );
                        updates.google_etag = updated.etag;
                        updates.synced_at = new Date().toISOString();
                    }
                } catch (e) {
                    console.error('[calendar PATCH] Google sync failed:', e);
                }
            }
        }

        // Update in Supabase
        const { data: event, error } = await supabase
            .from('calendar_events')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ ok: true, event });
    } catch (e) {
        console.error('[calendar PATCH]', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

/**
 * DELETE /api/dashboard/calendar?id=...
 * Delete an event → remove from Google too.
 */
export async function DELETE(req: NextRequest) {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    try {
        const supabase = createAdminClient();
        const id = req.nextUrl.searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'id required' }, { status: 400 });
        }

        const { data: existing } = await supabase
            .from('calendar_events')
            .select('*')
            .eq('id', id)
            .single();

        if (!existing) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        // Delete from Google
        if (existing.google_event_id && existing.account) {
            const { data: token } = await supabase
                .from('calendar_tokens')
                .select('*')
                .eq('account', existing.account)
                .single();

            if (token) {
                try {
                    const { access_token, expires_at } = await getAccessToken(token as CalendarToken);
                    await supabase.from('calendar_tokens').update({
                        access_token,
                        token_expiry: expires_at.toISOString(),
                    }).eq('account', existing.account);
                    await deleteEvent(access_token, existing.google_calendar_id ?? 'primary', existing.google_event_id);
                } catch (e) {
                    console.error('[calendar DELETE] Google delete failed:', e);
                }
            }
        }

        // Mark as cancelled in Supabase (soft delete)
        const { error } = await supabase
            .from('calendar_events')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error('[calendar DELETE]', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

