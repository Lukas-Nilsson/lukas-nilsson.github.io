import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/supabase/auth-guard';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/dashboard/habits/register
 * Body: { habit_id, label, icon?, tracking_start?, show_time?, show_notes?, default_to_now? }
 *
 * Registers a new habit definition. Used by OpenClaw to dynamically add tracked habits.
 * The habit will only appear on the dashboard from tracking_start date onward.
 */
export async function POST(req: NextRequest) {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    try {
        const body = await req.json();
        const {
            habit_id, label, icon, tracking_start,
            show_time, show_notes, default_to_now, sort_order,
        } = body as {
            habit_id: string;
            label: string;
            icon?: string;
            tracking_start?: string;
            show_time?: boolean;
            show_notes?: boolean;
            default_to_now?: boolean;
            sort_order?: number;
        };

        if (!habit_id || !label) {
            return NextResponse.json({ error: 'habit_id and label are required' }, { status: 400 });
        }

        const supabase = createAdminClient();
        const { data, error } = await supabase
            .from('habit_definitions')
            .upsert({
                habit_id,
                label,
                icon: icon ?? '✅',
                tracking_start: tracking_start ?? new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' }),
                show_time: show_time ?? false,
                show_notes: show_notes ?? false,
                default_to_now: default_to_now ?? false,
                sort_order: sort_order ?? 100,
                active: true,
            }, { onConflict: 'habit_id' })
            .select()
            .single();

        if (error) {
            console.error('[habits/register] Supabase error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true, habit: data });
    } catch (e) {
        console.error('[habits/register] Error:', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

/**
 * GET /api/dashboard/habits/register
 * Returns all habit definitions (for discovery).
 */
export async function GET() {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('habit_definitions')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ habits: data });
}
