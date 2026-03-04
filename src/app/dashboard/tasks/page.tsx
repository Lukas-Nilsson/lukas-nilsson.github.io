'use client';

import { useEffect, useState, useCallback } from 'react';
import { AreaChart } from '@/components/charts/Charts';
import DashboardShell from '../DashboardShell';
import styles from '../dashboard.module.css';

interface TasksData {
    updated_at: string; total_open: number; total_done: number;
    categories: Record<string, { open: number; done: number; tasks: string[]; overdue: { name: string; due: string }[] }>;
    overdue_tasks: { name: string; due: string; category: string }[];
    history: { date: string; open: number; done: number; completed?: number; added?: number }[];
}

interface Completion {
    task_name: string;
    category: string | null;
    completed_at: string;
    completed_by: string;
    notes: string | null;
}

const catColors: Record<string, string> = {
    Wedding: '#a07040', THA: '#7a5030', Home: '#8a7a5a',
    Fitness: '#5a8a5a', Finance: '#5a7a8a', Personal: '#7a5a8a', Dev: '#8a5a5a',
};

function shortDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

// Build a flat task list with urgency scoring
interface ScoredTask {
    name: string;
    category: string;
    due: string | null;
    overdueDays: number;
    urgency: 'overdue' | 'this-week' | 'backlog';
    score: number;
    completed: boolean;
}

function buildPriorityStack(tasks: TasksData, todayStr: string, completedSet: Set<string>): ScoredTask[] {
    const today = new Date(todayStr + 'T00:00:00');
    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    const overdueMap = new Map(tasks.overdue_tasks?.map(t => [t.name, t]) ?? []);

    const scored: ScoredTask[] = [];

    for (const [cat, data] of Object.entries(tasks.categories ?? {})) {
        for (const taskName of data.tasks ?? []) {
            const overdueEntry = overdueMap.get(taskName);
            const isOverdue = overdueMap.has(taskName);
            const isCompleted = completedSet.has(taskName);

            let dueDate: Date | null = null;
            let dueStr: string | null = null;
            if (overdueEntry?.due) {
                dueStr = overdueEntry.due;
                dueDate = new Date(overdueEntry.due + 'T00:00:00');
            }

            let overdueDays = 0;
            if (isOverdue && dueDate) {
                overdueDays = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
            }

            let urgency: ScoredTask['urgency'] = 'backlog';
            let score = 0;

            if (isCompleted) {
                score = -1; // Completed tasks sink to bottom
            } else if (isOverdue) {
                urgency = 'overdue';
                score = 1000 + overdueDays;
            } else if (dueDate && dueDate <= weekFromNow) {
                urgency = 'this-week';
                const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                score = 500 + (7 - daysUntil);
            } else {
                urgency = 'backlog';
                score = 100;
            }

            scored.push({ name: taskName, category: cat, due: dueStr, overdueDays, urgency, score, completed: isCompleted });
        }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored;
}

function UrgencyDot({ urgency }: { urgency: ScoredTask['urgency'] }) {
    const colors = { overdue: '#c07070', 'this-week': '#c9a84c', backlog: 'var(--color-border-strong)' };
    return <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors[urgency], flexShrink: 0 }} />;
}

export default function TasksPage() {
    const [tasks, setTasks] = useState<TasksData | null>(null);
    const [completions, setCompletions] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [showCompleted, setShowCompleted] = useState(false);

    useEffect(() => {
        Promise.all([
            fetch('/api/dashboard').then(r => r.json()),
            fetch('/api/dashboard/tasks').then(r => r.json()).catch(() => ({ completions: [] })),
        ]).then(([dashData, taskData]) => {
            setTasks(dashData.tasks ?? null);
            const completed = new Set<string>((taskData.completions ?? []).map((c: Completion) => c.task_name));
            setCompletions(completed);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    const toggleTask = useCallback(async (taskName: string, category: string, currentlyDone: boolean) => {
        setSaving(taskName);
        const action = currentlyDone ? 'uncomplete' : 'complete';

        // Optimistic update
        setCompletions(prev => {
            const next = new Set(prev);
            if (currentlyDone) next.delete(taskName);
            else next.add(taskName);
            return next;
        });

        try {
            const res = await fetch('/api/dashboard/tasks', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ task_name: taskName, category, action }),
            });
            if (!res.ok) {
                const err = await res.json();
                console.error('Task save failed:', err);
                // Revert optimistic update
                setCompletions(prev => {
                    const next = new Set(prev);
                    if (currentlyDone) next.add(taskName);
                    else next.delete(taskName);
                    return next;
                });
                alert(`Failed to ${action} task: ${err.error || 'Unknown error'}`);
            }
        } catch (e) {
            console.error('Task save error:', e);
            setCompletions(prev => {
                const next = new Set(prev);
                if (currentlyDone) next.add(taskName);
                else next.delete(taskName);
                return next;
            });
        }
        setSaving(null);
    }, []);

    if (loading) return (
        <DashboardShell>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                <span className="spinner" style={{ width: 16, height: 16 }} />
                Loading tasks…
            </div>
        </DashboardShell>
    );

    if (!tasks) return (
        <DashboardShell>
            <div className={styles.widget}><p className={styles.widgetNotice}>🔗 No task data yet. Data will appear after the next sync.</p></div>
        </DashboardShell>
    );

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });
    const stack = buildPriorityStack(tasks, todayStr, completions);

    const openTasks = stack.filter(t => !t.completed);
    const completedTasks = stack.filter(t => t.completed);
    const overdue = openTasks.filter(t => t.urgency === 'overdue');
    const thisWeek = openTasks.filter(t => t.urgency === 'this-week');
    const backlog = openTasks.filter(t => t.urgency === 'backlog');

    const chartData = (tasks.history ?? []).map(h => ({
        date: shortDate(h.date),
        'Pile Size': h.open,
        Completed: h.completed ?? 0,
        Added: h.added ?? 0,
    }));

    const renderTask = (t: ScoredTask) => (
        <li key={t.name} className={`${styles.priorityItem} ${t.completed ? styles.priorityItemDone : ''}`}>
            <button
                className={`${styles.taskCheck} ${t.completed ? styles.taskCheckDone : ''}`}
                onClick={() => toggleTask(t.name, t.category, t.completed)}
                disabled={saving === t.name}
                title={t.completed ? 'Mark as incomplete' : 'Mark as complete'}
            >
                {t.completed && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L4 7L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </button>
            <span className={`${styles.priorityName} ${t.completed ? styles.priorityNameDone : ''}`}>{t.name}</span>
            <span className={styles.priorityCat} style={{ color: catColors[t.category] ?? 'var(--color-text-muted)' }}>{t.category}</span>
            {t.urgency === 'overdue' && !t.completed && <span className={styles.priorityDue} style={{ color: '#c07070' }}>{t.overdueDays}d late</span>}
            {t.urgency === 'this-week' && !t.completed && t.due && <span className={styles.priorityDue}>due {shortDate(t.due)}</span>}
        </li>
    );

    return (
        <DashboardShell>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                <div>
                    <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 'var(--space-1)' }}>The Pile</h2>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: 0, maxWidth: 'none' }}>
                        {openTasks.length} open · {completedTasks.length} done · Last synced {shortDate(tasks.updated_at)}
                    </p>
                </div>

                {/* Stats strip */}
                <div className={styles.statsStrip}>
                    {[
                        { label: 'Open', value: openTasks.length, color: '#c17f3a' },
                        { label: 'Done', value: completedTasks.length, color: '#6db86d' },
                        { label: 'Overdue', value: overdue.length, color: '#c07070' },
                        { label: 'This Week', value: thisWeek.length, color: '#c9a84c' },
                    ].map(({ label, value, color }) => (
                        <div key={label} className={styles.statCard}>
                            <span className={styles.statValue} style={{ color }}>{value}</span>
                            <span className={styles.statLabel}>{label}</span>
                        </div>
                    ))}
                </div>

                {/* Trajectory chart */}
                {chartData.length >= 2 && (
                    <div className={styles.widget}>
                        <div className={styles.widgetHeader}>
                            <div className={styles.widgetTitle}><span className={styles.widgetIcon}>◉</span>Pile Trajectory</div>
                        </div>
                        <AreaChart
                            data={chartData}
                            xKey="date"
                            height={180}
                            areas={[
                                { key: 'Pile Size', color: '#c17f3a', name: 'Open pile' },
                                { key: 'Completed', color: '#5a9a5a', name: 'Completed' },
                                { key: 'Added', color: '#c07070', name: 'Added' },
                            ]}
                        />
                    </div>
                )}

                {/* Priority Stack */}
                <div className={styles.widget}>
                    <div className={styles.widgetHeader}>
                        <div className={styles.widgetTitle}><span className={styles.widgetIcon} style={{ color: '#c07070' }}>⚡</span>Priority Stack</div>
                        <span className={styles.widgetBadge}>{openTasks.length} open</span>
                    </div>

                    {/* OVERDUE */}
                    {overdue.length > 0 && (
                        <div>
                            <div className={styles.prioritySectionHeader} style={{ borderColor: 'rgba(192,112,112,0.4)' }}>
                                <span className={styles.prioritySectionDot} style={{ background: '#c07070' }} />
                                <span style={{ color: '#c07070' }}>Overdue</span>
                                <span className={styles.prioritySectionCount}>{overdue.length}</span>
                            </div>
                            <ul className={styles.priorityList}>{overdue.map(renderTask)}</ul>
                        </div>
                    )}

                    {/* THIS WEEK */}
                    {thisWeek.length > 0 && (
                        <div>
                            <div className={styles.prioritySectionHeader} style={{ borderColor: 'rgba(201,168,76,0.4)' }}>
                                <span className={styles.prioritySectionDot} style={{ background: '#c9a84c' }} />
                                <span style={{ color: '#c9a84c' }}>This Week</span>
                                <span className={styles.prioritySectionCount}>{thisWeek.length}</span>
                            </div>
                            <ul className={styles.priorityList}>{thisWeek.map(renderTask)}</ul>
                        </div>
                    )}

                    {/* BACKLOG */}
                    {backlog.length > 0 && (
                        <div>
                            <div className={styles.prioritySectionHeader} style={{ borderColor: 'var(--color-border)' }}>
                                <span className={styles.prioritySectionDot} style={{ background: 'var(--color-border-strong)' }} />
                                <span>Backlog</span>
                                <span className={styles.prioritySectionCount}>{backlog.length}</span>
                            </div>
                            <ul className={styles.priorityList}>{backlog.map(renderTask)}</ul>
                        </div>
                    )}

                    {/* COMPLETED (collapsible) */}
                    {completedTasks.length > 0 && (
                        <div>
                            <button
                                className={styles.prioritySectionHeader}
                                onClick={() => setShowCompleted(!showCompleted)}
                                style={{ borderColor: 'rgba(90,154,90,0.3)', width: '100%', background: 'none', border: 'none', borderBottom: '2px solid rgba(90,154,90,0.3)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                            >
                                <span className={styles.prioritySectionDot} style={{ background: '#5a9a5a' }} />
                                <span style={{ color: '#5a9a5a' }}>Completed</span>
                                <span className={styles.prioritySectionCount}>{completedTasks.length}</span>
                                <span style={{ marginLeft: 'var(--space-2)', fontSize: 10, color: 'var(--color-text-muted)' }}>{showCompleted ? '▴' : '▾'}</span>
                            </button>
                            {showCompleted && (
                                <ul className={styles.priorityList}>{completedTasks.map(renderTask)}</ul>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </DashboardShell>
    );
}
