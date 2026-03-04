import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

/**
 * PATCH /api/dashboard/tasks
 *
 * Actions:
 *   { task_name, category, action: 'complete' }
 *   { task_name, action: 'uncomplete' }
 *   { task_name, action: 'update_metadata', priority?, due_date?, waiting_on?, notes?, context?, parent_task? }
 *   { task_name, action: 'rename', new_name: string }
 *   { task_name, action: 'delete' }       — removes task from all tables + snapshots
 *   { task_name, action: 'abandon' }      — soft-close (completed_by='abandoned')
 *   { task_name, category, action: 'add' } — creates a new task in snapshots
 */
export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { task_name, category, action, priority, due_date, waiting_on, notes, context, parent_task, new_name } = body as {
            task_name: string;
            category?: string;
            action: 'complete' | 'uncomplete' | 'update_metadata' | 'rename' | 'delete' | 'abandon' | 'add';
            priority?: string | null;
            due_date?: string | null;
            waiting_on?: string | null;
            notes?: string | null;
            context?: string | null;
            parent_task?: string | null;
            new_name?: string;
        };

        if (!task_name || !action) {
            return NextResponse.json({ error: 'task_name and action are required' }, { status: 400 });
        }

        const supabase = createAdminClient();

        if (action === 'complete') {
            const { error } = await supabase
                .from('task_completions')
                .upsert({
                    task_name,
                    category: category ?? null,
                    notes: notes ?? null,
                    completed_at: new Date().toISOString(),
                    completed_by: 'manual',
                }, { onConflict: 'task_name' });

            if (error) {
                console.error('[tasks PATCH] complete error:', error);
                return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
            }
            return NextResponse.json({ ok: true, task_name, action: 'complete' });

        } else if (action === 'uncomplete') {
            const { error } = await supabase
                .from('task_completions')
                .delete()
                .eq('task_name', task_name);

            if (error) {
                console.error('[tasks PATCH] uncomplete error:', error);
                return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
            }
            return NextResponse.json({ ok: true, task_name, action: 'uncomplete' });

        } else if (action === 'update_metadata') {
            const { error } = await supabase
                .from('task_metadata')
                .upsert({
                    task_name,
                    priority: priority ?? null,
                    due_date: due_date ?? null,
                    waiting_on: waiting_on ?? null,
                    notes: notes ?? null,
                    context: context ?? null,
                    parent_task: parent_task ?? null,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'task_name' });

            if (error) {
                console.error('[tasks PATCH] metadata error:', error);
                return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
            }
            return NextResponse.json({ ok: true, task_name, action: 'update_metadata' });

        } else if (action === 'rename') {
            if (!new_name || !new_name.trim()) {
                return NextResponse.json({ error: 'new_name is required for rename' }, { status: 400 });
            }
            const trimmedName = new_name.trim();

            // Update task_metadata (rename the PK)
            const { data: existingMeta } = await supabase
                .from('task_metadata')
                .select('*')
                .eq('task_name', task_name)
                .single();
            if (existingMeta) {
                await supabase.from('task_metadata').delete().eq('task_name', task_name);
                await supabase.from('task_metadata').upsert({ ...existingMeta, task_name: trimmedName, updated_at: new Date().toISOString() }, { onConflict: 'task_name' });
            }

            // Update task_completions (rename the PK)
            const { data: existingComp } = await supabase
                .from('task_completions')
                .select('*')
                .eq('task_name', task_name)
                .single();
            if (existingComp) {
                await supabase.from('task_completions').delete().eq('task_name', task_name);
                await supabase.from('task_completions').upsert({ ...existingComp, task_name: trimmedName }, { onConflict: 'task_name' });
            }

            // Update any subtasks that reference this task as parent_task
            await supabase
                .from('task_metadata')
                .update({ parent_task: trimmedName, updated_at: new Date().toISOString() })
                .eq('parent_task', task_name);

            // Update task_snapshots categories JSON (replace old name with new name in task arrays)
            const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });
            const { data: snapshot } = await supabase
                .from('task_snapshots')
                .select('date, categories')
                .eq('date', today)
                .single();
            if (snapshot?.categories) {
                const cats = snapshot.categories as Record<string, { tasks?: string[];[k: string]: unknown }>;
                let updated = false;
                for (const [, catData] of Object.entries(cats)) {
                    if (catData.tasks) {
                        const idx = catData.tasks.indexOf(task_name);
                        if (idx >= 0) {
                            catData.tasks[idx] = trimmedName;
                            updated = true;
                        }
                    }
                }
                if (updated) {
                    await supabase
                        .from('task_snapshots')
                        .update({ categories: cats })
                        .eq('date', today);
                }
            }

            return NextResponse.json({ ok: true, task_name, new_name: trimmedName, action: 'rename' });

        } else if (action === 'delete') {
            // Remove from task_completions
            await supabase.from('task_completions').delete().eq('task_name', task_name);
            // Remove from task_metadata
            await supabase.from('task_metadata').delete().eq('task_name', task_name);
            // Orphan any subtasks (clear their parent_task)
            await supabase
                .from('task_metadata')
                .update({ parent_task: null, updated_at: new Date().toISOString() })
                .eq('parent_task', task_name);

            // Remove from task_snapshots categories JSON + adjust counts
            const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });
            const { data: snap } = await supabase
                .from('task_snapshots')
                .select('date, categories, open_count, done_count')
                .eq('date', today)
                .single();
            if (snap?.categories) {
                const cats = snap.categories as Record<string, { tasks?: string[]; open?: number; done?: number;[k: string]: unknown }>;
                let found = false;
                for (const [, catData] of Object.entries(cats)) {
                    if (catData.tasks) {
                        const idx = catData.tasks.indexOf(task_name);
                        if (idx >= 0) {
                            catData.tasks.splice(idx, 1);
                            if (catData.open != null) catData.open = Math.max(0, catData.open - 1);
                            found = true;
                        }
                    }
                }
                if (found) {
                    await supabase
                        .from('task_snapshots')
                        .update({
                            categories: cats,
                            open_count: Math.max(0, (snap.open_count ?? 0) - 1),
                        })
                        .eq('date', today);
                }
            }

            return NextResponse.json({ ok: true, task_name, action: 'delete' });

        } else if (action === 'abandon') {
            // Mark as completed with 'abandoned' tag — keeps it in the system but out of the pile
            const { error } = await supabase
                .from('task_completions')
                .upsert({
                    task_name,
                    category: category ?? null,
                    notes: notes ?? 'Abandoned',
                    completed_at: new Date().toISOString(),
                    completed_by: 'abandoned',
                }, { onConflict: 'task_name' });

            if (error) {
                console.error('[tasks PATCH] abandon error:', error);
                return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
            }
            return NextResponse.json({ ok: true, task_name, action: 'abandon' });

        } else if (action === 'add') {
            if (!category) {
                return NextResponse.json({ error: 'category is required for add' }, { status: 400 });
            }

            // Add to today's task_snapshots categories JSON
            const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });
            const { data: snap } = await supabase
                .from('task_snapshots')
                .select('date, categories, open_count, done_count')
                .eq('date', today)
                .single();

            if (!snap) {
                return NextResponse.json({ error: 'No snapshot for today — run a sync first' }, { status: 400 });
            }

            const cats = (snap.categories ?? {}) as Record<string, { tasks?: string[]; open?: number; done?: number;[k: string]: unknown }>;

            // Check for duplicate
            for (const [, catData] of Object.entries(cats)) {
                if (catData.tasks?.includes(task_name)) {
                    return NextResponse.json({ error: 'Task already exists' }, { status: 409 });
                }
            }

            // Add to category (create if needed)
            if (!cats[category]) {
                cats[category] = { tasks: [], open: 0, done: 0 };
            }
            cats[category].tasks = [...(cats[category].tasks ?? []), task_name];
            cats[category].open = (cats[category].open ?? 0) + 1;

            await supabase
                .from('task_snapshots')
                .update({
                    categories: cats,
                    open_count: (snap.open_count ?? 0) + 1,
                })
                .eq('date', today);

            // Optionally set initial metadata if priority was provided
            if (priority) {
                await supabase.from('task_metadata').upsert({
                    task_name,
                    priority: priority ?? null,
                    due_date: due_date ?? null,
                    waiting_on: waiting_on ?? null,
                    notes: notes ?? null,
                    context: context ?? null,
                    parent_task: parent_task ?? null,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'task_name' });
            }

            return NextResponse.json({ ok: true, task_name, category, action: 'add' });
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    } catch (e) {
        console.error('[tasks PATCH] Unexpected error:', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

/**
 * GET /api/dashboard/tasks
 * Returns completions + metadata for all tasks.
 */
export async function GET() {
    try {
        const supabase = createAdminClient();

        const [compRes, metaRes] = await Promise.all([
            supabase.from('task_completions').select('task_name,category,completed_at,completed_by,notes'),
            supabase.from('task_metadata').select('task_name,priority,due_date,waiting_on,notes,context,parent_task,updated_at'),
        ]);

        if (compRes.error) console.error('[tasks GET] completions error:', compRes.error);
        if (metaRes.error) console.error('[tasks GET] metadata error:', metaRes.error);

        return NextResponse.json({
            completions: compRes.data ?? [],
            metadata: metaRes.data ?? [],
        });
    } catch (e) {
        console.error('[tasks GET] Unexpected error:', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
