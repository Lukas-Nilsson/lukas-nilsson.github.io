/**
 * Diff Engine — Pure-function diffing logic for the what-changed system.
 *
 * Each diff function takes a previous and current state snapshot
 * and returns a structured description of what changed.
 */

import { createHash } from 'crypto';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CalendarEventSnapshot {
    id: string;
    summary: string;
    start: string;     // ISO datetime or YYYY-MM-DD
    end: string;
    account: string;   // calendar account
}

export interface TaskSnapshot {
    clickup_id: string;
    name: string;
    status: 'open' | 'done' | 'abandoned';
    priority: string | null;
    due_date: string | null;
    category: string;
}

export interface HabitDaySnapshot {
    date: string;
    checks: Record<string, { done: boolean; time: string | null }>;
    discipline_score: number;
}

export interface WhoopSnapshot {
    recovery: number | null;
    hrv: number | null;
    strain: number | null;
    sleep_hours: number | null;
}

export interface StateSnapshot {
    calendar_events: CalendarEventSnapshot[];
    tasks: TaskSnapshot[];
    habits: HabitDaySnapshot[];
    whoop: WhoopSnapshot | null;
    timestamp: string;
}

export interface PersistedState {
    hash: string;
    timestamp: string;
    snapshot: StateSnapshot;
}

// ─── Diff Result Types ───────────────────────────────────────────────────────

export interface CalendarDiff {
    added: CalendarEventSnapshot[];
    removed: CalendarEventSnapshot[];
    changed: { event: CalendarEventSnapshot; changes: string[] }[];
}

export interface TaskDiff {
    newTasks: TaskSnapshot[];
    completed: TaskSnapshot[];
    abandoned: TaskSnapshot[];
    newlyOverdue: TaskSnapshot[];
    priorityChanged: { task: TaskSnapshot; from: string | null; to: string | null }[];
}

export interface HabitDiff {
    newCompletions: { habit: string; date: string }[];
    broken: { habit: string; date: string }[];
    scoreChanged: { date: string; from: number; to: number }[];
}

export interface WhoopDiff {
    recoveryDelta: number | null;
    hrvDelta: number | null;
    significantChange: boolean;
}

export interface FullDiff {
    calendar: CalendarDiff;
    tasks: TaskDiff;
    habits: HabitDiff;
    whoop: WhoopDiff;
    hasChanges: boolean;
}

// ─── Hash ────────────────────────────────────────────────────────────────────

/**
 * Compute a deterministic SHA-256 hash of a snapshot.
 * Strips volatile fields (timestamp) and sorts keys for stability.
 */
export function hashSnapshot(snapshot: StateSnapshot): string {
    const normalized = {
        calendar_events: [...snapshot.calendar_events].sort((a, b) => a.id.localeCompare(b.id)),
        tasks: [...snapshot.tasks].sort((a, b) => a.clickup_id.localeCompare(b.clickup_id)),
        habits: [...snapshot.habits].sort((a, b) => a.date.localeCompare(b.date)),
        whoop: snapshot.whoop,
    };
    return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

// ─── Calendar Diff ───────────────────────────────────────────────────────────

export function diffCalendar(prev: CalendarEventSnapshot[], curr: CalendarEventSnapshot[]): CalendarDiff {
    const prevMap = new Map(prev.map(e => [e.id, e]));
    const currMap = new Map(curr.map(e => [e.id, e]));

    const added: CalendarEventSnapshot[] = [];
    const removed: CalendarEventSnapshot[] = [];
    const changed: { event: CalendarEventSnapshot; changes: string[] }[] = [];

    // Find added and changed events
    for (const [id, event] of currMap) {
        const prevEvent = prevMap.get(id);
        if (!prevEvent) {
            added.push(event);
        } else {
            const changes: string[] = [];
            if (prevEvent.summary !== event.summary) {
                changes.push(`renamed: "${prevEvent.summary}" → "${event.summary}"`);
            }
            if (prevEvent.start !== event.start || prevEvent.end !== event.end) {
                changes.push(`rescheduled: ${fmtTime(prevEvent.start)} → ${fmtTime(event.start)}`);
            }
            if (changes.length) {
                changed.push({ event, changes });
            }
        }
    }

    // Find removed events
    for (const [id, event] of prevMap) {
        if (!currMap.has(id)) {
            removed.push(event);
        }
    }

    return { added, removed, changed };
}

// ─── Task Diff ───────────────────────────────────────────────────────────────

export function diffTasks(prev: TaskSnapshot[], curr: TaskSnapshot[], todayDate: string): TaskDiff {
    const prevMap = new Map(prev.map(t => [t.clickup_id, t]));
    const currMap = new Map(curr.map(t => [t.clickup_id, t]));

    const newTasks: TaskSnapshot[] = [];
    const completed: TaskSnapshot[] = [];
    const abandoned: TaskSnapshot[] = [];
    const newlyOverdue: TaskSnapshot[] = [];
    const priorityChanged: { task: TaskSnapshot; from: string | null; to: string | null }[] = [];

    for (const [id, task] of currMap) {
        const prevTask = prevMap.get(id);
        if (!prevTask) {
            newTasks.push(task);
            continue;
        }

        // Status transitions
        if (prevTask.status === 'open' && task.status === 'done') {
            completed.push(task);
        } else if (prevTask.status === 'open' && task.status === 'abandoned') {
            abandoned.push(task);
        }

        // Priority changes
        if (prevTask.priority !== task.priority) {
            priorityChanged.push({ task, from: prevTask.priority, to: task.priority });
        }

        // Newly overdue (was not overdue before, now is)
        const wasOverdue = prevTask.due_date ? prevTask.due_date < todayDate : false;
        const isOverdue = task.due_date ? task.due_date < todayDate && task.status === 'open' : false;
        if (!wasOverdue && isOverdue) {
            newlyOverdue.push(task);
        }
    }

    return { newTasks, completed, abandoned, newlyOverdue, priorityChanged };
}

// ─── Habit Diff ──────────────────────────────────────────────────────────────

export function diffHabits(prev: HabitDaySnapshot[], curr: HabitDaySnapshot[]): HabitDiff {
    const prevMap = new Map(prev.map(h => [h.date, h]));

    const newCompletions: { habit: string; date: string }[] = [];
    const broken: { habit: string; date: string }[] = [];
    const scoreChanged: { date: string; from: number; to: number }[] = [];

    for (const day of curr) {
        const prevDay = prevMap.get(day.date);
        if (!prevDay) continue; // New day — not a "change"

        // Check individual habits
        for (const [habitId, check] of Object.entries(day.checks)) {
            const prevCheck = prevDay.checks[habitId];
            if (!prevCheck) continue;

            if (!prevCheck.done && check.done) {
                newCompletions.push({ habit: habitId, date: day.date });
            } else if (prevCheck.done && !check.done) {
                broken.push({ habit: habitId, date: day.date });
            }
        }

        // Score changes (only report significant shifts ≥ 5 points)
        if (Math.abs(day.discipline_score - prevDay.discipline_score) >= 5) {
            scoreChanged.push({ date: day.date, from: prevDay.discipline_score, to: day.discipline_score });
        }
    }

    return { newCompletions, broken, scoreChanged };
}

// ─── Whoop Diff ──────────────────────────────────────────────────────────────

export function diffWhoop(prev: WhoopSnapshot | null, curr: WhoopSnapshot | null): WhoopDiff {
    if (!prev || !curr) {
        return { recoveryDelta: null, hrvDelta: null, significantChange: false };
    }

    const recoveryDelta = (curr.recovery ?? 0) - (prev.recovery ?? 0);
    const hrvDelta = (curr.hrv ?? 0) - (prev.hrv ?? 0);
    const significantChange = Math.abs(recoveryDelta) >= 10 || Math.abs(hrvDelta) >= 10;

    return { recoveryDelta, hrvDelta, significantChange };
}

// ─── Full Diff ───────────────────────────────────────────────────────────────

export function computeFullDiff(prev: StateSnapshot, curr: StateSnapshot): FullDiff {
    const todayDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });

    const calendar = diffCalendar(prev.calendar_events, curr.calendar_events);
    const tasks = diffTasks(prev.tasks, curr.tasks, todayDate);
    const habits = diffHabits(prev.habits, curr.habits);
    const whoop = diffWhoop(prev.whoop, curr.whoop);

    const hasChanges =
        calendar.added.length > 0 ||
        calendar.removed.length > 0 ||
        calendar.changed.length > 0 ||
        tasks.newTasks.length > 0 ||
        tasks.completed.length > 0 ||
        tasks.abandoned.length > 0 ||
        tasks.newlyOverdue.length > 0 ||
        tasks.priorityChanged.length > 0 ||
        habits.newCompletions.length > 0 ||
        habits.broken.length > 0 ||
        whoop.significantChange;

    return { calendar, tasks, habits, whoop, hasChanges };
}

// ─── Formatter ───────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
    if (!iso.includes('T')) return iso; // All-day date
    const d = new Date(iso);
    return d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', timeZone: 'Australia/Melbourne' });
}

/**
 * Format a full diff into a human-readable summary string.
 * Used for notifications and the CLI output.
 */
export function formatDiff(diff: FullDiff): string {
    if (!diff.hasChanges) return '✅ No changes detected.';

    const lines: string[] = [];

    // Calendar
    const cal = diff.calendar;
    if (cal.added.length || cal.removed.length || cal.changed.length) {
        lines.push('📅 Calendar:');
        for (const e of cal.added) {
            lines.push(`  + ${e.summary} (${fmtTime(e.start)})`);
        }
        for (const e of cal.removed) {
            lines.push(`  − ${e.summary} (was ${fmtTime(e.start)})`);
        }
        for (const c of cal.changed) {
            lines.push(`  ~ ${c.event.summary}: ${c.changes.join(', ')}`);
        }
    }

    // Tasks
    const t = diff.tasks;
    if (t.newTasks.length || t.completed.length || t.abandoned.length || t.newlyOverdue.length) {
        lines.push('📋 Tasks:');
        for (const task of t.newTasks) lines.push(`  + ${task.name} [${task.category}]`);
        for (const task of t.completed) lines.push(`  ✓ ${task.name} completed`);
        for (const task of t.abandoned) lines.push(`  ✗ ${task.name} abandoned`);
        for (const task of t.newlyOverdue) lines.push(`  ⚠ ${task.name} is now overdue (due ${task.due_date})`);
        for (const p of t.priorityChanged) lines.push(`  ⚑ ${p.task.name}: ${p.from ?? 'none'} → ${p.to ?? 'none'}`);
    }

    // Habits
    const h = diff.habits;
    if (h.newCompletions.length || h.broken.length) {
        lines.push('🧘 Habits:');
        for (const c of h.newCompletions) lines.push(`  ✓ ${c.habit} done (${c.date})`);
        for (const b of h.broken) lines.push(`  ✗ ${b.habit} unchecked (${b.date})`);
        for (const s of h.scoreChanged) lines.push(`  📊 Score ${s.date}: ${s.from}% → ${s.to}%`);
    }

    // Whoop
    const w = diff.whoop;
    if (w.significantChange) {
        lines.push('💚 Whoop:');
        if (w.recoveryDelta !== null) {
            const arrow = w.recoveryDelta > 0 ? '↑' : '↓';
            lines.push(`  Recovery ${arrow}${Math.abs(w.recoveryDelta)}%`);
        }
        if (w.hrvDelta !== null) {
            const arrow = w.hrvDelta > 0 ? '↑' : '↓';
            lines.push(`  HRV ${arrow}${Math.abs(w.hrvDelta)}ms`);
        }
    }

    return lines.join('\n');
}
