'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { AreaChart } from '@/components/charts/Charts';
import DashboardShell from '../DashboardShell';
import styles from '../dashboard.module.css';

interface TasksData {
    updated_at: string; total_open: number; total_done: number;
    categories: Record<string, { open: number; done: number; tasks: string[]; overdue: { name: string; due: string }[] }>;
    overdue_tasks: { name: string; due: string; category: string }[];
    history: { date: string; open: number; done: number; completed?: number; added?: number; removed?: number }[];
}

interface TaskMeta {
    clickup_id?: string;
    clickup_status?: string;
    priority: string | null;
    due_date: string | null;
    waiting_on: string | null;
    notes: string | null;
    context: string | null;
    parent_task: string | null;
    location: string | null;
    url?: string;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    'to do': { label: 'To Do', color: '#5a7a8a', bg: 'rgba(90,122,138,0.12)' },
    'in progress': { label: 'In Progress', color: '#c9a84c', bg: 'rgba(201,168,76,0.12)' },
    'review': { label: 'Review', color: '#7a5a8a', bg: 'rgba(122,90,138,0.12)' },
    'complete': { label: 'Complete', color: '#5a9a5a', bg: 'rgba(90,154,90,0.12)' },
    'closed': { label: 'Closed', color: 'var(--color-text-muted)', bg: 'rgba(100,100,100,0.08)' },
};

const catColors: Record<string, string> = {
    Wedding: '#a07040', THA: '#7a5030', Home: '#8a7a5a',
    Fitness: '#5a8a5a', Finance: '#5a7a8a', Personal: '#7a5a8a', Dev: '#8a5a5a',
};

const priorityConfig: Record<string, { label: string; color: string; bg: string; score: number }> = {
    urgent: { label: 'Urgent', color: '#c07070', bg: 'rgba(192,112,112,0.12)', score: 900 },
    high: { label: 'High', color: '#c9a84c', bg: 'rgba(201,168,76,0.12)', score: 700 },
    normal: { label: 'Normal', color: '#5a7a8a', bg: 'rgba(90,122,138,0.12)', score: 400 },
    low: { label: 'Low', color: 'var(--color-text-muted)', bg: 'rgba(100,100,100,0.08)', score: 50 },
};

function shortDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

// ─── Scored Task ─────────────────────────────────────────────────────────────
interface ScoredTask {
    name: string;
    category: string;
    clickup_id: string | null;
    url: string | null;
    due: string | null;
    overdueDays: number;
    urgency: string;
    score: number;
    completed: boolean;
    meta: TaskMeta | null;
    completion: { completed_at: string; completed_by: string } | null;
    children: ScoredTask[];
}

function buildPriorityStack(
    tasks: TasksData,
    todayStr: string,
    completedSet: Set<string>,
    metaMap: Map<string, TaskMeta>,
    completionMap: Map<string, { completed_at: string; completed_by: string }>,
): ScoredTask[] {
    const today = new Date(todayStr + 'T00:00:00');
    const overdueMap = new Map(tasks.overdue_tasks?.map(t => [t.name, t]) ?? []);

    // Build flat list first
    const allTasks: ScoredTask[] = [];

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
                score = 10;
            } else if (overdueDays > 0 && !meta?.priority) {
                urgency = 'overdue';
                score = 1000 + overdueDays;
            } else if (meta?.priority && priorityConfig[meta.priority]) {
                urgency = meta.priority;
                score = priorityConfig[meta.priority].score;
                if (overdueDays > 0) score += 1000; // Overdue trumps
                if (overdueDays > 0) urgency = 'overdue';
                if (dueDate && overdueDays <= 0) {
                    const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    score += Math.max(0, 30 - daysUntil);
                }
            } else if (isOverdue) {
                urgency = 'overdue';
                score = 1000 + overdueDays;
            }

            allTasks.push({ name: taskName, category: cat, clickup_id: meta?.clickup_id ?? null, url: meta?.url ?? null, due: dueStr, overdueDays, urgency, score, completed: isCompleted, meta, completion: completionMap.get(taskName) ?? null, children: [] });
        }
    }

    // Include completed tasks that aren't in snapshot categories
    // (e.g. Done section tasks, pre-March completions)
    const taskNames = new Set(allTasks.map(t => t.name));
    for (const [name, comp] of completionMap.entries()) {
        if (!taskNames.has(name)) {
            const meta = metaMap.get(name) ?? null;
            allTasks.push({
                name: name,
                category: comp.completed_by === 'abandoned' ? 'Abandoned' : 'Completed',
                clickup_id: meta?.clickup_id ?? null,
                url: meta?.url ?? null,
                due: null,
                overdueDays: 0,
                urgency: 'completed',
                score: -1,
                completed: true,
                meta,
                completion: comp,
                children: [],
            });
        }
    }

    // Build parent→children tree
    const parentMap = new Map<string, ScoredTask[]>();
    for (const t of allTasks) {
        if (t.meta?.parent_task) {
            if (!parentMap.has(t.meta.parent_task)) parentMap.set(t.meta.parent_task, []);
            parentMap.get(t.meta.parent_task)!.push(t);
        }
    }
    allTasks.forEach(t => t.children = (parentMap.get(t.name) ?? []).sort((a, b) => b.score - a.score));

    // Build set of child names to filter from top level
    const childNames = new Set<string>();
    for (const t of allTasks) {
        if (t.meta?.parent_task) childNames.add(t.name);
    }

    // Filter out children from top-level (they'll be nested under parents)
    const topLevel = allTasks.filter(t => !childNames.has(t.name));
    topLevel.sort((a, b) => b.score - a.score);

    // Sort children within each parent by score
    for (const task of topLevel) {
        task.children.sort((a, b) => b.score - a.score);
    }

    return topLevel;
}

// ─── Task Edit Modal ─────────────────────────────────────────────────────────
function TaskEditModal({ task, allTaskNames, onClose, onSave, onDelete, onAbandon }: {
    task: ScoredTask;
    allTaskNames: string[];
    onClose: () => void;
    onSave: (taskName: string, meta: TaskMeta) => void;
    onDelete: (taskName: string) => void;
    onAbandon: (taskName: string, category: string) => void;
}) {
    const [taskName, setTaskName] = useState(task.name);
    const [priority, setPriority] = useState(task.meta?.priority ?? '');
    const [dueDate, setDueDate] = useState(task.meta?.due_date ?? '');
    const [waitingOn, setWaitingOn] = useState(task.meta?.waiting_on ?? '');
    const [notes, setNotes] = useState(task.meta?.notes ?? '');
    const [context, setContext] = useState(task.meta?.context ?? '');
    const [parentTask, setParentTask] = useState(task.meta?.parent_task ?? '');
    const [location, setLocation] = useState(task.meta?.location ?? '');
    const [clickupStatus, setClickupStatus] = useState(task.meta?.clickup_status ?? 'to do');
    const [completedAt, setCompletedAt] = useState(() => {
        if (task.completion?.completed_at) {
            return new Date(task.completion.completed_at).toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });
        }
        return '';
    });
    const [saving, setSaving] = useState(false);
    const [pendingAction, setPendingAction] = useState<{ type: 'delete' | 'abandon'; message: string } | null>(null);
    const isDone = task.completion != null;

    const handleSave = async () => {
        setSaving(true);
        try {
            const trimmedName = taskName.trim() || task.name;
            const nameChanged = trimmedName !== task.name;

            // Rename first if name changed
            if (nameChanged) {
                const renameRes = await fetch('/api/dashboard/tasks', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        task_name: task.name,
                        action: 'rename',
                        new_name: trimmedName,
                    }),
                });
                if (!renameRes.ok) {
                    const err = await renameRes.json();
                    console.error('Rename failed:', err.error);
                    setSaving(false);
                    return;
                }
            }

            const activeName = nameChanged ? trimmedName : task.name;
            const res = await fetch('/api/dashboard/tasks', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task_name: activeName,
                    action: 'update_metadata',
                    priority: priority || null,
                    due_date: dueDate || null,
                    waiting_on: waitingOn || null,
                    notes: notes || null,
                    context: context || null,
                    parent_task: parentTask || null,
                    location: location || null,
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                console.error('Save failed:', err.error);
                setSaving(false);
                return;
            }
            onSave(nameChanged ? trimmedName : task.name, {
                priority: priority || null,
                due_date: dueDate || null,
                waiting_on: waitingOn || null,
                notes: notes || null,
                context: context || null,
                parent_task: parentTask || null,
                location: location || null,
            });

            // If completed_at was changed, update it separately
            if (isDone && completedAt) {
                await fetch('/api/dashboard/tasks', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        task_name: activeName,
                        action: 'update_completed_at',
                        completed_at: completedAt,
                    }),
                });
            }

            onClose();
        } catch (e) {
            console.error('Save failed:', e);
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
                    </h3>
                    <button className={styles.modalClose} onClick={onClose}>✕</button>
                </div>

                {/* Task name (editable) */}
                <div className={styles.modalField}>
                    <label className={styles.modalLabel}>Task Name</label>
                    <input
                        type="text"
                        className={styles.modalInput}
                        value={taskName}
                        onChange={e => setTaskName(e.target.value)}
                        style={{ fontWeight: 600, fontSize: '14px' }}
                    />
                </div>

                {/* Priority picker */}
                <div className={styles.modalField}>
                    <label className={styles.modalLabel}>Priority</label>
                    <div className={styles.priorityPicker}>
                        {Object.entries(priorityConfig).map(([key, { label, color, bg }]) => (
                            <button
                                key={key}
                                className={`${styles.priorityChip} ${priority === key ? styles.priorityChipActive : ''}`}
                                style={{
                                    borderColor: priority === key ? color : undefined,
                                    background: priority === key ? bg : undefined,
                                }}
                                onClick={() => setPriority(priority === key ? '' : key)}
                            >
                                ⚑ {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ClickUp Status */}
                <div className={styles.modalField}>
                    <label className={styles.modalLabel}>Status</label>
                    <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                        {Object.entries(statusConfig).map(([key, { label, color, bg }]) => (
                            <button
                                key={key}
                                style={{
                                    padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                                    border: clickupStatus === key ? `2px solid ${color}` : '1px solid var(--color-border)',
                                    background: clickupStatus === key ? bg : 'transparent',
                                    color: clickupStatus === key ? color : 'var(--color-text-muted)',
                                    fontWeight: clickupStatus === key ? 700 : 500,
                                    fontSize: 'var(--text-xs)', cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                }}
                                onClick={async () => {
                                    setClickupStatus(key);
                                    // Immediately sync status to ClickUp
                                    try {
                                        await fetch('/api/dashboard/tasks', {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                task_name: task.name,
                                                action: 'set_status',
                                                clickup_status: key,
                                                clickup_id: task.clickup_id,
                                            }),
                                        });
                                    } catch { /* non-critical */ }
                                }}
                            >{label}</button>
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
                        placeholder="e.g. Waiting on Yari, Need quote first..."
                        value={waitingOn}
                        onChange={e => setWaitingOn(e.target.value)}
                    />
                </div>

                {/* Parent task / Plan */}
                <div className={styles.modalField}>
                    <label className={styles.modalLabel}>Part of (Parent Task / Plan)</label>
                    <select className={styles.modalInput} value={parentTask} onChange={e => setParentTask(e.target.value)}>
                        <option value="">— None (top-level task) —</option>
                        {allTaskNames.filter(n => n !== task.name).map(n => (
                            <option key={n} value={n}>{n}</option>
                        ))}
                    </select>
                </div>

                {/* Context / Notes area */}
                <div className={styles.modalField}>
                    <label className={styles.modalLabel}>Context &amp; Details</label>
                    <textarea
                        className={styles.modalInput}
                        rows={4}
                        placeholder="Add background context, links, planning notes..."
                        value={context}
                        onChange={e => setContext(e.target.value)}
                    />
                </div>

                {/* Location */}
                <div className={styles.modalField}>
                    <label className={styles.modalLabel}>Location</label>
                    <input
                        type="text"
                        className={styles.modalInput}
                        placeholder="e.g. Home, Office, Gym, Bunnings..."
                        value={location}
                        onChange={e => setLocation(e.target.value)}
                    />
                </div>

                {/* Quick notes */}
                <div className={styles.modalField}>
                    <label className={styles.modalLabel}>Quick Notes</label>
                    <input
                        type="text"
                        className={styles.modalInput}
                        placeholder="Short note..."
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                    />
                </div>

                {/* Completed at (only for done tasks) */}
                {isDone && (
                    <div className={styles.modalField}>
                        <label className={styles.modalLabel}>Completed On</label>
                        <input
                            type="date"
                            className={styles.modalInput}
                            value={completedAt}
                            onChange={e => setCompletedAt(e.target.value)}
                            style={{ color: '#5a9a5a' }}
                        />
                    </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 'var(--space-2)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
                    <button
                        style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(192,112,112,0.3)', background: 'rgba(192,112,112,0.08)', color: '#c07070', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer' }}
                        onClick={() => setPendingAction({ type: 'delete', message: `Delete "${task.name}"? This removes it permanently.` })}
                        disabled={saving}
                    >🗑 Delete</button>
                    <button
                        style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(201,168,76,0.3)', background: 'rgba(201,168,76,0.08)', color: '#c9a84c', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer' }}
                        onClick={() => setPendingAction({ type: 'abandon', message: `Abandon "${task.name}"? It will move to completed as abandoned.` })}
                        disabled={saving}
                    >🚫 Abandon</button>
                    <div style={{ flex: 1 }} />
                    <button className={styles.modalBtnSecondary} onClick={onClose}>Cancel</button>
                    <button className={styles.modalBtnPrimary} onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>

                {/* Inline confirmation dialog */}
                {pendingAction && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-lg)', zIndex: 10 }}>
                        <div style={{ background: 'var(--color-bg)', border: `1px solid ${pendingAction.type === 'delete' ? 'rgba(192,80,80,0.3)' : 'rgba(201,168,76,0.3)'}`, borderRadius: 'var(--radius-md)', padding: '16px 20px', maxWidth: 320, width: '90%' }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)', marginBottom: 8 }}>
                                {pendingAction.type === 'delete' ? 'Delete task?' : 'Abandon task?'}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5, marginBottom: 14 }}>
                                {pendingAction.message}
                            </div>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                <button onClick={() => setPendingAction(null)} style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                                <button
                                    onClick={async () => {
                                        setSaving(true);
                                        const action = pendingAction.type === 'delete' ? 'delete' : 'abandon';
                                        const body: Record<string, string> = { task_name: task.name, action };
                                        if (action === 'abandon') body.category = task.category;
                                        try {
                                            const res = await fetch('/api/dashboard/tasks', {
                                                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify(body),
                                            });
                                            if (res.ok) {
                                                if (action === 'delete') onDelete(task.name);
                                                else onAbandon(task.name, task.category);
                                                onClose();
                                            }
                                        } catch (e) { console.error(`${action} failed:`, e); }
                                        setSaving(false);
                                        setPendingAction(null);
                                    }}
                                    style={{
                                        padding: '6px 14px', borderRadius: 'var(--radius-sm)',
                                        border: `1px solid ${pendingAction.type === 'delete' ? 'rgba(192,80,80,0.3)' : 'rgba(201,168,76,0.3)'}`,
                                        background: pendingAction.type === 'delete' ? 'rgba(192,80,80,0.12)' : 'rgba(201,168,76,0.12)',
                                        color: pendingAction.type === 'delete' ? '#c05050' : '#c9a84c',
                                        fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                    }}
                                >{pendingAction.type === 'delete' ? 'Delete' : 'Abandon'}</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function TasksPage() {
    const [tasks, setTasks] = useState<TasksData | null>(null);
    const [completions, setCompletions] = useState<Set<string>>(new Set());
    const [completionMap, setCompletionMap] = useState<Map<string, { completed_at: string; completed_by: string }>>(new Map());
    const [metaMap, setMetaMap] = useState<Map<string, TaskMeta>>(new Map());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [showCompleted, setShowCompleted] = useState(false);
    const [editingTask, setEditingTask] = useState<ScoredTask | null>(null);
    const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'done' | 'overdue' | 'waiting'>('all');
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    useEffect(() => {
        Promise.all([
            fetch('/api/dashboard').then(r => r.json()),
            fetch('/api/dashboard/tasks').then(r => r.json()).catch(() => ({ completions: [], metadata: [] })),
        ]).then(([dashData, taskData]) => {
            setTasks(dashData.tasks ?? null);
            setCompletions(new Set((taskData.completions ?? []).map((c: { task_name: string }) => c.task_name)));
            setCompletionMap(new Map((taskData.completions ?? []).map((c: { task_name: string; completed_at: string; completed_by: string }) => [c.task_name, { completed_at: c.completed_at, completed_by: c.completed_by }])));
            const metaEntries = (taskData.metadata ?? []).map((m: TaskMeta & { task_name: string }) =>
                [m.task_name, { clickup_id: m.clickup_id, clickup_status: m.clickup_status, priority: m.priority, due_date: m.due_date, waiting_on: m.waiting_on, notes: m.notes, context: m.context, parent_task: m.parent_task, location: m.location ?? null, url: m.url }] as [string, TaskMeta]
            );
            setMetaMap(new Map(metaEntries));
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    const toggleTask = useCallback(async (taskName: string, category: string, currentlyDone: boolean, clickupId?: string | null) => {
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
                body: JSON.stringify({ task_name: taskName, category, action, clickup_id: clickupId }),
            });
            if (!res.ok) {
                showToast(`Failed to ${action}: ${taskName}`, 'error');
                setCompletions(prev => {
                    const next = new Set(prev);
                    if (currentlyDone) next.add(taskName);
                    else next.delete(taskName);
                    return next;
                });
            }
        } catch {
            showToast(`Network error — ${action} failed`, 'error');
            setCompletions(prev => {
                const next = new Set(prev);
                if (currentlyDone) next.add(taskName);
                else next.delete(taskName);
                return next;
            });
        }
        setSaving(null);
    }, [showToast]);

    const cyclePriority = useCallback(async (t: ScoredTask) => {
        const priorities = ['urgent', 'high', 'normal', 'low'];
        const currentIdx = priorities.indexOf(t.meta?.priority ?? '');
        const nextPriority = priorities[(currentIdx + 1) % priorities.length];
        // Optimistic update
        setMetaMap(prev => {
            const next = new Map(prev);
            const existing = prev.get(t.name);
            if (existing) next.set(t.name, { ...existing, priority: nextPriority });
            return next;
        });
        try {
            const res = await fetch('/api/dashboard/tasks', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ task_name: t.name, action: 'update_metadata', priority: nextPriority, clickup_id: t.clickup_id }),
            });
            if (!res.ok) showToast('Priority update failed', 'error');
        } catch {
            showToast('Network error — priority update failed', 'error');
        }
    }, [showToast]);

    const handleMetaSave = useCallback((taskName: string, meta: TaskMeta) => {
        setMetaMap(prev => {
            const next = new Map(prev);
            if (editingTask && editingTask.name !== taskName) {
                next.delete(editingTask.name);
                setCompletions(cp => {
                    if (cp.has(editingTask.name)) {
                        const nc = new Set(cp);
                        nc.delete(editingTask.name);
                        nc.add(taskName);
                        return nc;
                    }
                    return cp;
                });
                setTasks(prev => {
                    if (!prev) return prev;
                    const cats = { ...prev.categories };
                    for (const [cat, data] of Object.entries(cats)) {
                        const idx = data.tasks?.indexOf(editingTask.name) ?? -1;
                        if (idx >= 0) {
                            const newTasks = [...data.tasks];
                            newTasks[idx] = taskName;
                            cats[cat] = { ...data, tasks: newTasks };
                        }
                    }
                    return { ...prev, categories: cats };
                });
            }
            // Preserve clickup_id and url from the existing meta
            const existing = prev.get(editingTask?.name ?? taskName);
            next.set(taskName, { ...meta, clickup_id: existing?.clickup_id ?? meta.clickup_id, url: existing?.url ?? meta.url });
            return next;
        });
    }, [editingTask]);

    const toggleParent = useCallback((name: string) => {
        setExpandedParents(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name); else next.add(name);
            return next;
        });
    }, []);

    // Build all task names for the parent selector
    const allTaskNames = useMemo(() => {
        if (!tasks) return [];
        return Object.values(tasks.categories ?? {}).flatMap(c => c.tasks ?? []);
    }, [tasks]);

    if (loading) return (
        <DashboardShell>
            <div className={styles.skeletonContainer}>
                <div className={styles.skeletonHeader}>
                    <div className={styles.skeletonBar} style={{ height: 28, width: '35%' }} />
                    <div className={styles.skeletonBar} style={{ height: 14, width: '55%' }} />
                </div>
                <div className={styles.skeletonBar} style={{ height: 36, width: '100%', borderRadius: 'var(--radius-sm)' }} />
                <div className={styles.skeletonGrid}>
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className={styles.skeletonCard} style={{ padding: 'var(--space-3)', alignItems: 'center' }}>
                            <div className={styles.skeletonBar} style={{ height: 24, width: '60%' }} />
                            <div className={styles.skeletonBar} style={{ height: 10, width: '40%' }} />
                        </div>
                    ))}
                </div>
                <div className={styles.skeletonCard}>
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className={styles.skeletonRow}>
                            <div className={styles.skeletonCircle} style={{ width: 24, height: 24 }} />
                            <div className={styles.skeletonBar} style={{ height: 14, flex: 1 }} />
                            <div className={styles.skeletonBar} style={{ height: 12, width: 48 }} />
                        </div>
                    ))}
                </div>
            </div>
        </DashboardShell>
    );

    if (!tasks) return (
        <DashboardShell>
            <div className={styles.widget}><p className={styles.widgetNotice}>🔗 No task data yet. Data will appear after the next sync.</p></div>
        </DashboardShell>
    );

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });
    const stack = buildPriorityStack(tasks, todayStr, completions, metaMap, completionMap);

    // Apply search and category filters
    const searchLower = searchQuery.toLowerCase();
    const filterTask = (t: ScoredTask): boolean => {
        if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
        if (searchQuery && !t.name.toLowerCase().includes(searchLower)) return false;
        // Status filter
        if (statusFilter === 'open' && t.completed) return false;
        if (statusFilter === 'done' && !t.completed) return false;
        if (statusFilter === 'overdue' && t.urgency !== 'overdue') return false;
        if (statusFilter === 'waiting' && t.urgency !== 'waiting') return false;
        return true;
    };

    const filteredStack = stack.filter(filterTask);
    const openTasks = filteredStack.filter(t => t.urgency !== 'completed');
    const completedTasks = filteredStack.filter(t => t.urgency === 'completed');
    const categories = Object.keys(tasks.categories ?? {}).sort();

    // Group by urgency
    const overdue = openTasks.filter(t => t.urgency === 'overdue');
    const urgent = openTasks.filter(t => t.urgency === 'urgent');
    const high = openTasks.filter(t => t.urgency === 'high');
    const normal = openTasks.filter(t => t.urgency === 'normal');
    const waiting = openTasks.filter(t => t.urgency === 'waiting');
    const backlog = openTasks.filter(t => t.urgency === 'backlog');
    const low = openTasks.filter(t => t.urgency === 'low');

    const history = tasks.history ?? [];
    const chartData = history.map(h => ({
        date: shortDate(h.date),
        'Open pile': h.open,
        Completed: h.completed ?? 0,
        Added: h.added ?? 0,
        Removed: h.removed ?? 0,
    }));

    // ── Render a single task row ──
    const renderTaskRow = (t: ScoredTask, indent: number = 0) => {
        const meta = t.meta;
        const hasChildren = t.children.length > 0;
        const isExpanded = expandedParents.has(t.name);
        const priCfg = meta?.priority ? priorityConfig[meta.priority] : null;

        return (
            <div key={t.name}>
                <li
                    className={`${styles.priorityItem} ${t.completed ? styles.priorityItemDone : ''}`}
                    style={{ paddingLeft: `calc(var(--space-2) + ${indent * 24}px)` }}
                >
                    {/* Expand toggle for parents / spacer for alignment */}
                    {hasChildren ? (
                        <button
                            className={styles.subtaskToggle}
                            onClick={() => toggleParent(t.name)}
                            title={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
                        >
                            {isExpanded ? '▾' : '▸'}
                        </button>
                    ) : indent > 0 ? (
                        <span className={styles.subtaskLine}>└</span>
                    ) : (
                        <span style={{ width: 20, flexShrink: 0 }} />
                    )}

                    {/* Checkbox */}
                    <button
                        className={`${styles.taskCheck} ${t.completed ? styles.taskCheckDone : ''}`}
                        onClick={(e) => { e.stopPropagation(); toggleTask(t.name, t.category, t.completed, t.clickup_id); }}
                        disabled={saving === t.name}
                        title={t.completed ? 'Mark as incomplete' : 'Mark as complete'}
                    >
                        {t.completed && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L4 7L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </button>

                    {/* Name + metadata */}
                    <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setEditingTask(t)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <span className={`${styles.priorityName} ${t.completed ? styles.priorityNameDone : ''}`}>
                                {t.name}
                            </span>
                            {hasChildren && (() => {
                                const doneCount = t.children.filter(c => c.completed).length;
                                const totalCount = t.children.length;
                                const pct = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;
                                return (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                        <span className={styles.taskTag} style={{ color: 'var(--color-text-muted)', fontSize: 9 }}>
                                            {doneCount}/{totalCount}
                                        </span>
                                        <span style={{
                                            width: 36, height: 4, borderRadius: 2,
                                            background: 'rgba(255,255,255,0.06)', overflow: 'hidden', display: 'inline-block',
                                        }}>
                                            <span style={{
                                                width: `${pct}%`, height: '100%', display: 'block',
                                                borderRadius: 2, background: pct === 100 ? '#5a9a5a' : 'var(--accent-400)',
                                                transition: 'width 0.3s ease',
                                            }} />
                                        </span>
                                    </span>
                                );
                            })()}
                        </div>
                        {/* Tags row */}
                        {(meta?.waiting_on || meta?.due_date || meta?.parent_task || meta?.context || meta?.location || priCfg) && (
                            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                                {/* ClickUp-style priority flag */}
                                {priCfg && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); cyclePriority(t); }}
                                        style={{
                                            background: priCfg.bg, border: 'none', cursor: 'pointer',
                                            padding: '1px 6px', borderRadius: 'var(--radius-sm)',
                                            fontSize: 9, fontWeight: 600, color: priCfg.color,
                                            textTransform: 'uppercase', letterSpacing: '0.03em',
                                            display: 'inline-flex', alignItems: 'center', gap: 3,
                                            transition: 'opacity 0.15s ease',
                                        }}
                                        title={`Priority: ${priCfg.label} — click to cycle`}
                                    >
                                        <span style={{ fontSize: 10 }}>⚑</span> {priCfg.label}
                                    </button>
                                )}
                                {meta?.waiting_on && (
                                    <span className={styles.taskTag} style={{ color: '#c9a84c', borderColor: 'rgba(201,168,76,0.3)' }}>
                                        ⏳ {meta.waiting_on}
                                    </span>
                                )}
                                {meta?.due_date && (
                                    <span className={styles.taskTag} style={{ color: 'var(--color-text-muted)' }}>
                                        📅 {shortDate(meta.due_date)}
                                    </span>
                                )}
                                {indent === 0 && meta?.parent_task && (
                                    <span className={styles.taskTag} style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                                        ↳ {meta.parent_task}
                                    </span>
                                )}
                                {meta?.context && (
                                    <span className={styles.taskTag} style={{ color: 'var(--color-text-muted)' }} title={meta.context}>
                                        📋
                                    </span>
                                )}
                                {meta?.location && (
                                    <span className={styles.taskTag} style={{ color: 'var(--color-text-muted)' }} title={meta.location}>
                                        📍 {meta.location}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Category label + Status badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
                        {(() => {
                            const st = meta?.clickup_status ?? 'to do';
                            const cfg = statusConfig[st];
                            return cfg ? (
                                <span style={{
                                    fontSize: 9, padding: '1px 6px', borderRadius: 'var(--radius-sm)',
                                    background: cfg.bg, color: cfg.color, fontWeight: 600,
                                    textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap',
                                }}>{cfg.label}</span>
                            ) : null;
                        })()}
                        <span className={styles.priorityCat} style={{ color: catColors[t.category] ?? 'var(--color-text-muted)' }}>{t.category}</span>
                    </div>

                    {/* Urgency indicator */}
                    {t.urgency === 'overdue' && !t.completed && <span className={styles.priorityDue} style={{ color: '#c07070' }}>{t.overdueDays}d late</span>}

                    {/* ClickUp link */}
                    {t.url && (
                        <a
                            href={t.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className={styles.taskTag}
                            style={{ color: 'var(--color-text-muted)', textDecoration: 'none', fontSize: 11, opacity: 0.6 }}
                            title="Open in ClickUp"
                        >↗</a>
                    )}

                    {/* Edit button */}
                    <span className={styles.kanbanEdit} onClick={() => setEditingTask(t)} style={{ cursor: 'pointer' }}>✎</span>
                </li>

                {/* Render children if expanded */}
                {hasChildren && isExpanded && t.children.map(child => renderTaskRow(child, indent + 1))}
            </div>
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
            <ul className={styles.priorityList}>{items.map(t => renderTaskRow(t))}</ul>
        </div>
    ) : null;

    return (
        <DashboardShell>
            {editingTask && (
                <TaskEditModal
                    task={editingTask}
                    allTaskNames={allTaskNames}
                    onClose={() => setEditingTask(null)}
                    onSave={handleMetaSave}
                    onDelete={(taskName) => {
                        // Remove from local state
                        setTasks(prev => {
                            if (!prev) return prev;
                            const cats = { ...prev.categories };
                            for (const [cat, data] of Object.entries(cats)) {
                                const idx = data.tasks?.indexOf(taskName) ?? -1;
                                if (idx >= 0) {
                                    const newTasks = [...data.tasks];
                                    newTasks.splice(idx, 1);
                                    cats[cat] = { ...data, tasks: newTasks, open: Math.max(0, (data.open ?? 0) - 1) };
                                }
                            }
                            return { ...prev, categories: cats, total_open: Math.max(0, prev.total_open - 1) };
                        });
                        setCompletions(prev => { const n = new Set(prev); n.delete(taskName); return n; });
                        setMetaMap(prev => { const n = new Map(prev); n.delete(taskName); return n; });
                    }}
                    onAbandon={(taskName) => {
                        // Move to completed
                        setCompletions(prev => { const n = new Set(prev); n.add(taskName); return n; });
                    }}
                />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                <div>
                    <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 'var(--space-1)' }}>The Pile</h2>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: 0, maxWidth: 'none' }}>
                        {openTasks.length} open · {completedTasks.length} done · <span style={{ color: '#5a9a5a' }}>● Live</span>
                    </p>
                </div>



                {/* Search + Category Filter */}
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                        type="text"
                        className={styles.modalInput}
                        placeholder="🔍 Search tasks…"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ flex: 1, minWidth: 180, fontSize: 'var(--text-sm)', padding: '6px 10px' }}
                    />
                    <select
                        className={styles.modalInput}
                        value={categoryFilter}
                        onChange={e => setCategoryFilter(e.target.value)}
                        style={{ width: 'auto', fontSize: 'var(--text-sm)', padding: '6px 8px' }}
                    >
                        <option value="all">All Categories</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>

                {/* Add Task */}
                <form
                    style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}
                    onSubmit={async (e) => {
                        e.preventDefault();
                        const form = e.currentTarget;
                        const nameInput = form.elements.namedItem('newTaskName') as HTMLInputElement;
                        const catSelect = form.elements.namedItem('newTaskCat') as HTMLSelectElement;
                        const name = nameInput.value.trim();
                        const cat = catSelect.value;
                        if (!name || !cat) return;
                        nameInput.disabled = true;
                        try {
                            const res = await fetch('/api/dashboard/tasks', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ task_name: name, category: cat, action: 'add' }),
                            });
                            if (!res.ok) {
                                const err = await res.json();
                                showToast(`Add failed: ${err.error}`, 'error');
                            } else {
                                // Update local state
                                setTasks(prev => {
                                    if (!prev) return prev;
                                    const cats = { ...prev.categories };
                                    if (!cats[cat]) cats[cat] = { tasks: [], open: 0, done: 0, overdue: [] };
                                    cats[cat] = { ...cats[cat], tasks: [...(cats[cat].tasks ?? []), name], open: (cats[cat].open ?? 0) + 1 };
                                    return { ...prev, categories: cats, total_open: prev.total_open + 1 };
                                });
                                nameInput.value = '';
                            }
                        } catch (err) {
                            showToast(`Add failed: ${err}`, 'error');
                        }
                        nameInput.disabled = false;
                        nameInput.focus();
                    }}
                >
                    <input
                        name="newTaskName"
                        type="text"
                        className={styles.modalInput}
                        placeholder="New task name…"
                        style={{ flex: 1, fontSize: 'var(--text-sm)', padding: '6px 10px' }}
                        required
                    />
                    <select name="newTaskCat" className={styles.modalInput} style={{ width: 'auto', fontSize: 'var(--text-sm)', padding: '6px 8px' }} required>
                        {Object.keys(catColors).map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                    <button
                        type="submit"
                        className={styles.modalBtnPrimary}
                        style={{ padding: '6px 14px', fontSize: 'var(--text-sm)', whiteSpace: 'nowrap' }}
                    >+ Add</button>
                </form>

                {/* Stats */}
                <div className={styles.statsStrip}>
                    {[
                        { label: 'Open', value: openTasks.length, color: '#c17f3a', filter: 'open' as const },
                        { label: 'Done', value: completedTasks.length, color: '#6db86d', filter: 'done' as const },
                        { label: 'Overdue', value: overdue.length, color: '#c07070', filter: 'overdue' as const },
                        { label: 'Waiting', value: waiting.length, color: '#c9a84c', filter: 'waiting' as const },
                    ].map(({ label, value, color, filter }) => {
                        const isActive = statusFilter === filter;
                        return (
                            <div
                                key={label}
                                className={styles.statCard}
                                onClick={() => setStatusFilter(isActive ? 'all' : filter)}
                                style={{
                                    cursor: 'pointer',
                                    border: isActive ? `2px solid ${color}` : undefined,
                                    background: isActive ? `${color}12` : undefined,
                                    transition: 'all 0.15s ease',
                                }}
                            >
                                <span className={styles.statValue} style={{ color }}>{value}</span>
                                <span className={styles.statLabel}>{label}</span>
                            </div>
                        );
                    })}
                </div>

                {/* Chart */}
                {chartData.length >= 2 && (
                    <div className={styles.widget}>
                        <div className={styles.widgetHeader}>
                            <div className={styles.widgetTitle}><span className={styles.widgetIcon}>◉</span>Pile Trajectory</div>
                        </div>
                        <AreaChart data={chartData} xKey="date" height={180}
                            areas={[
                                { key: 'Open pile', color: '#c17f3a', name: 'Open pile' },
                                { key: 'Completed', color: '#5a9a5a', name: 'Completed' },
                                { key: 'Added', color: '#c07070', name: 'Added' },
                                { key: 'Removed', color: '#8a6daa', name: 'Removed' },
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
                    {renderSection(high, 'High', '#c9a84c', 'rgba(201,168,76,0.4)', '#c9a84c')}
                    {renderSection(normal, 'Normal', '#5a7a8a', 'rgba(90,122,138,0.4)', '#5a7a8a')}
                    {renderSection(waiting, 'Waiting On', '#c9a84c', 'rgba(201,168,76,0.3)', '#c9a84c')}
                    {renderSection(backlog, 'Backlog', 'var(--color-border-strong)', 'var(--color-border)')}
                    {renderSection(low, 'Low', 'var(--color-text-muted)', 'var(--color-border)', 'var(--color-text-muted)')}

                    {/* Completed */}
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
                            {showCompleted && <ul className={styles.priorityList}>{completedTasks.map(t => renderTaskRow(t))}</ul>}
                        </div>
                    )}
                </div>
            </div>
            {/* Toast notification */}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
                    padding: '10px 20px', borderRadius: 'var(--radius-md)',
                    background: toast.type === 'error' ? 'rgba(192,112,112,0.95)' : 'rgba(90,154,90,0.95)',
                    color: '#fff', fontSize: 'var(--text-sm)', fontWeight: 600,
                    zIndex: 9999, backdropFilter: 'blur(8px)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    animation: 'fadeIn 0.2s ease',
                }}>{toast.type === 'error' ? '✗ ' : '✓ '}{toast.message}</div>
            )}
        </DashboardShell>
    );
}
