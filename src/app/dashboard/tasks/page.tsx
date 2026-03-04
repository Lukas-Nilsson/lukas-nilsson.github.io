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

interface TaskMeta {
    priority: string | null;
    due_date: string | null;
    waiting_on: string | null;
    notes: string | null;
}

const catColors: Record<string, string> = {
    Wedding: '#a07040', THA: '#7a5030', Home: '#8a7a5a',
    Fitness: '#5a8a5a', Finance: '#5a7a8a', Personal: '#7a5a8a', Dev: '#8a5a5a',
};

const priorityConfig: Record<string, { label: string; color: string; score: number }> = {
    urgent: { label: '🔴 Urgent', color: '#c07070', score: 900 },
    this_week: { label: '🟡 This Week', color: '#c9a84c', score: 700 },
    this_month: { label: '🔵 This Month', color: '#5a7a8a', score: 400 },
    someday: { label: '⚪ Someday', color: 'var(--color-text-muted)', score: 50 },
};

function shortDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

// ─── Scored Task ─────────────────────────────────────────────────────────────
interface ScoredTask {
    name: string;
    category: string;
    due: string | null;
    overdueDays: number;
    urgency: string; // overdue | urgent | this_week | this_month | waiting | backlog
    score: number;
    completed: boolean;
    meta: TaskMeta | null;
}

function buildPriorityStack(
    tasks: TasksData,
    todayStr: string,
    completedSet: Set<string>,
    metaMap: Map<string, TaskMeta>,
): ScoredTask[] {
    const today = new Date(todayStr + 'T00:00:00');
    const overdueMap = new Map(tasks.overdue_tasks?.map(t => [t.name, t]) ?? []);

    const scored: ScoredTask[] = [];

    for (const [cat, data] of Object.entries(tasks.categories ?? {})) {
        for (const taskName of data.tasks ?? []) {
            const overdueEntry = overdueMap.get(taskName);
            const isOverdue = overdueMap.has(taskName);
            const isCompleted = completedSet.has(taskName);
            const meta = metaMap.get(taskName) ?? null;

            let dueStr = meta?.due_date ?? overdueEntry?.due ?? null;
            let dueDate: Date | null = dueStr ? new Date(dueStr + 'T00:00:00') : null;

            let overdueDays = 0;
            if (dueDate && dueDate < today) {
                overdueDays = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
            }

            let urgency = 'backlog';
            let score = 100;

            if (isCompleted) {
                urgency = 'completed';
                score = -1;
            } else if (meta?.waiting_on) {
                urgency = 'waiting';
                score = 10; // Blocked tasks sink below backlog
            } else if (overdueDays > 0) {
                urgency = 'overdue';
                score = 1000 + overdueDays;
            } else if (meta?.priority && priorityConfig[meta.priority]) {
                urgency = meta.priority;
                score = priorityConfig[meta.priority].score;
                // Boost by due date proximity if set
                if (dueDate) {
                    const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    score += Math.max(0, 30 - daysUntil);
                }
            } else if (isOverdue) {
                urgency = 'overdue';
                score = 1000 + overdueDays;
            } else {
                urgency = 'backlog';
                score = 100;
            }

            scored.push({ name: taskName, category: cat, due: dueStr, overdueDays, urgency, score, completed: isCompleted, meta });
        }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored;
}

// ─── Task Edit Modal ─────────────────────────────────────────────────────────
function TaskEditModal({ task, onClose, onSave }: {
    task: ScoredTask;
    onClose: () => void;
    onSave: (taskName: string, meta: TaskMeta) => void;
}) {
    const [priority, setPriority] = useState(task.meta?.priority ?? '');
    const [dueDate, setDueDate] = useState(task.meta?.due_date ?? '');
    const [waitingOn, setWaitingOn] = useState(task.meta?.waiting_on ?? '');
    const [notes, setNotes] = useState(task.meta?.notes ?? '');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/dashboard/tasks', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task_name: task.name,
                    action: 'update_metadata',
                    priority: priority || null,
                    due_date: dueDate || null,
                    waiting_on: waitingOn || null,
                    notes: notes || null,
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                alert(`Save failed: ${err.error}`);
                setSaving(false);
                return;
            }
            onSave(task.name, {
                priority: priority || null,
                due_date: dueDate || null,
                waiting_on: waitingOn || null,
                notes: notes || null,
            });
            onClose();
        } catch (e) {
            alert(`Save failed: ${e}`);
        }
        setSaving(false);
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h3 className={styles.modalTitle}>
                        <span style={{ color: catColors[task.category] ?? 'var(--color-text-muted)' }}>{task.category}</span>
                        {' · '}
                        {task.name}
                    </h3>
                    <button className={styles.modalClose} onClick={onClose}>✕</button>
                </div>

                {/* Priority picker */}
                <div className={styles.modalField}>
                    <label className={styles.modalLabel}>Priority</label>
                    <div className={styles.priorityPicker}>
                        {Object.entries(priorityConfig).map(([key, { label, color }]) => (
                            <button
                                key={key}
                                className={`${styles.priorityChip} ${priority === key ? styles.priorityChipActive : ''}`}
                                style={{
                                    borderColor: priority === key ? color : undefined,
                                    background: priority === key ? `${color}15` : undefined,
                                }}
                                onClick={() => setPriority(priority === key ? '' : key)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Due date */}
                <div className={styles.modalField}>
                    <label className={styles.modalLabel}>Due Date</label>
                    <input
                        type="date"
                        className={styles.modalInput}
                        value={dueDate}
                        onChange={e => setDueDate(e.target.value)}
                    />
                </div>

                {/* Waiting on */}
                <div className={styles.modalField}>
                    <label className={styles.modalLabel}>Waiting On / Blocked By</label>
                    <input
                        type="text"
                        className={styles.modalInput}
                        placeholder="e.g. Waiting on Yari, Need quote from builder..."
                        value={waitingOn}
                        onChange={e => setWaitingOn(e.target.value)}
                    />
                </div>

                {/* Notes */}
                <div className={styles.modalField}>
                    <label className={styles.modalLabel}>Notes</label>
                    <textarea
                        className={styles.modalInput}
                        rows={2}
                        placeholder="Any extra context..."
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                    />
                </div>

                {/* Save */}
                <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', paddingTop: 'var(--space-3)' }}>
                    <button className={styles.modalBtnSecondary} onClick={onClose}>Cancel</button>
                    <button className={styles.modalBtnPrimary} onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function TasksPage() {
    const [tasks, setTasks] = useState<TasksData | null>(null);
    const [completions, setCompletions] = useState<Set<string>>(new Set());
    const [metaMap, setMetaMap] = useState<Map<string, TaskMeta>>(new Map());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [showCompleted, setShowCompleted] = useState(false);
    const [editingTask, setEditingTask] = useState<ScoredTask | null>(null);

    useEffect(() => {
        Promise.all([
            fetch('/api/dashboard').then(r => r.json()),
            fetch('/api/dashboard/tasks').then(r => r.json()).catch(() => ({ completions: [], metadata: [] })),
        ]).then(([dashData, taskData]) => {
            setTasks(dashData.tasks ?? null);
            setCompletions(new Set((taskData.completions ?? []).map((c: { task_name: string }) => c.task_name)));
            const metaEntries = (taskData.metadata ?? []).map((m: TaskMeta & { task_name: string }) =>
                [m.task_name, { priority: m.priority, due_date: m.due_date, waiting_on: m.waiting_on, notes: m.notes }] as [string, TaskMeta]
            );
            setMetaMap(new Map(metaEntries));
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    const toggleTask = useCallback(async (taskName: string, category: string, currentlyDone: boolean) => {
        setSaving(taskName);
        const action = currentlyDone ? 'uncomplete' : 'complete';

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
                setCompletions(prev => {
                    const next = new Set(prev);
                    if (currentlyDone) next.add(taskName);
                    else next.delete(taskName);
                    return next;
                });
            }
        } catch {
            setCompletions(prev => {
                const next = new Set(prev);
                if (currentlyDone) next.add(taskName);
                else next.delete(taskName);
                return next;
            });
        }
        setSaving(null);
    }, []);

    const handleMetaSave = useCallback((taskName: string, meta: TaskMeta) => {
        setMetaMap(prev => {
            const next = new Map(prev);
            next.set(taskName, meta);
            return next;
        });
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
    const stack = buildPriorityStack(tasks, todayStr, completions, metaMap);

    const openTasks = stack.filter(t => !t.completed);
    const completedTasks = stack.filter(t => t.completed);

    // Group open tasks by urgency
    const overdue = openTasks.filter(t => t.urgency === 'overdue');
    const urgent = openTasks.filter(t => t.urgency === 'urgent');
    const thisWeek = openTasks.filter(t => t.urgency === 'this_week');
    const thisMonth = openTasks.filter(t => t.urgency === 'this_month');
    const waiting = openTasks.filter(t => t.urgency === 'waiting');
    const backlog = openTasks.filter(t => t.urgency === 'backlog' || t.urgency === 'someday');

    const chartData = (tasks.history ?? []).map(h => ({
        date: shortDate(h.date),
        'Pile Size': h.open,
        Completed: h.completed ?? 0,
        Added: h.added ?? 0,
    }));

    const renderTask = (t: ScoredTask) => {
        const meta = t.meta;
        return (
            <li key={t.name} className={`${styles.priorityItem} ${t.completed ? styles.priorityItemDone : ''}`}>
                <button
                    className={`${styles.taskCheck} ${t.completed ? styles.taskCheckDone : ''}`}
                    onClick={(e) => { e.stopPropagation(); toggleTask(t.name, t.category, t.completed); }}
                    disabled={saving === t.name}
                    title={t.completed ? 'Mark as incomplete' : 'Mark as complete'}
                >
                    {t.completed && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L4 7L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </button>
                <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setEditingTask(t)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span className={`${styles.priorityName} ${t.completed ? styles.priorityNameDone : ''}`}>{t.name}</span>
                    </div>
                    {/* Metadata indicators */}
                    {meta && (meta.waiting_on || meta.due_date || meta.notes) && (
                        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 2, flexWrap: 'wrap' }}>
                            {meta.waiting_on && (
                                <span className={styles.taskTag} style={{ color: '#c9a84c', borderColor: 'rgba(201,168,76,0.3)' }}>
                                    ⏳ {meta.waiting_on}
                                </span>
                            )}
                            {meta.due_date && (
                                <span className={styles.taskTag} style={{ color: 'var(--color-text-muted)' }}>
                                    📅 {shortDate(meta.due_date)}
                                </span>
                            )}
                        </div>
                    )}
                </div>
                <span className={styles.priorityCat} style={{ color: catColors[t.category] ?? 'var(--color-text-muted)' }}>{t.category}</span>
                {t.urgency === 'overdue' && !t.completed && <span className={styles.priorityDue} style={{ color: '#c07070' }}>{t.overdueDays}d late</span>}
                <span className={styles.kanbanEdit} onClick={() => setEditingTask(t)} style={{ cursor: 'pointer' }}>✎</span>
            </li>
        );
    };

    const renderSection = (
        items: ScoredTask[],
        label: string,
        dotColor: string,
        borderColor: string,
        labelColor?: string,
    ) => items.length > 0 ? (
        <div>
            <div className={styles.prioritySectionHeader} style={{ borderColor }}>
                <span className={styles.prioritySectionDot} style={{ background: dotColor }} />
                <span style={{ color: labelColor ?? 'var(--color-text-muted)' }}>{label}</span>
                <span className={styles.prioritySectionCount}>{items.length}</span>
            </div>
            <ul className={styles.priorityList}>{items.map(renderTask)}</ul>
        </div>
    ) : null;

    return (
        <DashboardShell>
            {editingTask && (
                <TaskEditModal
                    task={editingTask}
                    onClose={() => setEditingTask(null)}
                    onSave={handleMetaSave}
                />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                <div>
                    <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 'var(--space-1)' }}>The Pile</h2>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: 0, maxWidth: 'none' }}>
                        {openTasks.length} open · {completedTasks.length} done · Last synced {shortDate(tasks.updated_at)}
                    </p>
                </div>

                {/* Stats */}
                <div className={styles.statsStrip}>
                    {[
                        { label: 'Open', value: openTasks.length, color: '#c17f3a' },
                        { label: 'Done', value: completedTasks.length, color: '#6db86d' },
                        { label: 'Overdue', value: overdue.length, color: '#c07070' },
                        { label: 'Waiting', value: waiting.length, color: '#c9a84c' },
                    ].map(({ label, value, color }) => (
                        <div key={label} className={styles.statCard}>
                            <span className={styles.statValue} style={{ color }}>{value}</span>
                            <span className={styles.statLabel}>{label}</span>
                        </div>
                    ))}
                </div>

                {/* Chart */}
                {chartData.length >= 2 && (
                    <div className={styles.widget}>
                        <div className={styles.widgetHeader}>
                            <div className={styles.widgetTitle}><span className={styles.widgetIcon}>◉</span>Pile Trajectory</div>
                        </div>
                        <AreaChart data={chartData} xKey="date" height={180}
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

                    {renderSection(overdue, 'Overdue', '#c07070', 'rgba(192,112,112,0.4)', '#c07070')}
                    {renderSection(urgent, 'Urgent', '#c07070', 'rgba(192,112,112,0.3)', '#c07070')}
                    {renderSection(thisWeek, 'This Week', '#c9a84c', 'rgba(201,168,76,0.4)', '#c9a84c')}
                    {renderSection(thisMonth, 'This Month', '#5a7a8a', 'rgba(90,122,138,0.4)', '#5a7a8a')}
                    {renderSection(waiting, 'Waiting On', '#c9a84c', 'rgba(201,168,76,0.3)', '#c9a84c')}
                    {renderSection(backlog, 'Backlog', 'var(--color-border-strong)', 'var(--color-border)')}

                    {/* Completed (collapsible) */}
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
                            {showCompleted && <ul className={styles.priorityList}>{completedTasks.map(renderTask)}</ul>}
                        </div>
                    )}
                </div>
            </div>
        </DashboardShell>
    );
}
