import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

/**
 * PATCH /api/dashboard/habits
 * Body: { date, habit_id, done, value?, notes? }
 *
 * Uses the service-role admin client to bypass RLS and upsert into daily_habits.
 */
export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { date, habit_id, done, value, notes } = body as {
            date: string;
            habit_id: string;
            done: boolean;
            value?: string;
            notes?: string;
        };

        if (!date || !habit_id) {
            return NextResponse.json({ error: 'date and habit_id are required' }, { status: 400 });
        }

        // Use admin client to bypass RLS on daily_habits
        const supabase = createAdminClient();
        const { error } = await supabase
            .from('daily_habits')
            .upsert({
                date,
                habit_id,
                done,
                value: value ?? null,
                notes: notes ?? null,
                source: 'manual',
                updated_at: new Date().toISOString(),
            }, { onConflict: 'date,habit_id' });

        if (error) {
            console.error('[habits PATCH] Supabase error:', error);
            return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
        }

        return NextResponse.json({ ok: true, date, habit_id, done, value, notes });
    } catch (e) {
        console.error('[habits PATCH] Unexpected error:', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
