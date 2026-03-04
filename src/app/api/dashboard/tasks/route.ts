import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

/**
 * PATCH /api/dashboard/tasks
 * Body: { task_name, category, action: 'complete' | 'uncomplete', notes? }
 *
 * Completes or uncompletes a task by inserting/deleting from task_completions table.
 */
export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { task_name, category, action, notes } = body as {
            task_name: string;
            category?: string;
            action: 'complete' | 'uncomplete';
            notes?: string;
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
                console.error('[tasks PATCH] Supabase error:', error);
                return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
            }

            return NextResponse.json({ ok: true, task_name, action: 'complete' });
        } else {
            // Uncomplete: delete the row
            const { error } = await supabase
                .from('task_completions')
                .delete()
                .eq('task_name', task_name);

            if (error) {
                console.error('[tasks PATCH] Supabase error:', error);
                return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
            }

            return NextResponse.json({ ok: true, task_name, action: 'uncomplete' });
        }
    } catch (e) {
        console.error('[tasks PATCH] Unexpected error:', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

/**
 * GET /api/dashboard/tasks
 * Returns the list of completed task names from task_completions.
 */
export async function GET() {
    try {
        const supabase = createAdminClient();
        const { data, error } = await supabase
            .from('task_completions')
            .select('task_name,category,completed_at,completed_by,notes');

        if (error) {
            console.error('[tasks GET] Supabase error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ completions: data ?? [] });
    } catch (e) {
        console.error('[tasks GET] Unexpected error:', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
