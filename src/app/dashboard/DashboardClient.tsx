'use client';

import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from './dashboard.module.css';

interface Props { user: User; }

interface DashboardData {
    whoop: {
        date: string; recovery: number; hrv: number; rhr: number;
        strain: number; sleep_hours: number; sleep_performance: number;
    } | null;
    hard75: {
        date: string; day: number; days_completed: number; today_complete: boolean;
        checks: Record<string, { done: boolean; time: string | null }>;
        finish_confidence: number;
    } | null;
    tasks: {
        updated_at: string; total_open: number; total_done: number;
        categories: Record<string, { open: number; done: number; tasks: string[]; overdue: { name: string; due: string }[] }>;
        overdue_tasks: { name: string; due: string; category: string }[];
    } | null;
    sleep: { date: string; performance: number; hours_in_bed: number; deep: number; rem: number; light: number }[];
}

// ─── Widget: Whoop ────────────────────────────────────────────────────────────
function WhoopWidget({ data }: { data: DashboardData['whoop'] }) {
    if (!data) {
        return (
            <div className={styles.widget}>
                <div className={styles.widgetHeader}>
                    <div className={styles.widgetTitle}><span className={styles.widgetIcon}>◎</span>Whoop</div>
                    <span className={styles.widgetBadge}>No data yet</span>
                </div>
                <p className={styles.widgetNotice}>🔗 Run OpenClaw sync to see live Whoop data.</p>
            </div>
        );
    }

    const recoveryColor = data.recovery >= 67 ? 'var(--green-400)' : data.recovery >= 34 ? 'var(--yellow-400)' : 'var(--red-400)';
    const stats = [
        { label: 'Recovery', value: `${data.recovery}%`, color: recoveryColor, sub: data.recovery >= 67 ? 'Good' : data.recovery >= 34 ? 'OK' : 'Low' },
        { label: 'Strain', value: String(data.strain ?? '—'), color: 'var(--accent-400)', sub: 'Today' },
        { label: 'Sleep', value: data.sleep_hours ? `${data.sleep_hours}h` : '—', color: 'var(--accent-300)', sub: `${data.sleep_performance ?? '—'}% perf` },
        { label: 'HRV', value: data.hrv ? `${data.hrv} ms` : '—', color: 'var(--green-400)', sub: `RHR ${data.rhr ?? '—'}` },
    ];

    return (
        <div className={styles.widget}>
            <div className={styles.widgetHeader}>
                <div className={styles.widgetTitle}><span className={styles.widgetIcon}>◎</span>Whoop</div>
                <span className={styles.widgetBadge}>{new Date(data.date).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
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
        </div>
    );
}

// ─── Widget: 75 Hard ─────────────────────────────────────────────────────────
const checkDefs = [
    { key: 'workout1', icon: '🏃', label: 'Outdoor Workout' },
    { key: 'workout2', icon: '💪', label: '2nd Workout' },
    { key: 'water', icon: '💧', label: 'Gallon Water' },
    { key: 'diet', icon: '🥗', label: 'Whole Foods' },
    { key: 'reading', icon: '📖', label: '10 Pages' },
];

function Hard75Widget({ data }: { data: DashboardData['hard75'] }) {
    if (!data) {
        return (
            <div className={styles.widget}>
                <div className={styles.widgetHeader}>
                    <div className={styles.widgetTitle}><span className={styles.widgetIcon}>◈</span>75 Hard</div>
                    <span className={styles.widgetBadge}>No data yet</span>
                </div>
                <p className={styles.widgetNotice}>🔗 Run OpenClaw sync to see 75 Hard progress.</p>
            </div>
        );
    }

    const pct = Math.round((data.day / 75) * 100);

    return (
        <div className={styles.widget}>
            <div className={styles.widgetHeader}>
                <div className={styles.widgetTitle}><span className={styles.widgetIcon}>◈</span>75 Hard</div>
                <span className={styles.widgetBadge}>Day {data.day} / 75</span>
            </div>
            <div className={styles.habitProgress}>
                <div className={styles.habitBar} style={{ width: `${pct}%` }} />
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
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
                Finish confidence: <strong style={{ color: data.finish_confidence >= 80 ? 'var(--green-400)' : 'var(--yellow-400)' }}>{data.finish_confidence}%</strong>
            </p>
        </div>
    );
}

// ─── Widget: Tasks ────────────────────────────────────────────────────────────
function TasksWidget({ data }: { data: DashboardData['tasks'] }) {
    if (!data) {
        return (
            <div className={styles.widget}>
                <div className={styles.widgetHeader}>
                    <div className={styles.widgetTitle}><span className={styles.widgetIcon}>◇</span>Tasks</div>
                    <span className={styles.widgetBadge}>No data yet</span>
                </div>
                <p className={styles.widgetNotice}>🔗 Run OpenClaw sync to see task data.</p>
            </div>
        );
    }

    const priorityColor: Record<string, string> = {
        Wedding: 'var(--accent-400)', THA: 'var(--accent-500)', Home: 'var(--yellow-400)',
        Fitness: 'var(--green-400)', Finance: 'var(--accent-300)', Personal: 'var(--neutral-500)', Dev: 'var(--red-400)',
    };

    const cats = Object.entries(data.categories ?? {});

    return (
        <div className={styles.widget}>
            <div className={styles.widgetHeader}>
                <div className={styles.widgetTitle}><span className={styles.widgetIcon}>◇</span>The Pile</div>
                <span className={styles.widgetBadge}>{data.total_open} open · {data.total_done} done</span>
            </div>

            {data.overdue_tasks?.length > 0 && (
                <div style={{ background: 'rgba(192,112,112,0.1)', border: '1px solid rgba(192,112,112,0.2)', borderRadius: 'var(--radius)', padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-2)' }}>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--red-400)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>⚠ Overdue</p>
                    {data.overdue_tasks.map(t => (
                        <p key={t.name} style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', maxWidth: 'none', margin: '2px 0' }}>
                            {t.name} <span style={{ color: 'var(--color-text-muted)' }}>· {t.category}</span>
                        </p>
                    ))}
                </div>
            )}

            <ul className={styles.taskList}>
                {cats.map(([cat, { open }]) => (
                    <li key={cat} className={styles.taskItem}>
                        <div className={styles.priorityDot} style={{ background: priorityColor[cat] ?? 'var(--neutral-400)' }} />
                        <span className={styles.taskTitle}>{cat}</span>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>{open}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

// ─── Widget: Sleep ────────────────────────────────────────────────────────────
function SleepWidget({ data }: { data: DashboardData['sleep'] }) {
    if (!data?.length) {
        return (
            <div className={styles.widget}>
                <div className={styles.widgetHeader}>
                    <div className={styles.widgetTitle}><span className={styles.widgetIcon}>◉</span>Sleep</div>
                    <span className={styles.widgetBadge}>No data yet</span>
                </div>
                <p className={styles.widgetNotice}>🔗 Run OpenClaw sync to see sleep history.</p>
            </div>
        );
    }

    const latest = data[0];
    return (
        <div className={styles.widget}>
            <div className={styles.widgetHeader}>
                <div className={styles.widgetTitle}><span className={styles.widgetIcon}>◉</span>Sleep</div>
                <span className={styles.widgetBadge}>Last {data.length} nights</span>
            </div>
            <ul className={styles.eventList}>
                {data.map(s => (
                    <li key={s.date} className={styles.event}>
                        <span className={styles.eventTime}>{new Date(s.date).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric' })}</span>
                        <div className={styles.eventBar} style={{ background: s.performance >= 85 ? 'var(--green-400)' : s.performance >= 70 ? 'var(--yellow-400)' : 'var(--red-400)' }} />
                        <span className={styles.eventTitle}>{s.hours_in_bed}h · {s.performance}% perf</span>
                    </li>
                ))}
            </ul>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', maxWidth: 'none' }}>
                Last night: {latest.deep}h deep · {latest.rem}h REM · {latest.light}h light
            </p>
        </div>
    );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function DashboardClient({ user }: Props) {
    const router = useRouter();
    const supabase = createClient();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/dashboard')
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/');
        router.refresh();
    };

    const today = new Date();
    const greeting = today.getHours() < 12 ? 'Good morning' : today.getHours() < 17 ? 'Good afternoon' : 'Good evening';

    return (
        <div className={styles.shell}>
            {/* Sidebar */}
            <aside className={styles.sidebar}>
                <div className={styles.sidebarLogo}>
                    <div className={styles.logoMark} aria-label="Lukas Nilsson">LN</div>
                </div>
                <nav className={styles.sidebarNav}>
                    {[
                        { icon: '◉', label: 'Overview', href: '/dashboard', active: true },
                        { icon: '◎', label: 'Health', href: '/dashboard/health' },
                        { icon: '◈', label: '75 Hard', href: '/dashboard/habits' },
                        { icon: '◇', label: 'Tasks', href: '/dashboard/tasks' },
                    ].map(({ icon, label, href, active }) => (
                        <a key={href} href={href} className={`${styles.navLink} ${active ? styles.navActive : ''}`}>
                            <span className={styles.navIcon} aria-hidden="true">{icon}</span>
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
                    <div>
                        <h1 className={styles.greeting}>{greeting}, Lukas.</h1>
                        <p className={styles.date}>
                            {today.toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                    </div>
                    <div className={styles.headerMeta}>
                        {!loading && data && (
                            <span className={styles.userBadge} title="Data is live from OpenClaw → Supabase">🟢 live</span>
                        )}
                        <span className={styles.userBadge}>{user.email}</span>
                    </div>
                </header>

                {loading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                        <span className="spinner" style={{ width: 16, height: 16 }} />
                        Loading your data…
                    </div>
                ) : (
                    <div className={styles.grid}>
                        <div className={`${styles.gridItem} ${styles.gridItemFull}`}>
                            <WhoopWidget data={data?.whoop ?? null} />
                        </div>
                        <div className={styles.gridItem}>
                            <Hard75Widget data={data?.hard75 ?? null} />
                        </div>
                        <div className={styles.gridItem}>
                            <TasksWidget data={data?.tasks ?? null} />
                        </div>
                        <div className={`${styles.gridItem} ${styles.gridItemFull}`}>
                            <SleepWidget data={data?.sleep ?? []} />
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
