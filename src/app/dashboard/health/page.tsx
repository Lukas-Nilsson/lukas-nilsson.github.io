'use client';

import { useEffect, useState } from 'react';
import { LineChart, BarChart } from '@/components/charts/Charts';
import DashboardShell from '../DashboardShell';
import styles from '../dashboard.module.css';

interface WhoopDay { date: string; recovery: number; hrv: number; strain: number; sleep_hours: number; sleep_performance: number; }
interface SleepDay { date: string; performance: number; hours_in_bed: number; deep: number; rem: number; light: number; }

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
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/dashboard')
            .then(r => r.json())
            .then(d => {
                setWhoop(d.whoopHistory ?? []);
                setSleep(d.sleep ?? []);
                setLatest(d.whoop ?? null);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    if (loading) return (
        <DashboardShell>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                <span className="spinner" style={{ width: 16, height: 16 }} />
                Loading health data…
            </div>
        </DashboardShell>
    );

    const recovChart = whoop.map(w => ({ date: shortDate(w.date), Recovery: w.recovery, HRV: w.hrv }));
    const strainChart = whoop.map(w => ({ date: shortDate(w.date), Strain: w.strain }));
    const sleepChart = sleep.map(s => ({
        date: shortDate(s.date),
        'Quality %': s.performance,
        Deep: s.deep,
        REM: s.rem,
        Light: s.light,
    }));

    return (
        <DashboardShell>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                <div>
                    <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 'var(--space-1)' }}>Health</h2>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: 0, maxWidth: 'none' }}>Whoop biometrics and sleep tracking.</p>
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

