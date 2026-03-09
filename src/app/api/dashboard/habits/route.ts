import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/supabase/auth-guard';
import { NextRequest, NextResponse } from 'next/server';

/**
 * PATCH /api/dashboard/habits
 * Body: { date, habit_id, done, value?, notes? }
 *
 * Uses the service-role admin client to bypass RLS and upsert into daily_habits.
 * Side effects:
 *   - Auto-creates a calendar event when a habit is marked done (habit ↔ calendar linking)
 *   - Updates habit_records table with best_streak and total_completions
 */

const HABIT_LABELS: Record<string, { label: string; icon: string }> = {
    teeth: { label: 'Brush Teeth', icon: '🦷' },
    bedtime: { label: 'In Bed by 11pm', icon: '🌙' },
    wake: { label: 'Up by 7am', icon: '🌅' },
    phone_down: { label: 'Phone Down', icon: '📱' },
    meditation: { label: 'Meditation', icon: '🧘' },
    hydration: { label: 'Hydration', icon: '💧' },
};

export async function PATCH(req: NextRequest) {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

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

        // ── Side effect: Habit ↔ Calendar auto-linking ──
        // When marking habit done, create a calendar event if one doesn't exist yet
        if (done) {
            const habitInfo = HABIT_LABELS[habit_id];
            if (habitInfo) {
                try {
                    const eventTitle = `${habitInfo.icon} ${habitInfo.label}`;
                    // Check if a calendar event already exists for this habit+date
                    const { data: existing } = await supabase
                        .from('calendar_events')
                        .select('id')
                        .eq('source', 'habit')
                        .eq('source_id', habit_id)
                        .gte('start_time', `${date}T00:00:00`)
                        .lte('start_time', `${date}T23:59:59`)
                        .limit(1);

                    if (!existing?.length) {
                        // Create a 15-min event at the current time
                        const now = new Date();
                        const endTime = new Date(now.getTime() + 15 * 60000);
                        await supabase.from('calendar_events').insert({
                            title: eventTitle,
                            start_time: now.toISOString(),
                            end_time: endTime.toISOString(),
                            all_day: false,
                            source: 'habit',
                            source_id: habit_id,
                            status: 'confirmed',
                        });
                        console.log(`[habits PATCH] Auto-created calendar event for ${habit_id}`);
                    }
                } catch (calErr) {
                    // Non-critical — don't fail the habit save if calendar linking fails
                    console.warn(`[habits PATCH] Calendar auto-link failed for ${habit_id}:`, calErr);
                }
            }
        }

        // ── Side effect: Update habit_records for persistent streaks ──
        try {
            // Count total completions and calculate best streak
            const { data: allRows } = await supabase
                .from('daily_habits')
                .select('date,done')
                .eq('habit_id', habit_id)
                .order('date', { ascending: true });

            if (allRows?.length) {
                const totalCompletions = allRows.filter(r => r.done).length;
                let bestStreak = 0;
                let currentStreak = 0;
                let bestStreakDate: string | null = null;
                for (const row of allRows) {
                    if (row.done) {
                        currentStreak++;
                        if (currentStreak > bestStreak) {
                            bestStreak = currentStreak;
                            bestStreakDate = row.date;
                        }
                    } else {
                        currentStreak = 0;
                    }
                }

                await supabase
                    .from('habit_records')
                    .upsert({
                        habit_id,
                        best_streak: bestStreak,
                        best_streak_date: bestStreakDate,
                        total_completions: totalCompletions,
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'habit_id' });
            }
        } catch (recErr) {
            // Non-critical — don't fail the habit save
            console.warn(`[habits PATCH] habit_records update failed for ${habit_id}:`, recErr);
        }

        return NextResponse.json({ ok: true, date, habit_id, done, value, notes });
    } catch (e) {
        console.error('[habits PATCH] Unexpected error:', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

