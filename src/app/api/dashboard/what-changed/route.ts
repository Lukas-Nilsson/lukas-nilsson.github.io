/**
 * GET /api/dashboard/what-changed
 *
 * Runs the what-changed diff engine on-demand and returns the result.
 * The dashboard can poll this endpoint to show a "What Changed" widget.
 *
 * Query params:
 *   ?reset=true  — clear persisted state (returns { reset: true })
 *
 * Response shape:
 *   { firstRun: true, snapshot: {...} }           — no previous state
 *   { hasChanges: false, lastChecked: "ISO" }     — nothing changed
 *   { hasChanges: true, diff: FullDiff, summary: "..." }  — changes detected
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/supabase/auth-guard';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAccessToken as getClickUpToken, getAllTasks, mapClickUpTask } from '@/lib/clickup';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

import type {
    StateSnapshot,
    PersistedState,
    CalendarEventSnapshot,
    TaskSnapshot,
    HabitDaySnapshot,
    WhoopSnapshot,
} from '@/lib/diff-engine';

import {
    hashSnapshot,
    computeFullDiff,
    formatDiff,
} from '@/lib/diff-engine';

// State file lives at project root state/ directory
const STATE_DIR = join(process.cwd(), 'state');
const STATE_FILE = join(STATE_DIR, 'what_changed.json');

function loadState(): PersistedState | null {
    if (!existsSync(STATE_FILE)) return null;
    try {
        const raw = readFileSync(STATE_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!parsed.hash) return null;
        return parsed as PersistedState;
    } catch {
        return null;
    }
}

function saveState(snapshot: StateSnapshot, hash: string): void {
    mkdirSync(STATE_DIR, { recursive: true });
    const state: PersistedState = { hash, timestamp: new Date().toISOString(), snapshot };
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export async function GET(req: NextRequest) {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    // Handle reset
    const url = new URL(req.url);
    if (url.searchParams.get('reset') === 'true') {
        if (existsSync(STATE_FILE)) writeFileSync(STATE_FILE, '{}');
        return NextResponse.json({ reset: true });
    }

    try {
        // ── Fetch current state in parallel ──
        const supabase = createAdminClient();
        const todayAEST = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });

        // Calendar: next 7 days
        const startDate = new Date(todayAEST + 'T00:00:00+11:00');
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 7);

        const [sleepRes, habitRes, calendarRes, clickupResult] = await Promise.all([
            supabase
                .from('daily_sleep')
                .select('date,recovery,hrv,strain,sleep_hours')
                .order('date', { ascending: false })
                .limit(1),

            supabase
                .from('daily_habits')
                .select('date,habit_id,done,value')
                .gte('date', new Date(Date.now() - 7 * 86400000).toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' }))
                .order('date', { ascending: true }),

            supabase
                .from('calendar_events')
                .select('google_event_id,title,start_time,end_time,account')
                .gte('start_time', startDate.toISOString())
                .lte('start_time', endDate.toISOString())
                .order('start_time', { ascending: true }),

            (async () => {
                try {
                    await getClickUpToken();
                    const { tasks } = await getAllTasks();
                    return tasks.filter(t => !t.parent).map(mapClickUpTask);
                } catch {
                    return [];
                }
            })(),
        ]);

        // ── Build snapshot ──
        const calendar_events: CalendarEventSnapshot[] = (calendarRes.data ?? []).map(e => ({
            id: e.google_event_id,
            summary: e.title ?? 'Untitled',
            start: e.start_time,
            end: e.end_time,
            account: e.account ?? 'unknown',
        }));

        const tasks: TaskSnapshot[] = clickupResult.map(t => ({
            clickup_id: t.clickup_id,
            name: t.name,
            status: t.status,
            priority: t.priority,
            due_date: t.due_date,
            category: t.category,
        }));

        // Build habit day snapshots from rows
        const habitsByDate: Record<string, Record<string, { done: boolean; time: string | null }>> = {};
        for (const r of habitRes.data ?? []) {
            if (!habitsByDate[r.date]) habitsByDate[r.date] = {};
            habitsByDate[r.date][r.habit_id] = { done: r.done, time: r.value };
        }
        const habits: HabitDaySnapshot[] = Object.entries(habitsByDate).map(([date, checks]) => ({
            date,
            checks,
            discipline_score: 0, // Score is computed client-side; we compare at the habit level
        }));

        const latestSleep = sleepRes.data?.[0];
        const whoop: WhoopSnapshot | null = latestSleep
            ? {
                recovery: latestSleep.recovery,
                hrv: latestSleep.hrv,
                strain: latestSleep.strain,
                sleep_hours: latestSleep.sleep_hours,
            }
            : null;

        const currentSnapshot: StateSnapshot = {
            calendar_events,
            tasks,
            habits,
            whoop,
            timestamp: new Date().toISOString(),
        };

        const currentHash = hashSnapshot(currentSnapshot);
        const previousState = loadState();

        // First run
        if (!previousState) {
            saveState(currentSnapshot, currentHash);
            return NextResponse.json({ firstRun: true, message: 'Baseline snapshot saved.' });
        }

        // No change
        if (previousState.hash === currentHash) {
            return NextResponse.json({
                hasChanges: false,
                lastChecked: previousState.timestamp,
            });
        }

        // Compute diff
        const diff = computeFullDiff(previousState.snapshot, currentSnapshot);

        if (!diff.hasChanges) {
            // Hash shifted but no semantic changes
            saveState(currentSnapshot, currentHash);
            return NextResponse.json({
                hasChanges: false,
                lastChecked: previousState.timestamp,
                note: 'Hash shifted, content equivalent',
            });
        }

        // Save new state and return diff
        saveState(currentSnapshot, currentHash);

        return NextResponse.json({
            hasChanges: true,
            diff,
            summary: formatDiff(diff),
            checkedAt: new Date().toISOString(),
        });
    } catch (err) {
        console.error('[what-changed] Error:', err);
        return NextResponse.json(
            { error: 'Failed to compute changes', detail: String(err) },
            { status: 500 },
        );
    }
}
