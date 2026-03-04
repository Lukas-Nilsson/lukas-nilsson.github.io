'use client';

import { useEffect, useState } from 'react';
import { AreaChart } from '@/components/charts/Charts';
import DashboardShell from '../DashboardShell';
import styles from '../dashboard.module.css';

interface TasksData {
    updated_at: string; total_open: number; total_done: number;
    categories: Record<string, { open: number; done: number; tasks: string[]; overdue: { name: string; due: string }[] }>;
    overdue_tasks: { name: string; due: string; category: string }[];
    history: { date: string; open: number; done: number; completed?: number; added?: number }[];
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
    overdueDays: number; // > 0 means overdue
    urgency: 'overdue' | 'this-week' | 'backlog';
    score: number; // higher = more urgent
}

function buildPriorityStack(tasks: TasksData, todayStr: string): ScoredTask[] {
    const today = new Date(todayStr + 'T00:00:00');
    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    const overdueSet = new Set(tasks.overdue_tasks?.map(t => t.name) ?? []);
    const overdueMap = new Map(tasks.overdue_tasks?.map(t => [t.name, t]) ?? []);

    const scored: ScoredTask[] = [];

    for (const [cat, data] of Object.entries(tasks.categories ?? {})) {
        for (const taskName of data.tasks ?? []) {
            const overdueEntry = overdueMap.get(taskName);
            const isOverdue = overdueSet.has(taskName);

            // Find due date from overdue entry
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

            if (isOverdue) {
                urgency = 'overdue';
                score = 1000 + overdueDays; // More overdue = higher score
            } else if (dueDate && dueDate <= weekFromNow) {
                urgency = 'this-week';
                const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                score = 500 + (7 - daysUntil); // Closer deadline = higher score
            } else {
                urgency = 'backlog';
                score = 100;
            }

            scored.push({ name: taskName, category: cat, due: dueStr, overdueDays, urgency, score });
        }
    }

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    return scored;
}

function UrgencyDot({ urgency }: { urgency: ScoredTask['urgency'] }) {
    const colors = { overdue: '#c07070', 'this-week': '#c9a84c', backlog: 'var(--color-border-strong)' };
    return <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors[urgency], flexShrink: 0 }} />;
}

export default function TasksPage() {
    const [tasks, setTasks] = useState<TasksData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/dashboard')
            .then(r => r.json())
            .then(d => { setTasks(d.tasks ?? null); setLoading(false); })
            .catch(() => setLoading(false));
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

    // Get today in AEST
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });
    const stack = buildPriorityStack(tasks, todayStr);

    const overdue = stack.filter(t => t.urgency === 'overdue');
    const thisWeek = stack.filter(t => t.urgency === 'this-week');
    const backlog = stack.filter(t => t.urgency === 'backlog');

    const chartData = (tasks.history ?? []).map(h => ({
        date: shortDate(h.date),
        'Pile Size': h.open,
        Completed: h.completed ?? 0,
        Added: h.added ?? 0,
    }));

    return (
        <DashboardShell>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                <div>
                    <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 'var(--space-1)' }}>The Pile</h2>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: 0, maxWidth: 'none' }}>
                        {tasks.total_open} open · {tasks.total_done} done · Last synced {shortDate(tasks.updated_at)}
                    </p>
                </div>

                {/* Stats strip */}
                <div className={styles.statsStrip}>
                    {[
                        { label: 'Open', value: tasks.total_open, color: '#c17f3a' },
                        { label: 'Done', value: tasks.total_done, color: '#6db86d' },
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
                        <span className={styles.widgetBadge}>{stack.length} tasks</span>
                    </div>

                    {/* OVERDUE section */}
                    {overdue.length > 0 && (
                        <div>
                            <div className={styles.prioritySectionHeader} style={{ borderColor: 'rgba(192,112,112,0.4)' }}>
                                <span className={styles.prioritySectionDot} style={{ background: '#c07070' }} />
                                <span style={{ color: '#c07070' }}>Overdue</span>
                                <span className={styles.prioritySectionCount}>{overdue.length}</span>
                            </div>
                            <ul className={styles.priorityList}>
                                {overdue.map(t => (
                                    <li key={t.name} className={styles.priorityItem}>
                                        <UrgencyDot urgency={t.urgency} />
                                        <span className={styles.priorityName}>{t.name}</span>
                                        <span className={styles.priorityCat} style={{ color: catColors[t.category] ?? 'var(--color-text-muted)' }}>{t.category}</span>
                                        <span className={styles.priorityDue}>{t.overdueDays}d late</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* THIS WEEK section */}
                    {thisWeek.length > 0 && (
                        <div>
                            <div className={styles.prioritySectionHeader} style={{ borderColor: 'rgba(201,168,76,0.4)' }}>
                                <span className={styles.prioritySectionDot} style={{ background: '#c9a84c' }} />
                                <span style={{ color: '#c9a84c' }}>This Week</span>
                                <span className={styles.prioritySectionCount}>{thisWeek.length}</span>
                            </div>
                            <ul className={styles.priorityList}>
                                {thisWeek.map(t => (
                                    <li key={t.name} className={styles.priorityItem}>
                                        <UrgencyDot urgency={t.urgency} />
                                        <span className={styles.priorityName}>{t.name}</span>
                                        <span className={styles.priorityCat} style={{ color: catColors[t.category] ?? 'var(--color-text-muted)' }}>{t.category}</span>
                                        {t.due && <span className={styles.priorityDue}>due {shortDate(t.due)}</span>}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* BACKLOG section */}
                    {backlog.length > 0 && (
                        <div>
                            <div className={styles.prioritySectionHeader} style={{ borderColor: 'var(--color-border)' }}>
                                <span className={styles.prioritySectionDot} style={{ background: 'var(--color-border-strong)' }} />
                                <span>Backlog</span>
                                <span className={styles.prioritySectionCount}>{backlog.length}</span>
                            </div>
                            <ul className={styles.priorityList}>
                                {backlog.map(t => (
                                    <li key={t.name} className={styles.priorityItem}>
                                        <UrgencyDot urgency={t.urgency} />
                                        <span className={styles.priorityName}>{t.name}</span>
                                        <span className={styles.priorityCat} style={{ color: catColors[t.category] ?? 'var(--color-text-muted)' }}>{t.category}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </DashboardShell>
    );
}
