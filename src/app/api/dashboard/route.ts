import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET() {
    const supabase = createAdminClient();

    const [sleepRes, habitRes, challengeRes, taskRes] = await Promise.all([
        // NEW: 14-day sleep + recovery from daily_sleep
        supabase
            .from('daily_sleep')
            .select('date,recovery,hrv,rhr,strain,spo2,sleep_performance,sleep_hours,deep_hours,rem_hours,light_hours,bedtime_aest,wake_aest')
            .order('date', { ascending: true })
            .limit(14),

        // NEW: all habits grouped by date, joined to definitions for label/icon/category
        supabase
            .from('daily_habits')
            .select('date,habit_id,done,value,notes,source')
            .order('date', { ascending: true }),

        // NEW: challenge days from active challenge
        supabase
            .from('challenge_days')
            .select('date,day_number,completed,notes,challenge_id')
            .order('date', { ascending: true }),

        // NEW: task snapshots
        supabase
            .from('task_snapshots')
            .select('*')
            .order('date', { ascending: false })
            .limit(30),
    ]);

    const sleepRows = sleepRes.data ?? [];
    const habitRows = habitRes.data ?? [];
    const challengeDays = challengeRes.data ?? [];
    const taskRows = taskRes.data ?? [];

    // ── Build per-day habit lookup ──
    // { 'YYYY-MM-DD': { workout_outdoor: { done, value, notes }, ... } }
    const habitsByDate: Record<string, Record<string, { done: boolean; value: string | null; notes: string | null; source: string }>> = {};
    habitRows.forEach(r => {
        if (!habitsByDate[r.date]) habitsByDate[r.date] = {};
        habitsByDate[r.date][r.habit_id] = { done: r.done, value: r.value, notes: r.notes, source: r.source };
    });

    // ── Build hard75History shape (compatible with existing dashboard widgets) ──
    // Merge challenge_days + habitat data into the shape the dashboard expects
    const hard75History = challengeDays.map((cd, i, arr) => {
        const checks = habitsByDate[cd.date] ?? {};
        // Map new habit_ids back to the legacy check keys the UI uses
        const checksMapped: Record<string, { done: boolean; time: string | null }> = {
            workout1: { done: checks['workout_outdoor']?.done ?? false, time: checks['workout_outdoor']?.value ?? null },
            workout2: { done: checks['workout_2']?.done ?? false, time: checks['workout_2']?.value ?? null },
            water: { done: checks['water']?.done ?? false, time: checks['water']?.value ?? null },
            diet: { done: checks['diet']?.done ?? false, time: checks['diet']?.value ?? null },
            reading: { done: checks['reading']?.done ?? false, time: checks['reading']?.value ?? null },
            teeth: { done: checks['teeth']?.done ?? false, time: checks['teeth']?.value ?? null },
            bedtime: { done: checks['bedtime']?.done ?? false, time: checks['bedtime']?.value ?? null },
            wake: { done: checks['wake']?.done ?? false, time: checks['wake']?.value ?? null },
            phone_down: { done: checks['phone_down']?.done ?? false, time: checks['phone_down']?.value ?? null },
        };
        const doneCount = Object.values(checksMapped).filter(c => c.done).length;
        return {
            date: cd.date,
            day: cd.day_number ?? null,
            today_complete: cd.completed ?? false,
            checks: checksMapped,
            discipline_score: Math.round((doneCount / 9) * 100),
            finish_confidence: null,
        };
    });

    // Also include dates that have habits but aren't challenge days (pre-challenge habit tracking)
    const challengeDates = new Set(challengeDays.map(d => d.date));
    const preChallengeDates = Object.keys(habitsByDate).filter(d => !challengeDates.has(d)).sort();
    preChallengeDates.forEach(date => {
        const checks = habitsByDate[date] ?? {};
        const checksMapped: Record<string, { done: boolean; time: string | null }> = {
            workout1: { done: checks['workout_outdoor']?.done ?? false, time: checks['workout_outdoor']?.value ?? null },
            workout2: { done: checks['workout_2']?.done ?? false, time: checks['workout_2']?.value ?? null },
            water: { done: checks['water']?.done ?? false, time: checks['water']?.value ?? null },
            diet: { done: checks['diet']?.done ?? false, time: checks['diet']?.value ?? null },
            reading: { done: checks['reading']?.done ?? false, time: checks['reading']?.value ?? null },
            teeth: { done: checks['teeth']?.done ?? false, time: checks['teeth']?.value ?? null },
            bedtime: { done: checks['bedtime']?.done ?? false, time: checks['bedtime']?.value ?? null },
            wake: { done: checks['wake']?.done ?? false, time: checks['wake']?.value ?? null },
            phone_down: { done: checks['phone_down']?.done ?? false, time: checks['phone_down']?.value ?? null },
        };
        hard75History.unshift({
            date, day: null, today_complete: false,
            checks: checksMapped,
            discipline_score: 0,
            finish_confidence: null,
        });
    });

    // Sort by date ascending
    hard75History.sort((a, b) => a.date.localeCompare(b.date));

    // ── Whoop history for charts (from daily_sleep) ──
    const whoopHistory = sleepRows.map(s => ({
        date: s.date,
        recovery: s.recovery,
        hrv: s.hrv,
        strain: s.strain,
        sleep_hours: s.sleep_hours,
        sleep_performance: s.sleep_performance,
    }));

    // ── Sleep chart data — map daily_sleep column names → widget-expected names ──
    // SleepChartWidget uses: .performance, .deep, .rem, .light, .date
    const sleepChartData = sleepRows.map(s => ({
        date: s.date,
        performance: s.sleep_performance ?? null,
        deep: s.deep_hours ?? null,
        rem: s.rem_hours ?? null,
        light: s.light_hours ?? null,
        hours: s.sleep_hours ?? null,
    }));

    // ── Computed trajectory from tasks table (single source of truth) ──
    // Instead of snapshot deltas, compute everything from created_at/completed_at
    let allTasks: { name: string; status: string; created_at: string; completed_at: string | null }[] = [];
    try {
        const tasksRes = await supabase
            .from('tasks')
            .select('name,status,created_at,completed_at');
        allTasks = tasksRes.data ?? [];
    } catch { /* tasks table may not exist yet */ }

    const latestTask = taskRows[0] ?? null;
    let taskHistory: { date: string; open: number; done: number; completed: number; added: number; removed: number }[] = [];

    if (allTasks.length > 0) {
        // Compute per-day added/completed/removed from task timestamps
        const addedByDate = new Map<string, number>();
        const completedByDate = new Map<string, number>();
        const removedByDate = new Map<string, number>();

        for (const task of allTasks) {
            if (task.created_at) {
                const d = new Date(task.created_at).toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });
                addedByDate.set(d, (addedByDate.get(d) ?? 0) + 1);
            }
            if (task.completed_at && task.status === 'done') {
                const d = new Date(task.completed_at).toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });
                completedByDate.set(d, (completedByDate.get(d) ?? 0) + 1);
            }
            if (task.completed_at && task.status === 'abandoned') {
                const d = new Date(task.completed_at).toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });
                removedByDate.set(d, (removedByDate.get(d) ?? 0) + 1);
            }
        }

        // Build date range from earliest created_at to today
        const todayAESTStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });
        const dates = new Set([...addedByDate.keys(), ...completedByDate.keys(), ...removedByDate.keys(), todayAESTStr]);
        const sortedDates = [...dates].sort();

        // Compute running totals
        let cumulativeOpen = 0;
        let cumulativeDone = 0;
        for (const date of sortedDates) {
            const added = addedByDate.get(date) ?? 0;
            const completed = completedByDate.get(date) ?? 0;
            const removed = removedByDate.get(date) ?? 0;
            cumulativeOpen += added - completed - removed;
            cumulativeDone += completed;
            taskHistory.push({
                date,
                open: cumulativeOpen,
                done: cumulativeDone,
                added,
                completed,
                removed,
            });
        }
    } else {
        // Fallback to snapshot-based trajectory if no tasks table data
        taskHistory = [...taskRows].reverse().map(t => ({
            date: t.date,
            open: t.open_count,
            done: t.done_count,
            completed: t.completed_delta ?? 0,
            added: t.added_delta ?? 0,
            removed: t.removed_delta ?? 0,
        }));
    }

    const totalOpen = taskHistory.length > 0 ? taskHistory[taskHistory.length - 1].open : (latestTask?.open_count ?? 0);
    const totalDone = taskHistory.length > 0 ? taskHistory[taskHistory.length - 1].done : (latestTask?.done_count ?? 0);

    const tasks = latestTask ? {
        updated_at: latestTask.updated_at,
        total_open: totalOpen,
        total_done: totalDone,
        overdue_count: latestTask.overdue_count,
        categories: latestTask.categories ?? {},
        overdue_tasks: latestTask.overdue_tasks ?? [],
        history: taskHistory,
    } : null;

    // ── Today in AEST ──
    const todayAEST = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });

    return NextResponse.json({
        // Sleep chart (widget-compatible shape)
        sleep: sleepChartData,
        // Whoop history for recovery/strain charts
        whoopHistory,
        // Today's whoop snapshot (most recent day)
        whoop: sleepRows.length ? sleepRows[sleepRows.length - 1] : null,

        // Habits (unified)
        hard75History,
        hard75: hard75History.length ? hard75History[hard75History.length - 1] : null,

        // Tasks
        tasks,

        // Meta
        lastSynced: latestTask?.updated_at ?? null,
        todayAEST,
    });
}
