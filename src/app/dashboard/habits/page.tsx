'use client';

import { useEffect, useState } from 'react';
import { BarChart } from '@/components/charts/Charts';
import DashboardShell from '../DashboardShell';
import styles from '../dashboard.module.css';

interface Hard75Day {
    date: string; day: number; days_completed: number; today_complete: boolean;
    checks: Record<string, { done: boolean; time: string | null }>;
    finish_confidence: number; discipline_score: number;
}

const checkDefs = [
    { key: 'workout1', icon: '🏃', label: 'Outdoor Workout' },
    { key: 'workout2', icon: '💪', label: '2nd Workout' },
    { key: 'water', icon: '💧', label: 'Gallon Water' },
    { key: 'diet', icon: '🥗', label: 'Whole Foods' },
    { key: 'reading', icon: '📖', label: '10 Pages' },
];

// General habits tracked separately from 75 Hard
const generalHabits = [
    { key: 'teeth', icon: '🦷', label: 'Brush teeth (AM + PM)' },
];

function shortDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

export default function HabitsPage() {
    const [history, setHistory] = useState<Hard75Day[]>([]);
    const [idx, setIdx] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/dashboard')
            .then(r => r.json())
            .then(d => {
                const hist = d.hard75History ?? [];
                setHistory(hist);
                setIdx(hist.length - 1);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const data = history[idx];
    const doneCount = data ? checkDefs.filter(c => data.checks?.[c.key]?.done).length : 0;
    const pct = data ? Math.round((doneCount / checkDefs.length) * 100) : 0;

    const chartData = history.map(d => ({
        date: shortDate(d.date),
        Score: d.discipline_score ?? null,
    })).filter(d => d.Score !== null);

    if (loading) return (
        <DashboardShell>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                <span className="spinner" style={{ width: 16, height: 16 }} />
                Loading habits…
            </div>
        </DashboardShell>
    );

    return (
        <DashboardShell>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                <div>
                    <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 'var(--space-1)' }}>Habits</h2>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: 0, maxWidth: 'none' }}>Daily disciplines and 75 Hard progress.</p>
                </div>

                {/* General habits — always visible */}
                <div className={styles.widget}>
                    <div className={styles.widgetHeader}>
                        <div className={styles.widgetTitle}><span className={styles.widgetIcon}>◈</span>Every Day</div>
                        <span className={styles.widgetBadge}>General</span>
                    </div>
                    <ul className={styles.habitList}>
                        {generalHabits.map(({ icon, label }) => (
                            <li key={label} className={styles.habitItem}>
                                <div className={styles.habitCheck} />
                                <span className={styles.habitName}>{icon} {label}</span>
                            </li>
                        ))}
                    </ul>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', maxWidth: 'none', marginTop: 'var(--space-1)' }}>
                        Track manually for now — sync will update these automatically.
                    </p>
                </div>

                {data && (
                    <>
                        {/* 75 Hard checklist with day nav */}
                        <div className={styles.widget}>
                            <div className={styles.widgetHeader}>
                                <div className={styles.widgetTitle}><span className={styles.widgetIcon}>⬡</span>75 Hard — Day {data.day}</div>
                                <div className={styles.dayNav}>
                                    <button className={styles.dayNavBtn} onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}>‹</button>
                                    <span className={styles.dayNavDate}>{shortDate(data.date)}</span>
                                    <button className={styles.dayNavBtn} onClick={() => setIdx(i => Math.min(history.length - 1, i + 1))} disabled={idx === history.length - 1}>›</button>
                                </div>
                            </div>

                            <div className={styles.statsStrip} style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                                <div className={styles.statCard}>
                                    <span className={styles.statValue}>{data.day} <span style={{ fontSize: 'var(--text-sm)', fontWeight: 400, color: 'var(--color-text-muted)' }}>/ 75</span></span>
                                    <span className={styles.statLabel}>Day</span>
                                </div>
                                <div className={styles.statCard}>
                                    <span className={styles.statValue} style={{ color: data.today_complete ? '#6db86d' : '#c07070' }}>
                                        {data.today_complete ? '✓ Done' : `${doneCount}/5`}
                                    </span>
                                    <span className={styles.statLabel}>Today</span>
                                </div>
                                <div className={styles.statCard}>
                                    <span className={styles.statValue} style={{ color: data.finish_confidence >= 80 ? '#6db86d' : '#c9a84c' }}>{data.finish_confidence ?? '—'}%</span>
                                    <span className={styles.statLabel}>Confidence</span>
                                </div>
                            </div>

                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
                                    <span>Program progress</span>
                                    <span>{Math.round((data.day / 75) * 100)}%</span>
                                </div>
                                <div className={styles.habitProgress}>
                                    <div className={styles.habitBar} style={{ width: `${Math.round((data.day / 75) * 100)}%` }} />
                                </div>
                            </div>

                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
                                    <span>Daily checklist</span>
                                    <span>{doneCount}/{checkDefs.length} complete</span>
                                </div>
                                <div className={styles.habitProgress} style={{ marginBottom: 'var(--space-4)' }}>
                                    <div className={styles.habitBar} style={{ width: `${pct}%`, background: pct === 100 ? '#5a9a5a' : undefined }} />
                                </div>
                                <ul className={styles.habitList}>
                                    {checkDefs.map(({ key, icon, label }) => {
                                        const item = data.checks?.[key];
                                        const done = item?.done ?? false;
                                        return (
                                            <li key={key} className={styles.habitItem}>
                                                <div className={`${styles.habitCheck} ${done ? styles.habitDone : ''}`}>
                                                    {done && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L4 7L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                                </div>
                                                <span className={`${styles.habitName} ${done ? styles.habitNameDone : ''}`}>{icon} {label}</span>
                                                {item?.time && <span className={styles.streak}>{item.time}</span>}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        </div>

                        {chartData.length > 1 && (
                            <div className={styles.widget}>
                                <div className={styles.widgetHeader}>
                                    <div className={styles.widgetTitle}><span className={styles.widgetIcon}>◉</span>Discipline Score</div>
                                    <span className={styles.widgetBadge}>All days</span>
                                </div>
                                <BarChart data={chartData} xKey="date" height={160} bars={[{ key: 'Score', color: 'var(--accent-400)', name: 'Discipline Score' }]} yDomain={[0, 100]} unit="%" />
                                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', maxWidth: 'none' }}>Discipline score reflects how early in the day tasks were completed.</p>
                            </div>
                        )}

                        <div className={styles.widget}>
                            <div className={styles.widgetHeader}>
                                <div className={styles.widgetTitle}><span className={styles.widgetIcon}>◇</span>Day Log</div>
                                <span className={styles.widgetBadge}>{data.days_completed} completed</span>
                            </div>
                            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                {[...history].reverse().map(d => (
                                    <li key={d.date} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
                                        <span style={{ fontSize: 'var(--text-base)', width: 20 }}>{d.today_complete ? '✅' : '❌'}</span>
                                        <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', width: 60, flexShrink: 0 }}>Day {d.day}</span>
                                        <span style={{ flex: 1, fontSize: 'var(--text-sm)' }}>{shortDate(d.date)}</span>
                                        <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
                                            {d.discipline_score ? `${d.discipline_score}%` : ''}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </>
                )}

                {!data && !loading && (
                    <div className={styles.widget}>
                        <p className={styles.widgetNotice}>🔗 No habits data yet. Data will appear after the next sync.</p>
                    </div>
                )}
            </div>
        </DashboardShell>
    );
}
