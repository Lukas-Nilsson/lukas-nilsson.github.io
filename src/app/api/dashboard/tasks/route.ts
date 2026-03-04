import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

/**
 * PATCH /api/dashboard/tasks
 *
 * Actions:
 *   { task_name, category, action: 'complete' }
 *   { task_name, action: 'uncomplete' }
 *   { task_name, action: 'update_metadata', priority?, due_date?, waiting_on?, notes?, context?, parent_task? }
 */
export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { task_name, category, action, priority, due_date, waiting_on, notes, context, parent_task } = body as {
            task_name: string;
            category?: string;
            action: 'complete' | 'uncomplete' | 'update_metadata';
            priority?: string | null;
            due_date?: string | null;
            waiting_on?: string | null;
            notes?: string | null;
            context?: string | null;
            parent_task?: string | null;
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
