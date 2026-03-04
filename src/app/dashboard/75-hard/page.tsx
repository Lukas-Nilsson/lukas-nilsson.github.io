'use client';

import { useEffect, useState } from 'react';
import { BarChart, LineChart } from '@/components/charts/Charts';
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

function shortDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

export default function SeventyFiveHardPage() {
    const [history, setHistory] = useState<Hard75Day[]>([]);
    const [idx, setIdx] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/dashboard')
            .then(r => r.json())
            .then(d => {
                const hist: Hard75Day[] = d.hard75History ?? [];
                setHistory(hist);
                setIdx(hist.length - 1);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const today = history[history.length - 1];
    const data = history[idx];
    const doneCount = data ? checkDefs.filter(c => data.checks?.[c.key]?.done).length : 0;
    const pct = doneCount / checkDefs.length * 100;

    const disciplineChart = history.map(d => ({
        date: shortDate(d.date),
        Score: d.discipline_score ?? null,
    })).filter(d => d.Score !== null);

    const confidenceChart = history.filter(d => d.finish_confidence != null).map(d => ({
        date: shortDate(d.date),
        Confidence: d.finish_confidence,
    }));

    if (loading) return (
        <DashboardShell>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                <span className="spinner" style={{ width: 16, height: 16 }} />
                Loading 75 Hard…
            </div>
        </DashboardShell>
    );

    if (!today) return (
        <DashboardShell>
            <div className={styles.widget}>
                <p className={styles.widgetNotice}>🔗 No 75 Hard data yet. Data will appear after the next sync.</p>
            </div>
        </DashboardShell>
    );

    const programPct = Math.round((today.day / 75) * 100);
    const startDate = history[0]?.date;
    const endDate = startDate ? new Date(new Date(startDate).getTime() + 74 * 86400000).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

    return (
        <DashboardShell>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                {/* Hero */}
                <div className={styles.widget} style={{ background: 'var(--color-bg-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                        <div>
                            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-2)', maxWidth: 'none' }}>75 Hard</p>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
                                <span style={{ fontSize: 72, fontWeight: 900, letterSpacing: '-0.05em', lineHeight: 1, fontFamily: 'var(--font-heading)', color: 'var(--color-text)' }}>{today.day}</span>
                                <span style={{ fontSize: 'var(--text-xl)', color: 'var(--color-text-muted)', fontWeight: 400 }}>/ 75</span>
                            </div>
                            {endDate && (
                                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: 'var(--space-2) 0 0', maxWidth: 'none' }}>
                                    Ends {endDate} · {75 - today.day} days to go
                                </p>
                            )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, letterSpacing: '-0.04em', color: today.finish_confidence >= 80 ? '#6db86d' : '#c9a84c' }}>{today.finish_confidence}%</div>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Confidence</div>
                        </div>
                    </div>
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
                            <span>Progress</span><span>{programPct}%</span>
                        </div>
                        <div className={styles.habitProgress}>
                            <div className={styles.habitBar} style={{ width: `${programPct}%` }} />
                        </div>
                    </div>
                    <div className={styles.statsStrip}>
                        <div className={styles.statCard}>
                            <span className={styles.statValue} style={{ color: '#6db86d' }}>{today.days_completed}</span>
                            <span className={styles.statLabel}>Days done</span>
                        </div>
                        <div className={styles.statCard}>
                            <span className={styles.statValue} style={{ color: '#c07070' }}>{today.day - today.days_completed}</span>
                            <span className={styles.statLabel}>Missed</span>
                        </div>
                        <div className={styles.statCard}>
                            <span className={styles.statValue}>{75 - today.day}</span>
                            <span className={styles.statLabel}>Remaining</span>
                        </div>
                    </div>
                </div>

                {/* Day navigator + checklist */}
                <div className={styles.widget}>
                    <div className={styles.widgetHeader}>
                        <div className={styles.widgetTitle}><span className={styles.widgetIcon}>◈</span>Daily Checklist</div>
                        <div className={styles.dayNav}>
                            <button className={styles.dayNavBtn} onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}>‹</button>
                            <span className={styles.dayNavDate}>{shortDate(data.date)} · Day {data.day}</span>
                            <button className={styles.dayNavBtn} onClick={() => setIdx(i => Math.min(history.length - 1, i + 1))} disabled={idx === history.length - 1}>›</button>
                        </div>
                    </div>

                    <div className={styles.habitProgress}>
                        <div className={styles.habitBar} style={{ width: `${pct}%`, background: pct === 100 ? '#5a9a5a' : undefined }} />
                    </div>

                    <ul className={styles.habitList}>
                        {checkDefs.map(({ key, icon, label }) => {
                            const item = data?.checks?.[key];
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
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', maxWidth: 'none' }}>
                        {doneCount}/{checkDefs.length} tasks complete · Day {data.day}
                        {data.today_complete ? ' ✅' : ''}
                    </p>
                </div>

                {/* Discipline score chart */}
                {disciplineChart.length > 1 && (
                    <div className={styles.widget}>
                        <div className={styles.widgetHeader}>
                            <div className={styles.widgetTitle}><span className={styles.widgetIcon}>◉</span>Discipline Score</div>
                            <span className={styles.widgetBadge}>By day</span>
                        </div>
                        <BarChart data={disciplineChart} xKey="date" height={160} bars={[{ key: 'Score', color: 'var(--accent-400)', name: 'Discipline %' }]} yDomain={[0, 100]} unit="%" />
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', maxWidth: 'none' }}>Earlier in the day = higher score.</p>
                    </div>
                )}

                {/* Confidence trend */}
                {confidenceChart.length > 1 && (
                    <div className={styles.widget}>
                        <div className={styles.widgetHeader}>
                            <div className={styles.widgetTitle}><span className={styles.widgetIcon}>◇</span>Finish Confidence</div>
                            <span className={styles.widgetBadge}>Trend</span>
                        </div>
                        <LineChart data={confidenceChart} xKey="date" height={140} lines={[{ key: 'Confidence', color: '#6db86d', name: 'Confidence %' }]} yDomain={[0, 100]} unit="%" />
                    </div>
                )}

                {/* Full day log */}
                <div className={styles.widget}>
                    <div className={styles.widgetHeader}>
                        <div className={styles.widgetTitle}><span className={styles.widgetIcon}>◆</span>Day Log</div>
                        <span className={styles.widgetBadge}>{today.days_completed} / {today.day} completed</span>
                    </div>
                    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
                        {[...history].reverse().map(d => (
                            <li key={d.date} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-3) 0', borderBottom: '1px solid var(--color-border)' }}>
                                <span style={{ fontSize: 'var(--text-base)', width: 20 }}>{d.today_complete ? '✅' : '❌'}</span>
                                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', width: 56, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>Day {d.day}</span>
                                <span style={{ flex: 1, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>{shortDate(d.date)}</span>
                                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{d.discipline_score ? `${d.discipline_score}%` : '—'}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </DashboardShell>
    );
}
