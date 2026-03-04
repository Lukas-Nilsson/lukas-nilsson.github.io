import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
    const supabase = await createClient();

    const [whoopRes, hard75Res, tasksRes, sleepRes] = await Promise.all([
        supabase
            .from('whoop_daily')
            .select('*')
            .order('date', { ascending: false })
            .limit(1)
            .single(),
        supabase
            .from('hard75')
            .select('*')
            .order('date', { ascending: false })
            .limit(1)
            .single(),
        supabase
            .from('tasks_pile')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(1)
            .single(),
        supabase
            .from('sleep_log')
            .select('*')
            .order('date', { ascending: false })
            .limit(7),
    ]);

    return NextResponse.json({
        whoop: whoopRes.data ?? null,
        hard75: hard75Res.data ?? null,
        tasks: tasksRes.data ?? null,
        sleep: sleepRes.data ?? [],
    });
}
