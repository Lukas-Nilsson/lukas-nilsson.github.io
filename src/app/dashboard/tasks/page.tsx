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

// Batch clusters from OpenClaw
const clusters: Record<string, string[]> = {
    '🚗 Out & About': ['Renew passport', 'Return AirPods', 'MacBook screen repair', 'Pick up iPad', "Return Shelly's shoes", "Get learner's licence", 'MMA intro PT session', "Paint Grandma Penny's fence", 'Surprise Yari with a pedicure date'],
    '💻 Online': ['Book flights', 'Wedding soundtrack', 'Build content pipeline', 'Check if Yari can get a credit card', 'Monitor Bitcoin', 'Email Grandma Penny', 'Apple Photos', 'Apple Pencil', 'Keep developing Clukas', 'Send THA newsletter'],
    '🏠 At Home': ['Get apartment sorted', 'Finish building the cabinet', 'Set up outdoor space', 'Buy self-cleaning cat litter', 'Develop museum/simbox'],
    '⚡ Quick Wins': ['Pay bills/tickets', 'Send tax info to accountant', 'Email Grandma Penny', 'Follow up with Brett', 'Double date'],
};

function shortDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

export default function TasksPage() {
    const [tasks, setTasks] = useState<TasksData | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedCat, setExpandedCat] = useState<string | null>(null);
    const [expandedCluster, setExpandedCluster] = useState<string | null>(null);

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
            <div className={styles.widget}><p className={styles.widgetNotice}>🔗 No task data yet. Run OpenClaw sync to populate.</p></div>
        </DashboardShell>
    );

    const allTasks = Object.values(tasks.categories ?? {}).flatMap(c => c.tasks ?? []);

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
                        Last synced: {shortDate(tasks.updated_at)}
                    </p>
                </div>

                <div className={styles.statsStrip}>
                    {[
                        { label: 'Open', value: tasks.total_open, color: '#c17f3a' },
                        { label: 'Done', value: tasks.total_done, color: '#6db86d' },
                        { label: 'Overdue', value: tasks.overdue_tasks?.length ?? 0, color: '#c07070' },
                        { label: 'Categories', value: Object.keys(tasks.categories ?? {}).length, color: 'var(--color-text)' },
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
                            height={200}
                            areas={[
                                { key: 'Pile Size', color: '#c17f3a', name: 'Open pile' },
                                { key: 'Completed', color: '#5a9a5a', name: 'Completed' },
                                { key: 'Added', color: '#c07070', name: 'Added' },
                            ]}
                        />
                    </div>
                )}

                {tasks.overdue_tasks?.length > 0 && (
                    <div className={styles.widget}>
                        <div className={styles.widgetHeader}>
                            <div className={styles.widgetTitle}><span className={styles.widgetIcon} style={{ color: '#c07070' }}>⚠</span>Overdue</div>
                            <span className={styles.widgetBadge}>{tasks.overdue_tasks.length} items</span>
                        </div>
                        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                            {tasks.overdue_tasks.map(t => (
                                <li key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) 0', borderBottom: '1px solid var(--color-border)' }}>
                                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#c07070', flexShrink: 0 }} />
                                    <span style={{ flex: 1, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>{t.name}</span>
                                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{t.category} · due {t.due}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* By category */}
                <div className={styles.widget}>
                    <div className={styles.widgetHeader}>
                        <div className={styles.widgetTitle}><span className={styles.widgetIcon}>◇</span>By Category</div>
                    </div>
                    {Object.entries(tasks.categories ?? {}).sort((a, b) => b[1].open - a[1].open).map(([cat, { open, tasks: subtasks, overdue }]) => (
                        <div key={cat}>
                            <button
                                onClick={() => setExpandedCat(expandedCat === cat ? null : cat)}
                                style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', width: '100%', background: 'none', border: 'none', padding: 'var(--space-3) 0', cursor: 'pointer', fontFamily: 'var(--font-body)', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}
                            >
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: catColors[cat] ?? '#7a7a7a', flexShrink: 0 }} />
                                <span style={{ flex: 1, fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)' }}>{cat}</span>
                                {overdue?.length > 0 && <span style={{ fontSize: 'var(--text-xs)', color: '#c07070', fontWeight: 600 }}>⚠ {overdue.length} overdue</span>}
                                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{open} open {expandedCat === cat ? '▴' : '▾'}</span>
                            </button>
                            {expandedCat === cat && (
                                <ul style={{ listStyle: 'none', borderLeft: `2px solid ${catColors[cat] ?? '#7a7a7a'}44`, marginLeft: 'var(--space-2)', paddingLeft: 'var(--space-4)', paddingTop: 'var(--space-2)', paddingBottom: 'var(--space-3)' }}>
                                    {subtasks?.map(t => {
                                        const isOverdue = overdue?.some(o => o.name === t);
                                        return (
                                            <li key={t} style={{ fontSize: 'var(--text-xs)', color: isOverdue ? '#c07070' : 'var(--color-text-secondary)', padding: '4px 0', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                                <span style={{ color: 'var(--color-text-muted)' }}>→</span> {t}
                                                {isOverdue && <span style={{ marginLeft: 'auto', fontSize: 10, color: '#c07070', fontWeight: 600 }}>OVERDUE</span>}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    ))}
                </div>

                <div className={styles.widget}>
                    <div className={styles.widgetHeader}>
                        <div className={styles.widgetTitle}><span className={styles.widgetIcon}>◆</span>Batch It</div>
                        <span className={styles.widgetBadge}>Group by context</span>
                    </div>
                    {Object.entries(clusters).map(([title, clusterTasks]) => {
                        const matched = clusterTasks.filter(ct => allTasks.some(t => t.toLowerCase().includes(ct.toLowerCase().slice(0, 20))));
                        if (!matched.length) return null;
                        return (
                            <div key={title}>
                                <button
                                    onClick={() => setExpandedCluster(expandedCluster === title ? null : title)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', width: '100%', background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 'var(--space-3) var(--space-4)', cursor: 'pointer', fontFamily: 'var(--font-body)', textAlign: 'left', marginBottom: 'var(--space-2)' }}
                                >
                                    <span style={{ flex: 1, fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)' }}>{title}</span>
                                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{matched.length} tasks {expandedCluster === title ? '▴' : '▾'}</span>
                                </button>
                                {expandedCluster === title && (
                                    <ul style={{ listStyle: 'none', paddingLeft: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
                                        {matched.map(t => <li key={t} style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text)', padding: '3px 0' }}>→ {t}</li>)}
                                    </ul>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </DashboardShell>
    );
}
