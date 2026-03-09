'use client';

import { useEffect, useState, useMemo } from 'react';
import { LineChart, BarChart } from '@/components/charts/Charts';
import DashboardShell from '../DashboardShell';
import styles from '../dashboard.module.css';

interface WhoopDay { date: string; recovery: number; hrv: number; strain: number; sleep_hours: number; sleep_performance: number; }
interface SleepDay { date: string; performance: number; hours_in_bed: number; deep: number; rem: number; light: number; }
interface HabitDay { date: string; discipline_score: number; checks: Record<string, { done: boolean }> }

function shortDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function recoveryColor(r: number) {
    return r >= 67 ? '#6db86d' : r >= 34 ? '#c9a84c' : '#c07070';
}

export default function HealthPage() {
    const [whoop, setWhoop] = useState<WhoopDay[]>([]);
    const [sleep, setSleep] = useState<SleepDay[]>([]);
    const [latest, setLatest] = useState<WhoopDay | null>(null);
    const [habits, setHabits] = useState<HabitDay[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/dashboard')
            .then(r => r.json())
            .then(d => {
                setWhoop(d.whoopHistory ?? []);
                setSleep(d.sleep ?? []);
                setLatest(d.whoop ?? null);
                setHabits(d.habitHistory ?? []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    // ── Health ↔ Habits correlation analysis ──
    const correlation = useMemo(() => {
        if (whoop.length < 3 || habits.length < 3) return null;

        const recoveryByDate = new Map(whoop.map(w => [w.date, w]));
        const habitByDate = new Map(habits.map(h => [h.date, h]));
        const pairedDays = [...recoveryByDate.keys()].filter(d => habitByDate.has(d));
        if (pairedDays.length < 3) return null;

        const totalHabits = 6;
        const perfectDays = pairedDays.filter(d => {
            const h = habitByDate.get(d)!;
            return Object.values(h.checks).filter(c => c.done).length === totalHabits;
        });
        const imperfectDays = pairedDays.filter(d => !perfectDays.includes(d));

        const avg = (dates: string[], key: 'recovery' | 'hrv') => {
            if (!dates.length) return null;
            return Math.round(dates.reduce((s, d) => s + ((recoveryByDate.get(d) as any)?.[key] ?? 0), 0) / dates.length);
        };

        const overlayData = pairedDays.sort().map(d => ({
            date: shortDate(d),
            'Discipline %': habitByDate.get(d)!.discipline_score,
            'Recovery %': recoveryByDate.get(d)!.recovery,
        }));

        const avgRecP = avg(perfectDays, 'recovery');
        const avgRecI = avg(imperfectDays, 'recovery');

        return {
            pairedDays: pairedDays.length,
            perfectDays: perfectDays.length, imperfectDays: imperfectDays.length,
            avgRecPerfect: avgRecP, avgRecImperfect: avgRecI,
            avgHrvPerfect: avg(perfectDays, 'hrv'), avgHrvImperfect: avg(imperfectDays, 'hrv'),
            overlayData,
            diff: avgRecP !== null && avgRecI !== null ? avgRecP - avgRecI : null,
        };
    }, [whoop, habits]);

    if (loading) return (
        <DashboardShell>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                <span className="spinner" style={{ width: 16, height: 16 }} />Loading health data…
            </div>
        </DashboardShell>
    );

    const recovChart = whoop.map(w => ({ date: shortDate(w.date), Recovery: w.recovery, HRV: w.hrv }));
    const strainChart = whoop.map(w => ({ date: shortDate(w.date), Strain: w.strain }));
    const sleepChart = sleep.map(s => ({
        date: shortDate(s.date), 'Quality %': s.performance, Deep: s.deep, REM: s.rem, Light: s.light,
    }));

    return (
        <DashboardShell>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                <div>
                    <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 'var(--space-1)' }}>Health</h2>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: 0, maxWidth: 'none' }}>Whoop biometrics, sleep tracking, and habit correlation insights.</p>
                </div>

                {latest && (
                    <div className={styles.widget}>
                        <div className={styles.widgetHeader}>
                            <div className={styles.widgetTitle}><span className={styles.widgetIcon}>◎</span>Today</div>
                        </div>
                        <div className={styles.statsStrip}>
                            {[
                                { label: 'Recovery', value: `${latest.recovery}%`, color: recoveryColor(latest.recovery) },
                                { label: 'HRV', value: `${latest.hrv} ms`, color: '#7aaac9' },
                                { label: 'RHR', value: `${(latest as any).rhr ?? '—'} bpm`, color: 'var(--color-text)' },
                                { label: 'Strain', value: latest.strain?.toFixed(1) ?? '—', color: 'var(--accent-400)' },
                                { label: 'Sleep', value: `${latest.sleep_hours}h`, color: 'var(--accent-300)' },
                                { label: 'Sleep Perf', value: `${latest.sleep_performance}%`, color: latest.sleep_performance >= 85 ? '#6db86d' : '#c9a84c' },
                            ].map(({ label, value, color }) => (
                                <div key={label} className={styles.statCard}>
                                    <span className={styles.statValue} style={{ color }}>{value}</span>
                                    <span className={styles.statLabel}>{label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Health ↔ Habits Correlation */}
                {correlation && (
                    <div className={styles.widget}>
                        <div className={styles.widgetHeader}>
                            <div className={styles.widgetTitle}><span className={styles.widgetIcon}>🔗</span>Health ↔ Habits</div>
                            <span className={styles.widgetBadge}>{correlation.pairedDays} days analyzed</span>
                        </div>
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: '0 0 var(--space-3)', maxWidth: 'none' }}>
                            Comparing recovery on days with all habits done vs. missed habits.
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                            <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', background: 'rgba(90,154,90,0.08)', border: '1px solid rgba(90,154,90,0.2)' }}>
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 4 }}>✅ All habits done ({correlation.perfectDays}d)</div>
                                <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: '#6db86d' }}>
                                    {correlation.avgRecPerfect ?? '—'}%
                                </div>
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>HRV: {correlation.avgHrvPerfect ?? '—'} ms</div>
                            </div>
                            <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', background: 'rgba(192,112,112,0.08)', border: '1px solid rgba(192,112,112,0.2)' }}>
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 4 }}>❌ Habits missed ({correlation.imperfectDays}d)</div>
                                <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: '#c07070' }}>
                                    {correlation.avgRecImperfect ?? '—'}%
                                </div>
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>HRV: {correlation.avgHrvImperfect ?? '—'} ms</div>
                            </div>
                        </div>

                        {correlation.diff !== null && (
                            <div style={{ padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-secondary)', fontSize: 'var(--text-sm)', textAlign: 'center' }}>
                                {correlation.diff > 0 ? (
                                    <span style={{ color: '#6db86d', fontWeight: 700 }}>📈 +{correlation.diff}% recovery on all-habits-done days</span>
                                ) : (
                                    <span style={{ color: 'var(--color-text-muted)' }}>More data needed for strong correlation</span>
                                )}
                            </div>
                        )}

                        {correlation.overlayData.length > 2 && (
                            <div style={{ marginTop: 'var(--space-4)' }}>
                                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: '0 0 var(--space-2)', maxWidth: 'none' }}>Discipline % vs Recovery % — trend overlay</p>
                                <LineChart data={correlation.overlayData} xKey="date" height={180} lines={[
                                    { key: 'Discipline %', color: '#c9a84c', name: 'Discipline' },
                                    { key: 'Recovery %', color: '#6db86d', name: 'Recovery' },
                                ]} yDomain={[0, 100]} unit="%" />
                            </div>
                        )}
                    </div>
                )}

                {recovChart.length > 0 && (
                    <div className={styles.widget}>
                        <div className={styles.widgetHeader}>
                            <div className={styles.widgetTitle}><span className={styles.widgetIcon}>◎</span>Recovery & HRV Trend</div>
                            <span className={styles.widgetBadge}>Last {recovChart.length} days</span>
                        </div>
                        <LineChart data={recovChart} xKey="date" height={200} lines={[{ key: 'Recovery', color: '#6db86d', name: 'Recovery %' }, { key: 'HRV', color: '#7aaac9', name: 'HRV ms' }]} yDomain={[0, 120]} />
                    </div>
                )}

                {strainChart.length > 0 && (
                    <div className={styles.widget}>
                        <div className={styles.widgetHeader}>
                            <div className={styles.widgetTitle}><span className={styles.widgetIcon}>◉</span>Daily Strain</div>
                            <span className={styles.widgetBadge}>0 – 21 scale</span>
                        </div>
                        <BarChart data={strainChart} xKey="date" height={160} bars={[{ key: 'Strain', color: '#c9a84c', name: 'Strain' }]} yDomain={[0, 21]} />
                    </div>
                )}

                {sleepChart.length > 0 && (
                    <div className={styles.widget}>
                        <div className={styles.widgetHeader}>
                            <div className={styles.widgetTitle}><span className={styles.widgetIcon}>◑</span>Sleep Quality</div>
                            <span className={styles.widgetBadge}>Last {sleepChart.length} nights</span>
                        </div>
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: '0 0 var(--space-2)', maxWidth: 'none' }}>Quality %</p>
                        <LineChart data={sleepChart} xKey="date" height={140} lines={[{ key: 'Quality %', color: '#7aaac9', name: 'Sleep Quality' }]} yDomain={[0, 100]} unit="%" />
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: 'var(--space-4) 0 var(--space-2)', maxWidth: 'none' }}>Sleep stages (hours)</p>
                        <BarChart data={sleepChart} xKey="date" height={140} bars={[{ key: 'Deep', color: '#3d5c8a', name: 'Deep' }, { key: 'REM', color: '#7a5a8a', name: 'REM' }, { key: 'Light', color: '#5a7a5a', name: 'Light' }]} unit="h" />
                    </div>
                )}

                {!latest && !loading && (
                    <div className={styles.widget}>
                        <p className={styles.widgetNotice}>🔗 No Whoop data yet. Data will appear after the next sync.</p>
                    </div>
                )}
            </div>
        </DashboardShell>
    );
}
