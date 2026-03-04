import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
    const supabase = await createClient();

    const [whoopRes, whoopHistoryRes, hard75Res, hard75HistRes, tasksRes, sleepRes] = await Promise.all([
        // Latest Whoop snapshot
        supabase.from('whoop_daily').select('*').order('date', { ascending: false }).limit(1).single(),
        // 7-day Whoop history for charts
        supabase.from('whoop_daily').select('date,recovery,hrv,strain,sleep_hours,sleep_performance').order('date', { ascending: true }).limit(14),
        // Most recent 75 Hard entry (today)
        supabase.from('hard75').select('*').order('date', { ascending: false }).limit(1).single(),
        // All 75 Hard history (for day navigator + charts)
        supabase.from('hard75').select('*').order('date', { ascending: true }),
        // Latest tasks snapshot
        supabase.from('tasks_pile').select('*').order('updated_at', { ascending: false }).limit(1).single(),
        // 14-night sleep history
        supabase.from('sleep_log').select('*').order('date', { ascending: true }).limit(14),
    ]);

    return NextResponse.json({
        whoop: whoopRes.data ?? null,
        whoopHistory: whoopHistoryRes.data ?? [],
        hard75: hard75Res.data ?? null,
        hard75History: hard75HistRes.data ?? [],
        tasks: tasksRes.data ?? null,
        sleep: sleepRes.data ?? [],
        // Last sync timestamp comes from the tasks generatedAt OR whoop fetchedAt
        lastSynced: tasksRes.data?.updated_at ?? whoopRes.data?.fetched_at ?? null,
    });
}
