import { requireAuth } from '@/lib/supabase/auth-guard';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import {
    getAccessToken,
    getAllTasks,
    mapClickUpTask,
    updateTask as clickupUpdateTask,
    createTask as clickupCreateTask,
    deleteTask as clickupDeleteTask,
    getListIdForCategory,
    composeDescription,
    parseDescription,
    getTask as clickupGetTask,
    REVERSE_PRIORITY_MAP,
    type ClickUpTask,
} from '@/lib/clickup';

/**
 * PATCH /api/dashboard/tasks
 *
 * All mutations go directly to ClickUp (live, single source of truth).
 *
 * Actions:
 *   { task_name, category, action: 'complete' }
 *   { task_name, action: 'uncomplete' }
 *   { task_name, action: 'update_metadata', priority?, due_date?, context?, notes?, waiting_on?, location? }
 *   { task_name, action: 'rename', new_name: string }
 *   { task_name, action: 'delete' }
 *   { task_name, action: 'abandon' }
 *   { task_name, category, action: 'add' }
 */
export async function PATCH(req: NextRequest) {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    try {
        const body = await req.json();
        const {
            task_name, category, action, priority, due_date,
            context, notes, waiting_on, location,
            new_name, clickup_id: providedId,
        } = body as {
            task_name: string;
            category?: string;
            action: 'complete' | 'uncomplete' | 'update_metadata' | 'rename' | 'delete' | 'abandon' | 'add' | 'set_status';
            priority?: string | null;
            due_date?: string | null;
            context?: string | null;
            notes?: string | null;
            waiting_on?: string | null;
            location?: string | null;
            new_name?: string;
            clickup_id?: string;
            clickup_status?: string;  // for set_status action
        };

        if (!task_name || !action) {
            return NextResponse.json({ error: 'task_name and action are required' }, { status: 400 });
        }

        // Find the ClickUp task ID — either provided directly or search ClickUp
        let clickupId = providedId || null;
        if (!clickupId && action !== 'add') {
            // Search ClickUp directly (no Supabase dependency)
            const { tasks: allTasks } = await getAllTasks();
            const match = allTasks.find((t: ClickUpTask) => t.name === task_name);
            clickupId = match?.id ?? null;
        }

        if (!clickupId && action !== 'add') {
            return NextResponse.json({ error: `No ClickUp task found for "${task_name}"` }, { status: 404 });
        }

        if (action === 'complete') {
            await clickupUpdateTask(clickupId!, { status: 'complete' });
            return NextResponse.json({ ok: true, task_name, action: 'complete' });

        } else if (action === 'uncomplete') {
            await clickupUpdateTask(clickupId!, { status: 'to do' });
            return NextResponse.json({ ok: true, task_name, action: 'uncomplete' });

        } else if (action === 'update_metadata') {
            const updateData: Parameters<typeof clickupUpdateTask>[1] = {};

            // Priority → ClickUp native priority
            if (priority !== undefined) {
                updateData.priority = priority ? (REVERSE_PRIORITY_MAP[priority] ?? null) : null;
            }

            // Due date → Unix ms
            if (due_date !== undefined) {
                updateData.due_date = due_date ? new Date(due_date + 'T23:59:59+11:00').getTime() : null;
            }

            // Compose structured description from all metadata fields
            // First, fetch current task to preserve existing fields that aren't being updated
            const currentTask = await clickupGetTask(clickupId!);
            const currentFields = parseDescription(currentTask.description);

            const composedDescription = composeDescription({
                context: context !== undefined ? context : currentFields.context,
                notes: notes !== undefined ? notes : currentFields.notes,
                waiting_on: waiting_on !== undefined ? waiting_on : currentFields.waiting_on,
                location: location !== undefined ? location : currentFields.location,
            });

            updateData.description = composedDescription;

            await clickupUpdateTask(clickupId!, updateData);
            return NextResponse.json({ ok: true, task_name, action: 'update_metadata' });

        } else if (action === 'rename') {
            if (!new_name?.trim()) {
                return NextResponse.json({ error: 'new_name is required for rename' }, { status: 400 });
            }
            await clickupUpdateTask(clickupId!, { name: new_name.trim() });
            // Also update the Supabase mapping table
            const supabase = createAdminClient();
            await supabase.from('tasks').update({ name: new_name.trim() }).eq('clickup_id', clickupId!);
            return NextResponse.json({ ok: true, task_name, new_name: new_name.trim(), action: 'rename' });

        } else if (action === 'delete') {
            await clickupDeleteTask(clickupId!);
            const supabase = createAdminClient();
            await supabase.from('tasks').delete().eq('clickup_id', clickupId!);
            return NextResponse.json({ ok: true, task_name, action: 'delete' });

        } else if (action === 'abandon') {
            // Set ClickUp status to 'abandoned' and record locally
            await clickupUpdateTask(clickupId!, { status: 'abandoned' });
            const supabase = createAdminClient();
            await supabase.from('task_completions').upsert({
                task_name,
                category: category ?? 'Uncategorized',
                completed_at: new Date().toISOString(),
                completed_by: 'abandoned',
            }, { onConflict: 'task_name' });
            return NextResponse.json({ ok: true, task_name, action: 'abandon' });

        } else if (action === 'add') {
            if (!category) {
                return NextResponse.json({ error: 'category is required for add' }, { status: 400 });
            }
            const listId = await getListIdForCategory(category);
            if (!listId) {
                return NextResponse.json({ error: `No ClickUp list found for category "${category}"` }, { status: 404 });
            }
            const newTask = await clickupCreateTask(listId, {
                name: task_name,
                priority: priority ? (REVERSE_PRIORITY_MAP[priority] ?? undefined) : undefined,
                due_date: due_date ? new Date(due_date + 'T23:59:59+11:00').getTime() : undefined,
            });
            // Store mapping
            const supabase = createAdminClient();
            await supabase.from('tasks').upsert({
                name: task_name,
                clickup_id: newTask.id,
                category,
                status: 'open',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }, { onConflict: 'name' });
            return NextResponse.json({ ok: true, task_name, category, clickup_id: newTask.id, action: 'add' });

        } else if (action === 'set_status') {
            const { clickup_status: newStatus } = body as { clickup_status: string };
            if (!newStatus) {
                return NextResponse.json({ error: 'clickup_status is required for set_status' }, { status: 400 });
            }
            await clickupUpdateTask(clickupId!, { status: newStatus });
            return NextResponse.json({ ok: true, task_name, clickup_status: newStatus, action: 'set_status' });
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    } catch (e) {
        console.error('[tasks PATCH] Error:', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

/**
 * GET /api/dashboard/tasks
 *
 * Fetches all tasks directly from ClickUp and returns them in the shape
 * the dashboard UI expects (completions + metadata).
 */
export async function GET() {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    try {
        await getAccessToken();

        const { tasks: clickupTasks } = await getAllTasks();

        const completions: { task_name: string; category: string; completed_at: string; completed_by: string; notes: string | null }[] = [];
        const metadata: {
            task_name: string; clickup_id: string; clickup_status: string; priority: string | null; due_date: string | null;
            waiting_on: string | null; notes: string | null; context: string | null;
            parent_task: string | null; location: string | null; url: string;
        }[] = [];

        // Build parent name lookup
        const idToName = new Map<string, string>(clickupTasks.map((t: ClickUpTask) => [t.id, t.name]));

        for (const task of clickupTasks) {
            const mapped = mapClickUpTask(task);

            if (mapped.status === 'done' || mapped.status === 'abandoned') {
                completions.push({
                    task_name: mapped.name,
                    category: mapped.category,
                    completed_at: mapped.completed_at ?? new Date().toISOString(),
                    completed_by: mapped.status === 'abandoned' ? 'abandoned' : 'manual',
                    notes: null,
                });
            }

            const parentName = task.parent ? (idToName.get(task.parent) ?? null) : null;
            metadata.push({
                task_name: mapped.name,
                clickup_id: mapped.clickup_id,
                clickup_status: mapped.clickup_status,
                priority: mapped.priority,
                due_date: mapped.due_date,
                waiting_on: mapped.waiting_on,
                notes: mapped.notes,
                context: mapped.context,
                parent_task: parentName,
                location: mapped.location,
                url: mapped.url,
            });
        }

        return NextResponse.json({ completions, metadata });
    } catch (e) {
        console.error('[tasks GET] Error fetching from ClickUp:', e);
        return NextResponse.json({ completions: [], metadata: [] });
    }
}
