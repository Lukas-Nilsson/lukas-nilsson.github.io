import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/supabase/auth-guard';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/dashboard/brief?date=YYYY-MM-DD
 * Returns a saved daily brief for a specific date.
 *
 * POST /api/dashboard/brief
 * Saves the daily brief for a given date.
 * Body: { date: string, items: BriefItem[], emails?: EmailItem[] }
 */

async function ensureTable(supabase: ReturnType<typeof createAdminClient>) {
    // Try a simple query — if table doesn't exist, create it
    const { error } = await supabase.from('daily_briefs').select('date').limit(0);
    if (error && error.message.includes('does not exist')) {
        try {
            await supabase.rpc('exec_sql', {
                sql: `CREATE TABLE IF NOT EXISTS daily_briefs (
                    date DATE PRIMARY KEY,
                    items JSONB NOT NULL DEFAULT '[]',
                    emails JSONB NOT NULL DEFAULT '[]',
                    saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                ); ALTER TABLE daily_briefs ENABLE ROW LEVEL SECURITY;`
            });
        } catch {
            console.warn('[brief] Table daily_briefs does not exist. Please create it manually.');
        }
    }
}

export async function GET(req: NextRequest) {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    const date = req.nextUrl.searchParams.get('date');
    if (!date) {
        return NextResponse.json({ error: 'date parameter required' }, { status: 400 });
    }

    try {
        const supabase = createAdminClient();
        const { data, error } = await supabase
            .from('daily_briefs')
            .select('*')
            .eq('date', date)
            .single();

        if (error && error.code !== 'PGRST116') {
            // PGRST116 = row not found, which is expected
            // Table might not exist yet
            if (error.message.includes('does not exist')) {
                return NextResponse.json({ brief: null, tableNeeded: true });
            }
            throw error;
        }

        return NextResponse.json({ brief: data ?? null });
    } catch (e) {
        console.error('[brief GET]', e);
        return NextResponse.json({ brief: null });
    }
}

export async function POST(req: NextRequest) {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    try {
        const supabase = createAdminClient();
        const { date, items, emails } = await req.json() as {
            date: string;
            items: { icon: string; text: string; color?: string; type: string }[];
            emails?: { subject: string; from: string; url: string }[];
        };

        if (!date || !items) {
            return NextResponse.json({ error: 'date and items required' }, { status: 400 });
        }

        // Try to save — if table doesn't exist, try to create it first
        let result = await supabase.from('daily_briefs').upsert({
            date,
            items,
            emails: emails ?? [],
            saved_at: new Date().toISOString(),
        }, { onConflict: 'date' });

        if (result.error?.message.includes('does not exist')) {
            await ensureTable(supabase);
            // Retry
            result = await supabase.from('daily_briefs').upsert({
                date,
                items,
                emails: emails ?? [],
                saved_at: new Date().toISOString(),
            }, { onConflict: 'date' });
        }

        if (result.error) throw result.error;

        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error('[brief POST]', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
