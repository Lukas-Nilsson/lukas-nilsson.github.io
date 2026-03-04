'use client';

import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AreaChart, BarChart, LineChart } from '@/components/charts/Charts';
import styles from './dashboard.module.css';

interface Props { user: User; }

interface DashboardData {
    whoop: { date: string; recovery: number; hrv: number; rhr: number; strain: number; sleep_hours: number; sleep_performance: number } | null;
    whoopHistory: { date: string; recovery: number; hrv: number; strain: number; sleep_hours: number; sleep_performance: number }[];
    hard75: { date: string; day: number; days_completed: number; today_complete: boolean; checks: Record<string, { done: boolean; time: string | null }>; finish_confidence: number } | null;
    hard75History: { date: string; day: number; days_completed: number; today_complete: boolean; checks: Record<string, { done: boolean; time: string | null }>; finish_confidence: number; discipline_score: number }[];
    tasks: {
        updated_at: string; total_open: number; total_done: number;
        categories: Record<string, { open: number; done: number; tasks: string[]; overdue: { name: string; due: string }[] }>;
        overdue_tasks: { name: string; due: string; category: string }[];
        history: { date: string; open: number; done: number; completed?: number; added?: number }[];
    } | null;
    sleep: { date: string; performance: number; hours_in_bed: number; deep: number; rem: number; light: number }[];
    lastSynced: string | null;
    todayAEST: string;  // YYYY-MM-DD in Australia/Melbourne — used to detect stale Whoop data
}

const checkDefs = [
    { key: 'workout1', icon: '🏃', label: 'Outdoor Workout' },
    { key: 'workout2', icon: '💪', label: '2nd Workout' },
    { key: 'water', icon: '💧', label: 'Gallon Water' },
    { key: 'diet', icon: '🥗', label: 'Whole Foods Diet' },
    { key: 'reading', icon: '📖', label: '10 Pages' },
    { key: 'teeth', icon: '🦷', label: 'Brush Teeth' },
    { key: 'bedtime', icon: '🛌', label: 'In Bed by 11pm' },
];

const catColors: Record<string, string> = {
    Wedding: '#a07040', THA: '#7a5030', Home: '#8a7a5a',
    Fitness: '#5a8a5a', Finance: '#5a7a8a', Personal: '#7a5a8a', Dev: '#8a5a5a',
};

function fmt(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
}

function shortDate(dateStr: string) {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

// ─── Whoop Widget ─────────────────────────────────────────────────────────────
function WhoopWidget({ data, todayAEST, selectedDate }: { data: DashboardData['whoopHistory'][0] | null; todayAEST: string; selectedDate: string }) {
    if (!data) return <EmptyWidget icon="◎" title="Whoop" message={selectedDate === todayAEST ? "No Whoop data for today yet." : `No Whoop data found for ${selectedDate}.`} />;

    const isToday = selectedDate === todayAEST;
    // We only trust the data if it actually matches the selected date
    const dateMatch = data.date === selectedDate;

    // Whoop recovery color logic
    const recoveryColor = (data.recovery ?? 0) >= 67 ? '#6db86d' : (data.recovery ?? 0) >= 34 ? '#c9a84c' : '#c07070';

    const stats = [
        {
            label: 'Recovery',
            value: dateMatch && data.recovery ? `${data.recovery}%` : '—',
            color: dateMatch ? recoveryColor : 'var(--color-text-muted)',
            sub: dateMatch && data.recovery ? (data.recovery >= 67 ? 'Good' : data.recovery >= 34 ? 'Moderate' : 'Low') : 'No data'
        },
        {
            label: 'Strain',
            value: dateMatch && data.strain ? data.strain.toFixed(1) : '—',
            color: 'var(--accent-400)',
            sub: isToday ? 'Today' : 'Total'
        },
        {
            label: 'Sleep',
            value: dateMatch && data.sleep_hours ? `${data.sleep_hours}h` : '—',
            color: 'var(--accent-300)',
            sub: dateMatch && data.sleep_performance ? `${data.sleep_performance}% perf` : '—'
        },
        {
            label: 'HRV',
            value: dateMatch && data.hrv ? `${data.hrv} ms` : '—',
            color: '#7aaac9',
            sub: isToday || dateMatch ? 'Heart Rate Var.' : '—'
        },
    ];

    return (
        <div className={styles.widget}>
            <div className={styles.widgetHeader}>
                <div className={styles.widgetTitle}><span className={styles.widgetIcon}>◎</span>Whoop</div>
                <span className={styles.widgetBadge}>
                    {isToday ? 'Current Status' : `Data for ${fmt(selectedDate)}`}
                    {!dateMatch && isToday && <span style={{ marginLeft: 4, color: '#c07070' }}> (not synced)</span>}
                </span>
            </div>
            <div className={styles.whoopGrid}>
                {stats.map(({ label, value, color, sub }) => (
                    <div key={label} className={styles.whoopStat}>
                        <span className={styles.whoopValue} style={{ color }}>{value}</span>
                        <span className={styles.whoopLabel}>{label}</span>
                        <span className={styles.whoopSub}>{sub}</span>
                    </div>
                ))}
            </div>
            {isToday && !dateMatch && (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', maxWidth: 'none', marginTop: 'var(--space-2)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-2)' }}>
                    Run <code>regenerate.sh</code> once today’s recovery is processed by Whoop.
                </p>
            )}
        </div>
    );
}

// ─── Sleep Chart Widget ───────────────────────────────────────────────────────
function SleepChartWidget({ data }: { data: DashboardData['sleep'] }) {
    if (!data.length) return <EmptyWidget icon="◑" title="Sleep" message="Run OpenClaw sync to see sleep history." />;
    const chartData = data.map(s => ({
        date: shortDate(s.date),
        'Quality %': s.performance,
        'Deep': s.deep,
        'REM': s.rem,
        'Light': s.light,
    }));
    return (
        <div className={styles.widget}>
            <div className={styles.widgetHeader}>
                <div className={styles.widgetTitle}><span className={styles.widgetIcon}>◑</span>Sleep</div>
                <span className={styles.widgetBadge}>Last {data.length} nights</span>
            </div>
            <div style={{ marginBottom: 'var(--space-2)' }}>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)', maxWidth: 'none' }}>Sleep quality %</p>
                <LineChart
                    data={chartData}
                    xKey="date"
                    height={120}
                    lines={[{ key: 'Quality %', color: '#7aaac9', name: 'Quality' }]}
                    yDomain={[0, 100]}
                    unit="%"
                />
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)', maxWidth: 'none' }}>Sleep stages (hours)</p>
            <BarChart
                data={chartData}
                xKey="date"
                height={120}
                bars={[
                    { key: 'Deep', color: '#3d5c8a', name: 'Deep' },
                    { key: 'REM', color: '#7a5a8a', name: 'REM' },
                    { key: 'Light', color: '#5a7a5a', name: 'Light' },
                ]}
                unit="h"
            />
        </div>
    );
}

// ─── Pile Trajectory Widget ───────────────────────────────────────────────────
function PileTrajectoryWidget({ data, selectedDate }: { data: DashboardData['tasks']; selectedDate: string }) {
    if (!data?.history?.length) return null;
    const chartData = data.history.map(h => ({
        date: shortDate(h.date),
        'Open pile': h.open,
        'Completed': h.completed ?? 0,
        'Added': h.added ?? 0,
        isHighlight: h.date === selectedDate,
    }));
    return (
        <div className={styles.widget}>
            <div className={styles.widgetHeader}>
                <div className={styles.widgetTitle}><span className={styles.widgetIcon}>◈</span>Pile Trajectory</div>
                <span className={styles.widgetBadge}>{data.total_open} open · {data.total_done} done</span>
            </div>
            <AreaChart
                data={chartData}
                xKey="date"
                height={180}
                areas={[
                    { key: 'Open pile', color: '#c17f3a', name: 'Open pile' },
                    { key: 'Completed', color: '#5a9a5a', name: 'Completed' },
                    { key: 'Added', color: '#c07070', name: 'Added' },
                ]}
            />
        </div>
    );
}

// ─── Habits Widget ───────────────────────────────────────────────────────────
function HabitsWidget({ data }: { data: DashboardData['hard75History'][0] | null }) {
    if (!data) return <EmptyWidget icon="◈" title="Habits" message="No habit data found for this day." />;

    const doneCount = checkDefs.filter(c => data.checks?.[c.key]?.done).length;
    const pct = Math.round((doneCount / checkDefs.length) * 100);

    return (
        <div className={styles.widget}>
            <div className={styles.widgetHeader}>
                <div className={styles.widgetTitle}><span className={styles.widgetIcon}>◈</span>Habits</div>
                <span className={styles.widgetBadge}>{data.today_complete ? '✓ Success' : '× Incomplete'}</span>
            </div>

            <div className={styles.habitProgress}>
                <div className={styles.habitBar} style={{ width: `${pct}%`, background: pct === 100 ? '#5a9a5a' : 'linear-gradient(90deg, var(--accent-500), var(--accent-300))' }} />
            </div>

            <ul className={styles.habitList}>
                {checkDefs.map(({ key, icon, label }) => {
                    const item = data.checks?.[key];
                    const done = item?.done ?? false;
                    return (
                        <li key={key} className={styles.habitItem}>
                            <div className={`${styles.habitCheck} ${done ? styles.habitDone : ''}`}>
                                {done && <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
                                    <path d="M1 4L4 7L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>}
                            </div>
                            <span className={`${styles.habitName} ${done ? styles.habitNameDone : ''}`}>{icon} {label}</span>
                            {item?.time && <span className={styles.streak}>{item.time}</span>}
                        </li>
                    );
                })}
            </ul>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
                <span>{doneCount}/{checkDefs.length} done · {data.day != null ? `Day ${data.day}` : 'Pre-challenge'}</span>
                <span>Confidence: <strong style={{ color: (data.finish_confidence ?? 0) >= 80 ? '#6db86d' : '#c9a84c' }}>{data.finish_confidence != null ? `${data.finish_confidence}%` : '—'}</strong></span>
            </div>
        </div>
    );
}

// ─── Tasks Widget ──────────────────────────────────────────────────────────────
function TasksWidget({ data }: { data: DashboardData['tasks'] }) {
    const [expanded, setExpanded] = useState<string | null>(null);
    if (!data) return <EmptyWidget icon="◇" title="The Pile" message="Run OpenClaw sync to see task data." />;

    const cats = Object.entries(data.categories ?? {}).sort((a, b) => b[1].open - a[1].open);

    return (
        <div className={styles.widget}>
            <div className={styles.widgetHeader}>
                <div className={styles.widgetTitle}><span className={styles.widgetIcon}>◇</span>The Pile</div>
                <span className={styles.widgetBadge}>{data.total_open} open</span>
            </div>

            {data.overdue_tasks?.length > 0 && (
                <div style={{ background: 'rgba(192,112,112,0.1)', border: '1px solid rgba(192,112,112,0.2)', borderRadius: 'var(--radius)', padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-3)' }}>
                    <p style={{ fontSize: 'var(--text-xs)', color: '#c07070', fontWeight: 700, marginBottom: 'var(--space-1)', maxWidth: 'none' }}>⚠ {data.overdue_tasks.length} overdue</p>
                    {data.overdue_tasks.map(t => (
                        <p key={t.name} style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', maxWidth: 'none', margin: '2px 0' }}>
                            {t.name} <span style={{ color: 'var(--color-text-muted)' }}>· {t.category} · due {t.due}</span>
                        </p>
                    ))}
                </div>
            )}

            <ul className={styles.taskList}>
                {cats.map(([cat, { open, tasks }]) => (
                    <li key={cat} style={{ listStyle: 'none' }}>
                        <button
                            className={styles.taskCatBtn}
                            onClick={() => setExpanded(expanded === cat ? null : cat)}
                            style={{ '--cat-color': catColors[cat] ?? '#7a7a7a' } as React.CSSProperties}
                        >
                            <div className={styles.priorityDot} style={{ background: catColors[cat] ?? '#7a7a7a' }} />
                            <span className={styles.taskTitle}>{cat}</span>
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>{open} ›</span>
                        </button>
                        {expanded === cat && tasks?.length > 0 && (
                            <ul style={{ listStyle: 'none', borderLeft: `2px solid ${catColors[cat] ?? '#7a7a7a'}33`, marginLeft: 'var(--space-4)', paddingLeft: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                                {tasks.map(t => (
                                    <li key={t} style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', padding: '3px 0', borderBottom: '1px solid var(--color-border)' }}>→ {t}</li>
                                ))}
                            </ul>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyWidget({ icon, title, message }: { icon: string; title: string; message: string }) {
    return (
        <div className={styles.widget}>
            <div className={styles.widgetHeader}>
                <div className={styles.widgetTitle}><span className={styles.widgetIcon}>{icon}</span>{title}</div>
                <span className={styles.widgetBadge}>No data</span>
            </div>
            <p className={styles.widgetNotice}>{message}</p>
        </div>
    );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function DashboardClient({ user }: Props) {
    const router = useRouter();
    const supabase = createClient();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    // null = not yet loaded; number = index into hard75History
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

    useEffect(() => {
        fetch('/api/dashboard')
            .then(r => r.json())
            .then(d => {
                setData(d);
                setLoading(false);
                // Default to most recent day
                if (d.hard75History?.length) {
                    setSelectedIdx(d.hard75History.length - 1);
                }
            })
            .catch(() => setLoading(false));
    }, []);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/');
        router.refresh();
    };

    const today = new Date();
    const greeting = today.getHours() < 12 ? 'Good morning' : today.getHours() < 17 ? 'Good afternoon' : 'Good evening';

    const lastSyncedLabel = data?.lastSynced
        ? `Synced ${new Date(data.lastSynced).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })} at ${new Date(data.lastSynced).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}`
        : 'Not yet synced';

    return (
        <div className={styles.shell}>
            {/* Sidebar */}
            <aside className={styles.sidebar}>
                <div className={styles.sidebarLogo}>
                    <div className={styles.logoMark}>LN</div>
                </div>
                <nav className={styles.sidebarNav}>
                    {[
                        { icon: '◉', label: 'Overview', href: '/dashboard', active: true },
                        { icon: '◎', label: 'Health', href: '/dashboard/health' },
                        { icon: '◈', label: 'Habits', href: '/dashboard/habits' },
                        { icon: '◇', label: 'Tasks', href: '/dashboard/tasks' },
                        { icon: '⬡', label: '75 Hard', href: '/dashboard/75-hard' },
                    ].map(({ icon, label, href, active }) => (
                        <a key={href} href={href} className={`${styles.navLink} ${active ? styles.navActive : ''}`}>
                            <span className={styles.navIcon}>{icon}</span>
                            <span className={styles.navLabel}>{label}</span>
                        </a>
                    ))}
                </nav>
                <div className={styles.sidebarFooter}>
                    <a href="/" className={styles.siteLink}>← Public site</a>
                    <button className={styles.signOutBtn} onClick={handleSignOut}>Sign out</button>
                </div>
            </aside>

            {/* Main */}
            <main className={styles.main}>
                <header className={styles.header}>
                    <div style={{ flex: 1 }}>
                        <h1 className={styles.greeting}>{greeting}, Lukas.</h1>
                        <p className={styles.date}>
                            {today.toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                    </div>

                    {!loading && data && (data.hard75History?.length ?? 0) > 0 && selectedIdx !== null && (
                        <div className={styles.dayNav} style={{ background: 'var(--color-bg-secondary)', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', margin: '0 var(--space-4)' }}>
                            <button
                                className={styles.dayNavBtn}
                                onClick={() => setSelectedIdx(i => Math.max(0, (i ?? 0) - 1))}
                                disabled={selectedIdx === 0}
                            >‹</button>
                            <div style={{ textAlign: 'center', minWidth: 140 }}>
                                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text)' }}>
                                    {shortDate(data.hard75History[selectedIdx].date)}
                                </div>
                                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>
                                    {data.hard75History[selectedIdx].day != null ? `Day ${data.hard75History[selectedIdx].day}` : 'Pre-challenge'} · {data.hard75History[selectedIdx].date === data.todayAEST ? 'Today' : 'Historical'}
                                </div>
                            </div>
                            <button
                                className={styles.dayNavBtn}
                                onClick={() => setSelectedIdx(i => Math.min(data.hard75History.length - 1, (i ?? 0) + 1))}
                                disabled={selectedIdx === data.hard75History.length - 1}
                            >›</button>
                        </div>
                    )}

                    <div className={styles.headerMeta}>
                        <span className={styles.userBadge} title={lastSyncedLabel}>{lastSyncedLabel}</span>
                    </div>
                </header>

                {loading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                        <span className="spinner" style={{ width: 16, height: 16 }} />
                        Loading your data…
                    </div>
                ) : !data ? (
                    <div className={styles.widgetNotice}>
                        🔗 Not yet synced — run <code>regenerate.sh</code> in OpenClaw to populate.
                    </div>
                ) : (
                    // selectedIdx may still be null if hard75History is empty
                    <div className={styles.grid}>
                        {/* Whoop Status for selected day */}
                        <div className={`${styles.gridItem} ${styles.gridItemFull}`}>
                            <WhoopWidget
                                data={selectedIdx !== null ? (data.whoopHistory.find(h => h.date === data.hard75History[selectedIdx].date) || null) : (data.whoopHistory[data.whoopHistory.length - 1] || null)}
                                todayAEST={data.todayAEST}
                                selectedDate={selectedIdx !== null ? data.hard75History[selectedIdx].date : data.todayAEST}
                            />
                        </div>

                        {/* Habits for selected day */}
                        <div className={styles.gridItem}>
                            <HabitsWidget data={selectedIdx !== null ? data.hard75History[selectedIdx] : null} />
                        </div>

                        {/* Recent Tasks Snapshot */}
                        <div className={styles.gridItem}>
                            <TasksWidget data={data.tasks} />
                        </div>

                        {/* Sleep Stage Chart */}
                        <div className={styles.gridItem}>
                            <SleepChartWidget data={data.sleep} />
                        </div>

                        {/* Tasks Over Time */}
                        <div className={styles.gridItem}>
                            <PileTrajectoryWidget data={data.tasks} selectedDate={selectedIdx !== null ? data.hard75History[selectedIdx].date : data.todayAEST} />
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
