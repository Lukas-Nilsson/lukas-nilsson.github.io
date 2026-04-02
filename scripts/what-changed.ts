/**
 * What-Changed — Snapshot & diff engine for the dashboard.
 *
 * Fetches current state from the dashboard's data sources (Supabase, ClickUp,
 * Google Calendar), hashes it, and compares against the last persisted snapshot.
 * Only emits output when something actually changed.
 *
 * Usage:
 *   npx tsx scripts/what-changed.ts              # prints diff (or "no changes")
 *   npx tsx scripts/what-changed.ts --json        # raw JSON diff output
 *   npx tsx scripts/what-changed.ts --notify      # send macOS notification on change
 *   npx tsx scripts/what-changed.ts --reset        # clear persisted state
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';

import { createAdminClient } from '../src/lib/supabase/admin';
import { getAllTasks, mapClickUpTask } from '../src/lib/clickup';
import type {
    StateSnapshot,
    PersistedState,
    CalendarEventSnapshot,
    TaskSnapshot,
    HabitDaySnapshot,
    WhoopSnapshot,
} from '../src/lib/diff-engine';

import {
    hashSnapshot,
    computeFullDiff,
    formatDiff,
} from '../src/lib/diff-engine';

// ─── Config ──────────────────────────────────────────────────────────────────

const STATE_DIR = join(dirname(__dirname), 'state');
const STATE_FILE = join(STATE_DIR, 'what_changed.json');

async function fetchCurrentState(): Promise<StateSnapshot> {
    const supabase = createAdminClient();
    const todayAEST = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });

    const startDate = new Date(todayAEST + 'T00:00:00+11:00');
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);

    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });

    const [sleepRes, habitRes, calendarRes, clickupTasks] = await Promise.all([
        supabase
            .from('daily_sleep')
            .select('date,recovery,hrv,strain,sleep_hours')
            .order('date', { ascending: false })
            .limit(1),

        supabase
            .from('daily_habits')
            .select('date,habit_id,done,value')
            .gte('date', sevenDaysAgo)
            .order('date', { ascending: true }),

        supabase
            .from('calendar_events')
            .select('google_event_id,title,start_time,end_time,account')
            .gte('start_time', startDate.toISOString())
            .lte('start_time', endDate.toISOString())
            .order('start_time', { ascending: true }),

        (async () => {
            const { tasks } = await getAllTasks({ bustCache: true });
            return tasks.filter(t => !t.parent).map(mapClickUpTask);
        })(),
    ]);

    const calendar_events: CalendarEventSnapshot[] = (calendarRes.data ?? []).map(e => ({
        id: e.google_event_id,
        summary: e.title ?? 'Untitled',
        start: e.start_time,
        end: e.end_time,
        account: e.account ?? 'unknown',
    }));

    const tasks: TaskSnapshot[] = clickupTasks.map(t => ({
        clickup_id: t.clickup_id,
        name: t.name,
        status: t.status,
        priority: t.priority,
        due_date: t.due_date,
        category: t.category,
    }));

    const habitsByDate: Record<string, Record<string, { done: boolean; time: string | null }>> = {};
    for (const row of habitRes.data ?? []) {
        if (!habitsByDate[row.date]) habitsByDate[row.date] = {};
        habitsByDate[row.date][row.habit_id] = { done: row.done, time: row.value };
    }

    const habits: HabitDaySnapshot[] = Object.entries(habitsByDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, checks]) => ({ date, checks, discipline_score: 0 }));

    const latestSleep = sleepRes.data?.[0];
    const whoop: WhoopSnapshot | null = latestSleep
        ? {
            recovery: latestSleep.recovery,
            hrv: latestSleep.hrv,
            strain: latestSleep.strain,
            sleep_hours: latestSleep.sleep_hours,
        }
        : null;

    return {
        calendar_events,
        tasks,
        habits,
        whoop,
        timestamp: new Date().toISOString(),
    };
}

// ─── State Persistence ───────────────────────────────────────────────────────

function loadState(): PersistedState | null {
    if (!existsSync(STATE_FILE)) return null;
    try {
        return JSON.parse(readFileSync(STATE_FILE, 'utf-8')) as PersistedState;
    } catch {
        return null;
    }
}

function saveState(snapshot: StateSnapshot, hash: string): void {
    mkdirSync(STATE_DIR, { recursive: true });
    const state: PersistedState = { hash, timestamp: new Date().toISOString(), snapshot };
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ─── macOS Notification ──────────────────────────────────────────────────────

function sendNotification(title: string, message: string): void {
    const escaped = message.replace(/"/g, '\\"').replace(/\n/g, '\\n');
    try {
        execSync(
            `osascript -e 'display notification "${escaped}" with title "${title}"'`,
            { stdio: 'ignore' },
        );
    } catch {
        // Notification failed — non-fatal
    }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const jsonOutput = args.includes('--json');
    const notify = args.includes('--notify');
    const reset = args.includes('--reset');

    if (reset) {
        if (existsSync(STATE_FILE)) {
            writeFileSync(STATE_FILE, '{}');
            console.log('🔄 State reset.');
        } else {
            console.log('ℹ️  No state file to reset.');
        }
        return;
    }

    console.log('🔍 Fetching current state...');
    const currentSnapshot = await fetchCurrentState();
    const currentHash = hashSnapshot(currentSnapshot);

    const previousState = loadState();

    if (!previousState || !previousState.hash) {
        // First run — save baseline
        saveState(currentSnapshot, currentHash);
        console.log('📸 First run — baseline snapshot saved.');
        if (jsonOutput) {
            console.log(JSON.stringify({ firstRun: true, snapshot: currentSnapshot }, null, 2));
        }
        return;
    }

    if (previousState.hash === currentHash) {
        console.log('✅ No changes detected since', previousState.timestamp);
        if (jsonOutput) {
            console.log(JSON.stringify({ hasChanges: false, lastChecked: previousState.timestamp }));
        }
        return;
    }

    // Compute diff
    const diff = computeFullDiff(previousState.snapshot, currentSnapshot);

    if (!diff.hasChanges) {
        // Hash changed but diff engine found no meaningful changes (ordering, etc.)
        saveState(currentSnapshot, currentHash);
        console.log('✅ No meaningful changes (hash shifted, content equivalent).');
        return;
    }

    // Save new state
    saveState(currentSnapshot, currentHash);

    if (jsonOutput) {
        console.log(JSON.stringify(diff, null, 2));
    } else {
        const summary = formatDiff(diff);
        console.log('\n' + summary);
    }

    if (notify) {
        const lines: string[] = [];
        const cal = diff.calendar;
        const t = diff.tasks;
        if (cal.added.length) lines.push(`+${cal.added.length} events`);
        if (cal.removed.length) lines.push(`-${cal.removed.length} events`);
        if (t.completed.length) lines.push(`✓${t.completed.length} tasks done`);
        if (t.newTasks.length) lines.push(`+${t.newTasks.length} new tasks`);
        if (t.newlyOverdue.length) lines.push(`⚠${t.newlyOverdue.length} overdue`);
        sendNotification('Dashboard Changed', lines.join(', ') || 'Something changed');
    }
}

main().catch(err => {
    console.error('❌ Error:', err.message ?? err);
    process.exit(1);
});
