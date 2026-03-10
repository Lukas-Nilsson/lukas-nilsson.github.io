import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/supabase/auth-guard';
import { createTimeEntry, updateTimeEntry, deleteTimeEntry, getAllTasks, updateTask } from '@/lib/clickup';

/**
 * POST /api/dashboard/tasks/schedule
 * Schedule a work session for a ClickUp task (creates a time entry).
 * This is called when dragging a task onto the calendar.
 * 
 * Body: { clickup_id, start_time (ISO), end_time (ISO) }
 * 
 * Does NOT modify start_date/due_date — those represent the work window
 * and are managed in ClickUp directly.
 */
export async function POST(req: NextRequest) {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    try {
        const { clickup_id, start_time, end_time } = await req.json();
        if (!clickup_id || !start_time || !end_time) {
            return NextResponse.json({ error: 'Missing clickup_id, start_time, or end_time' }, { status: 400 });
        }

        const startMs = new Date(start_time).getTime();
        const endMs = new Date(end_time).getTime();

        if (endMs <= startMs) {
            return NextResponse.json({ error: 'end_time must be after start_time' }, { status: 400 });
        }

        const entry = await createTimeEntry(clickup_id, startMs, endMs);

        // Bust the task cache so the calendar picks up changes on next load
        await getAllTasks({ bustCache: true });

        return NextResponse.json({ ok: true, time_entry: entry });
    } catch (e) {
        console.error('[schedule POST]', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

/**
 * PATCH /api/dashboard/tasks/schedule
 * Update a time entry and optionally update the ClickUp task status.
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

        // Update time entry (start/end)
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

        return NextResponse.json({ ok: true, time_entry: entry });
    } catch (e) {
        console.error('[schedule PATCH]', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

/**
 * DELETE /api/dashboard/tasks/schedule?entry_id=...
 * Delete a time entry.
 */
export async function DELETE(req: NextRequest) {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    try {
        const entryId = req.nextUrl.searchParams.get('entry_id');
        if (!entryId) {
            return NextResponse.json({ error: 'Missing entry_id' }, { status: 400 });
        }

        await deleteTimeEntry(entryId);

        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error('[schedule DELETE]', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
