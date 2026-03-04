import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * PATCH /api/dashboard/habits
 * Body: { date, habit_id, done, value?, notes? }
 *
 * Upserts a single daily_habits row in Supabase.
 * source is set to 'manual' so the UI can distinguish from Whoop/sync overrides.
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

        const supabase = await createClient();
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

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ ok: true, date, habit_id, done, value, notes });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
