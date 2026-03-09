import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/supabase/auth-guard';
import { NextResponse } from 'next/server';
import { getAccessToken, getAllTasks, mapClickUpTask } from '@/lib/clickup';

export async function GET() {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    const supabase = createAdminClient();

    const [sleepRes, habitRes, habitDefRes] = await Promise.all([
        supabase
            .from('daily_sleep')
            .select('date,recovery,hrv,rhr,strain,spo2,sleep_performance,sleep_hours,deep_hours,rem_hours,light_hours,bedtime_aest,wake_aest')
            .gte('date', '2026-02-28')
            .order('date', { ascending: true }),

        supabase
            .from('daily_habits')
            .select('date,habit_id,done,value,notes,source')
            .gte('date', new Date(Date.now() - 90 * 86400000).toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' }))
            .order('date', { ascending: true }),

        supabase
            .from('habit_definitions')
            .select('*')
            .eq('active', true)
            .order('sort_order', { ascending: true }),
    ]);

    const sleepRows = sleepRes.data ?? [];
    const habitRows = habitRes.data ?? [];

    // Habit definitions — dynamic from Supabase, with hardcoded fallback
    const FALLBACK_DEFS = [
        { habit_id: 'teeth', label: 'Brush Teeth', icon: '🦷', tracking_start: '2026-03-01', show_time: false, show_notes: false, default_to_now: false, sort_order: 10 },
        { habit_id: 'bedtime', label: 'In Bed by 11pm', icon: '🌙', tracking_start: '2026-03-01', show_time: true, show_notes: false, default_to_now: false, sort_order: 20 },
        { habit_id: 'wake', label: 'Up by 7am', icon: '🌅', tracking_start: '2026-03-01', show_time: true, show_notes: false, default_to_now: false, sort_order: 30 },
        { habit_id: 'phone_down', label: 'Phone Down', icon: '📱', tracking_start: '2026-03-01', show_time: true, show_notes: false, default_to_now: true, sort_order: 40 },
        { habit_id: 'meditation', label: 'Meditation', icon: '🧘', tracking_start: '2026-03-01', show_time: true, show_notes: true, default_to_now: true, sort_order: 50 },
        { habit_id: 'hydration', label: 'Hydration', icon: '💧', tracking_start: '2026-03-01', show_time: false, show_notes: true, default_to_now: false, sort_order: 60 },
    ];
    const habitDefs = (habitDefRes.data && habitDefRes.data.length > 0) ? habitDefRes.data : FALLBACK_DEFS;
    const habitIds = habitDefs.map((d: any) => d.habit_id);

    // ── Build per-day habit lookup ──
    const habitsByDate: Record<string, Record<string, { done: boolean; value: string | null; notes: string | null; source: string }>> = {};
    habitRows.forEach(r => {
        if (!habitsByDate[r.date]) habitsByDate[r.date] = {};
        habitsByDate[r.date][r.habit_id] = { done: r.done, value: r.value, notes: r.notes, source: r.source };
    });

    // ── Build habitHistory shape — dynamic from habit definitions ──
    const allDates = [...new Set(habitRows.map(r => r.date))].sort();
    const habitHistory = allDates.map(date => {
        const checks = habitsByDate[date] ?? {};
        // Build checks dynamically from habit definitions
        const checksMapped: Record<string, { done: boolean; time: string | null }> = {};
        for (const hid of habitIds) {
            checksMapped[hid] = {
                done: checks[hid]?.done ?? false,
                time: checks[hid]?.value ?? null,
            };
        }
        const activeForDate = habitDefs.filter((d: any) => d.tracking_start <= date);
        const activeIds = activeForDate.map((d: any) => d.habit_id);
        const doneCount = activeIds.filter((id: string) => checksMapped[id]?.done).length;
        const total = activeIds.length;

        // Time-weighted bonus: +5% per habit done before its natural deadline
        let timeBonus = 0;
        const parseTime = (t: string | null): number | null => {
            if (!t) return null;
            const m = t.match(/(\d{1,2}):(\d{2})/);
            if (!m) return null;
            return parseInt(m[1]) * 60 + parseInt(m[2]);
        };
        if (checksMapped.bedtime?.done) {
            const mins = parseTime(checksMapped.bedtime.time);
            if (mins !== null && ((mins >= 720 && mins <= 1380) || mins <= 60)) timeBonus += 5;
        }
        if (checksMapped.wake?.done) {
            const mins = parseTime(checksMapped.wake.time);
            if (mins !== null && mins <= 420 && mins >= 300) timeBonus += 5;
        }
        if (checksMapped.phone_down?.done) {
            const mins = parseTime(checksMapped.phone_down.time);
            if (mins !== null && ((mins >= 720 && mins <= 1410) || mins <= 60)) timeBonus += 5;
        }

        const baseScore = total > 0 ? Math.round((doneCount / total) * 100) : 0;
        return {
            date,
            checks: checksMapped,
            discipline_score: Math.min(100, baseScore + timeBonus),
        };
    });

    // ── Whoop history ──
    const whoopHistory = sleepRows.map(s => ({
        date: s.date, recovery: s.recovery, hrv: s.hrv, strain: s.strain,
        sleep_hours: s.sleep_hours, sleep_performance: s.sleep_performance,
    }));

    // ── Sleep chart data ──
    const sleepChartData = sleepRows.map(s => ({
        date: s.date,
        performance: s.sleep_performance ?? null,
        deep: s.deep_hours ?? null,
        rem: s.rem_hours ?? null,
        light: s.light_hours ?? null,
        hours: s.sleep_hours ?? null,
    }));

    // ── Task data — fetched directly from ClickUp ──
    let tasks = null;
    const todayAEST = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });

    try {
        await getAccessToken();
        const { tasks: clickupTasks } = await getAllTasks();

        // Build categories + counts from live ClickUp data
        const categories: Record<string, { tasks: string[]; open: number; done: number; overdue: { name: string; due: string }[] }> = {};
        const overdueTasks: { name: string; due: string; category: string }[] = [];
        let totalOpen = 0;
        let totalDone = 0;

        for (const cuTask of clickupTasks) {
            const mapped = mapClickUpTask(cuTask);
            const cat = mapped.category;

            if (!categories[cat]) {
                categories[cat] = { tasks: [], open: 0, done: 0, overdue: [] };
            }
            categories[cat].tasks.push(mapped.name);

            if (mapped.status === 'open') {
                categories[cat].open++;
                totalOpen++;

                // Overdue check
                if (mapped.due_date && mapped.due_date < todayAEST) {
                    overdueTasks.push({ name: mapped.name, due: mapped.due_date, category: cat });
                    categories[cat].overdue.push({ name: mapped.name, due: mapped.due_date });
                }
            } else {
                categories[cat].done++;
                totalDone++;
            }
        }

        // ── Build historical trajectory from task timestamps ──
        const MIGRATION_DATE = '2026-03-09';
        const history: { date: string; open: number; completed: number; added: number; removed: number }[] = [];

        const createdByDate: Record<string, number> = {};
        const closedByDate: Record<string, number> = {};

        for (const cuTask of clickupTasks) {
            const createdDate = new Date(Number(cuTask.date_created)).toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });
            createdByDate[createdDate] = (createdByDate[createdDate] ?? 0) + 1;

            if (cuTask.date_closed) {
                const closedDate = new Date(Number(cuTask.date_closed)).toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });
                closedByDate[closedDate] = (closedByDate[closedDate] ?? 0) + 1;
            }
        }

        let cumulativeCreated = 0;
        let cumulativeClosed = 0;

        for (const [date, count] of Object.entries(createdByDate)) {
            if (date < MIGRATION_DATE) cumulativeCreated += count;
        }
        for (const [date, count] of Object.entries(closedByDate)) {
            if (date < MIGRATION_DATE) cumulativeClosed += count;
        }

        const startDate = new Date(MIGRATION_DATE + 'T00:00:00+11:00');
        const now = new Date();
        for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });

            const added = createdByDate[dateStr] ?? 0;
            const completed = closedByDate[dateStr] ?? 0;
            cumulativeCreated += added;
            cumulativeClosed += completed;

            history.push({
                date: dateStr,
                open: cumulativeCreated - cumulativeClosed,
                completed,
                added,
                removed: 0,
            });
        }

        tasks = {
            updated_at: new Date().toISOString(),
            total_open: totalOpen,
            total_done: totalDone,
            overdue_count: overdueTasks.length,
            categories,
            overdue_tasks: overdueTasks,
            history,
        };
    } catch (e) {
        console.error('[dashboard] ClickUp task fetch error:', e);
    }

    return NextResponse.json({
        sleep: sleepChartData,
        whoopHistory,
        whoop: sleepRows.length ? sleepRows[sleepRows.length - 1] : null,
        habitHistory,
        habitDefinitions: habitDefs,
        tasks,
        lastSynced: tasks?.updated_at ?? null,
        todayAEST,
    });
}
