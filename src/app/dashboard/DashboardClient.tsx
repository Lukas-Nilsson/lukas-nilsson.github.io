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
        history: { date: string; open: number; done: number; completed?: number; added?: number; removed?: number }[];
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
    { key: 'wake', icon: '🌅', label: 'Up by 7am' },
    { key: 'phone_down', icon: '📱', label: 'Phone Down', target: '11:30pm' },
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
                    Today&apos;s Whoop data hasn&apos;t synced yet.
                </p>
            )}
        </div>
    );
}

// ─── Sleep Chart Widget ───────────────────────────────────────────────────────
function SleepChartWidget({ data }: { data: DashboardData['sleep'] }) {
    if (!data.length) return <EmptyWidget icon="◑" title="Sleep" message="Sleep data will appear after the next sync." />;
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
        'Removed': h.removed ?? 0,
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
                    { key: 'Removed', color: '#8a6daa', name: 'Removed' },
                ]}
            />
        </div>
    );
}

// ─── Per-habit modal field config ────────────────────────────────────────────
const habitFields: Record<string, { showTime: boolean; showDescription: boolean; showNotes: boolean; timePlaceholder?: string }> = {
    workout1: { showTime: true, showDescription: true, showNotes: true, timePlaceholder: 'e.g. 15:00' },
    workout2: { showTime: true, showDescription: true, showNotes: true, timePlaceholder: 'e.g. 18:30' },
    water: { showTime: true, showDescription: false, showNotes: false, timePlaceholder: 'Time finished' },
    diet: { showTime: false, showDescription: false, showNotes: true },
    reading: { showTime: true, showDescription: false, showNotes: false, timePlaceholder: 'Time finished' },
    teeth: { showTime: false, showDescription: false, showNotes: false },
    bedtime: { showTime: true, showDescription: false, showNotes: false, timePlaceholder: 'e.g. 22:45' },
    wake: { showTime: true, showDescription: false, showNotes: false, timePlaceholder: 'e.g. 06:30' },
};

// ─── Habit ID mapping (UI key → new habit_id) ────────────────────────────────
const habitIdMap: Record<string, string> = {
    workout1: 'workout_outdoor',
    workout2: 'workout_2',
    water: 'water',
    diet: 'diet',
    reading: 'reading',
    teeth: 'teeth',
    bedtime: 'bedtime',
    wake: 'wake',
    phone_down: 'phone_down',
};

// ─── Habit Modal ──────────────────────────────────────────────────────────────
interface ModalState {
    key: string;
    label: string;
    icon: string;
    done: boolean;
    time: string;
    description: string;
    notes: string;
}

function HabitModal({
    state,
    date,
    onClose,
    onSave,
}: {
    state: ModalState;
    date: string;
    onClose: () => void;
    onSave: (key: string, done: boolean, value: string | null, notes: string | null) => void;
}) {
    const [done, setDone] = useState(state.done);
    const [time, setTime] = useState(state.time || state.description);
    const [notes, setNotes] = useState(state.notes);
    const [saving, setSaving] = useState(false);
    const fields = habitFields[state.key] ?? { showTime: false, showDescription: false, showNotes: true };

    const handleSave = async () => {
        setSaving(true);
        const value = time || null;
        try {
            const res = await fetch('/api/dashboard/habits', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date,
                    habit_id: habitIdMap[state.key] ?? state.key,
                    done,
                    value,
                    notes: notes || null,
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: res.statusText }));
                console.error('[Habit save failed]', err);
                alert(`Save failed: ${err.error || res.statusText}`);
                return;
            }
            onSave(state.key, done, value, notes || null);
        } catch (e) {
            console.error('[Habit save error]', e);
            alert('Network error — habit not saved.');
        } finally {
            setSaving(false);
            onClose();
        }
    };

    const overlay: React.CSSProperties = {
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        overflowY: 'auto' as const, padding: 'var(--space-4)',
    };
    const modal: React.CSSProperties = {
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-6)',
        width: '100%', maxWidth: 420,
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        margin: 'auto 0',
        maxHeight: 'calc(100dvh - var(--space-8))',
        overflowY: 'auto' as const,
    };
    const input: React.CSSProperties = {
        width: '100%', background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)', padding: 'var(--space-2) var(--space-3)',
        color: 'var(--color-text)', fontSize: 'var(--text-sm)',
        outline: 'none', boxSizing: 'border-box',
    };
    const label: React.CSSProperties = {
        fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)',
        display: 'block', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
    };

    return (
        <div style={overlay} onClick={onClose}>
            <div style={modal} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
                    <span style={{ fontSize: 28 }}>{state.icon}</span>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--color-text)' }}>{state.label}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{date}</div>
                    </div>
                </div>

                {/* Done toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', padding: 'var(--space-3)', background: done ? 'rgba(90,154,90,0.1)' : 'rgba(180,80,80,0.08)', borderRadius: 'var(--radius)', border: `1px solid ${done ? 'rgba(90,154,90,0.3)' : 'rgba(180,80,80,0.2)'}` }}>
                    <button
                        onClick={() => setDone(d => !d)}
                        style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer', background: done ? '#5a9a5a' : 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: done ? '0 0 0 3px rgba(90,154,90,0.3)' : '0 0 0 2px var(--color-border)', transition: 'all 0.2s' }}
                    >
                        {done && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L4 7L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </button>
                    <span style={{ fontWeight: 600, color: done ? '#6db86d' : 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>{done ? 'Completed ✓' : 'Mark as not done'}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {fields.showTime && (
                        <div>
                            <span style={label}>Time</span>
                            <input style={input} type="text" placeholder={fields.timePlaceholder ?? 'HH:MM'} value={time} onChange={e => setTime(e.target.value)} />
                        </div>
                    )}
                    {fields.showNotes && (
                        <div>
                            <span style={label}>Notes</span>
                            <textarea style={{ ...input, resize: 'vertical', minHeight: 48, fontFamily: 'inherit' }} placeholder="Optional context…" value={notes} onChange={e => setNotes(e.target.value)} />
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-5)' }}>
                    <button onClick={onClose} style={{ flex: 1, padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
                        Cancel
                    </button>
                    <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius)', border: 'none', background: 'var(--accent-500)', color: 'white', cursor: saving ? 'wait' : 'pointer', fontWeight: 600, fontSize: 'var(--text-sm)', opacity: saving ? 0.7 : 1 }}>
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Progress Ring SVG ───────────────────────────────────────────────────────
function ProgressRing({ done, total, size = 72 }: { done: number; total: number; size?: number }) {
    const stroke = 5;
    const radius = (size - stroke) / 2;
    const circ = 2 * Math.PI * radius;
    const pct = total > 0 ? done / total : 0;
    const offset = circ * (1 - pct);
    const color = pct === 1 ? '#5a9a5a' : pct >= 0.5 ? 'var(--accent-400)' : '#c9a84c';
    return (
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke}
                strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 600ms ease-out, stroke 300ms ease' }} />
            <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
                style={{ transform: 'rotate(90deg)', transformOrigin: 'center', fontSize: 14, fontWeight: 800, fill: 'var(--color-text)', fontFamily: 'var(--font-heading)' }}>
                {done}/{total}
            </text>
        </svg>
    );
}

// ─── Weekly Heatmap ──────────────────────────────────────────────────────────
function WeeklyHeatmap({ history }: { history: DashboardData['hard75History'] }) {
    const last7 = history.slice(-7);
    const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    return (
        <div className={styles.heatmapRow}>
            {last7.map((d, i) => {
                const total = checkDefs.length;
                const done = checkDefs.filter(c => d.checks?.[c.key]?.done).length;
                const ratio = done / total;
                const bg = ratio === 1 ? '#5a9a5a' : ratio >= 0.5 ? '#c9a84c' : ratio > 0 ? 'rgba(201,168,76,0.3)' : 'var(--color-bg-tertiary)';
                const dayLabel = days[new Date(d.date + 'T00:00:00').getDay() === 0 ? 6 : new Date(d.date + 'T00:00:00').getDay() - 1];
                return (
                    <div key={d.date} className={styles.heatmapCell} title={`${d.date}: ${done}/${total}`}>
                        <div className={styles.heatmapSquare} style={{ background: bg }} />
                        <span className={styles.heatmapLabel}>{dayLabel}</span>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Habits Widget ──────────────────────────────────────────────────────────
function HabitsWidget({ data, history }: { data: DashboardData['hard75History'][0] | null; history?: DashboardData['hard75History'] }) {
    const [overrides, setOverrides] = useState<Record<string, { done: boolean; time: string | null }>>({});
    const [modal, setModal] = useState<ModalState | null>(null);

    if (!data) return <EmptyWidget icon="◈" title="Habits" message="No habit data found for this day." />;

    const getCheck = (key: string) => {
        if (overrides[key] !== undefined) return overrides[key];
        return data.checks?.[key] ?? { done: false, time: null };
    };

    const openModal = (key: string, icon: string, label: string) => {
        const check = getCheck(key);
        const [desc, ...rest] = (check.time ?? '').split(' @ ');
        setModal({
            key, label, icon, done: check.done,
            time: rest.join(' @ ') || (check.time?.match(/^\d{1,2}:\d{2}$/) ? check.time : ''),
            description: check.time?.includes(' @ ') ? desc : '',
            notes: '',
        });
    };

    const handleSave = (key: string, done: boolean, value: string | null) => {
        setOverrides(o => ({ ...o, [key]: { done, time: value } }));
    };

    const hard75Keys = new Set(['workout1', 'workout2', 'water', 'diet', 'reading']);
    const isChallenge = data.day != null;
    const activeDefs = isChallenge ? checkDefs : checkDefs.filter(c => !hard75Keys.has(c.key));

    const doneCount = activeDefs.filter(c => getCheck(c.key).done).length;
    const pct = activeDefs.length > 0 ? Math.round((doneCount / activeDefs.length) * 100) : 0;

    // Calculate overall streak — skip today (not yet complete), count from yesterday back
    // Only use the `done` flag — having a value just means data was tracked, not the target was met
    const streak = (() => {
        if (!history?.length || history.length < 2) return 0;
        let count = 0;
        for (let i = history.length - 2; i >= 0; i--) {
            const d = history[i];
            const dayHabits = d.day != null ? checkDefs : checkDefs.filter(c => !hard75Keys.has(c.key));
            const allDone = dayHabits.length > 0 && dayHabits.every(c => d.checks?.[c.key]?.done);
            if (allDone) count++;
            else break;
        }
        // If today is also fully done, add it too
        const todayData = history[history.length - 1];
        if (todayData && count > 0) {
            const todayHabits = todayData.day != null ? checkDefs : checkDefs.filter(c => !hard75Keys.has(c.key));
            const todayAllDone = todayHabits.length > 0 && todayHabits.every(c => getCheck(c.key).done);
            if (todayAllDone) count++;
        }
        return count;
    })();

    // ── Per-habit streak calculation ──
    const perHabitStreak = (key: string): number => {
        if (!history?.length || history.length < 2) return 0;
        let count = 0;
        for (let i = history.length - 2; i >= 0; i--) {
            const d = history[i];
            // Skip days where this habit wasn't applicable (75 Hard habits on non-challenge days)
            if (d.day == null && hard75Keys.has(key)) continue;
            if (d.checks?.[key]?.done) count++;
            else break;
        }
        // If today is also done, add it
        if (count > 0 && getCheck(key).done) count++;
        return count;
    };

    const hard75Defs = checkDefs.filter(c => hard75Keys.has(c.key));
    const generalDefs = checkDefs.filter(c => !hard75Keys.has(c.key));

    // Current hour in AEST for urgency emojis
    const melbourneHour = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Melbourne', hour: 'numeric', hour12: false });
    const currentHour = parseInt(melbourneHour, 10);

    const renderItem = (c: typeof checkDefs[0]) => {
        const item = getCheck(c.key);
        const done = item.done;
        const habitStreak = perHabitStreak(c.key);

        // Snapchat-style urgency: if past 3pm and streak at risk
        let urgencyEmoji = '';
        if (habitStreak > 0 && !done && currentHour >= 15) {
            if (currentHour >= 21) urgencyEmoji = '💀';
            else if (currentHour >= 18) urgencyEmoji = '⌛';
            else urgencyEmoji = '⏳';
        }

        return (
            <li key={c.key} className={styles.habitItem} onClick={() => openModal(c.key, c.icon, c.label)}
                style={{ cursor: 'pointer' }} title="Click to update">
                <div className={`${styles.habitCheck} ${done ? styles.habitDone : ''}`}>
                    {done && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L4 7L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </div>
                <span className={`${styles.habitName} ${done ? styles.habitNameDone : ''}`}>{c.icon} {c.label}</span>
                {item.time && <span className={styles.streak}>{item.time}</span>}
                {habitStreak > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: urgencyEmoji ? '#c07070' : '#e8973a', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                        {urgencyEmoji || '🔥'} {habitStreak}
                    </span>
                )}
                {urgencyEmoji && !done && (
                    <span style={{ fontSize: 9, color: '#c07070', fontWeight: 600 }}>streak at risk!</span>
                )}
                <span className={styles.kanbanEdit}>✎</span>
            </li>
        );
    };

    return (
        <>
            {modal && (
                <HabitModal state={modal} date={data.date} onClose={() => setModal(null)} onSave={handleSave} />
            )}
            <div className={styles.widget}>
                {/* Header: progress ring + title + streak */}
                <div className={styles.kanbanHeader}>
                    <ProgressRing done={doneCount} total={activeDefs.length} />
                    <div style={{ flex: 1 }}>
                        <div className={styles.widgetTitle}><span className={styles.widgetIcon}>◈</span>Habits</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                            {isChallenge ? `Day ${data.day} of 75 Hard` : 'Daily tracking'}
                        </div>
                    </div>
                    {streak > 0 && (
                        <div className={styles.streakBadge}>
                            <span className={styles.streakFire}>🔥</span>
                            <span className={styles.streakCount}>{streak}</span>
                            <span className={styles.streakLabel}>day{streak !== 1 ? 's' : ''}</span>
                        </div>
                    )}
                </div>

                {/* Progress bar */}
                <div className={styles.habitProgress}>
                    <div className={styles.habitBar} style={{ width: `${pct}%`, background: pct === 100 ? '#5a9a5a' : undefined }} />
                </div>

                {/* 75 Hard section — only if challenge day */}
                {isChallenge && (
                    <div>
                        <div className={styles.sectionLabel}>75 Hard</div>
                        <ul className={styles.habitList}>{hard75Defs.map(renderItem)}</ul>
                    </div>
                )}

                {/* General section */}
                <div>
                    <div className={styles.sectionLabel}>{isChallenge ? 'General' : 'Habits'}</div>
                    <ul className={styles.habitList}>{generalDefs.map(renderItem)}</ul>
                </div>

                {/* Weekly heatmap */}
                {history && history.length > 1 && <WeeklyHeatmap history={history} />}

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                    <span>{doneCount}/{activeDefs.length} complete</span>
                    {isChallenge && data.finish_confidence != null && (
                        <span>Confidence: <strong style={{ color: data.finish_confidence >= 80 ? '#6db86d' : '#c9a84c' }}>{data.finish_confidence}%</strong></span>
                    )}
                </div>
            </div>
        </>
    );
}

// ─── Tasks Widget ──────────────────────────────────────────────────────────────
function TasksWidget({ data }: { data: DashboardData['tasks'] }) {
    const [completions, setCompletions] = useState<Set<string>>(new Set());
    const [metaMap, setMetaMap] = useState<Map<string, { priority: string | null; due_date: string | null; waiting_on: string | null; context: string | null; parent_task: string | null }>>(new Map());
    const [saving, setSaving] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        fetch('/api/dashboard/tasks')
            .then(r => r.json())
            .then(d => {
                if (d.error) console.error('[TasksWidget] API error:', d.error);
                setCompletions(new Set((d.completions ?? []).map((c: { task_name: string }) => c.task_name)));
                const entries = (d.metadata ?? []).map((m: { task_name: string; priority: string | null; due_date: string | null; waiting_on: string | null; context: string | null; parent_task: string | null }) =>
                    [m.task_name, { priority: m.priority, due_date: m.due_date, waiting_on: m.waiting_on, context: m.context, parent_task: m.parent_task }] as const
                );
                setMetaMap(new Map(entries));
                setLoaded(true);
            })
            .catch(e => { console.error('[TasksWidget] fetch failed:', e); setLoaded(true); });
    }, []);

    const toggleTask = async (name: string, cat: string, done: boolean) => {
        setSaving(name);
        const action = done ? 'uncomplete' : 'complete';
        setCompletions(prev => { const n = new Set(prev); done ? n.delete(name) : n.add(name); return n; });
        try {
            const r = await fetch('/api/dashboard/tasks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task_name: name, category: cat, action }) });
            if (!r.ok) setCompletions(prev => { const n = new Set(prev); done ? n.add(name) : n.delete(name); return n; });
        } catch { setCompletions(prev => { const n = new Set(prev); done ? n.add(name) : n.delete(name); return n; }); }
        setSaving(null);
    };

    if (!data) return <EmptyWidget icon="◇" title="The Pile" message="Task data will appear after the next sync." />;

    const priCfg: Record<string, { color: string; score: number }> = {
        urgent: { color: '#c07070', score: 900 }, this_week: { color: '#c9a84c', score: 700 },
        this_month: { color: '#5a7a8a', score: 400 }, ongoing: { color: '#5a9a5a', score: 300 },
        someday: { color: 'var(--color-text-muted)', score: 50 },
    };

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });
    const today = new Date(todayStr + 'T00:00:00');
    const overdueMap = new Map(data.overdue_tasks?.map(t => [t.name, t]) ?? []);

    type Task = { name: string; cat: string; urgency: string; score: number; done: boolean; overdueDays: number; meta: typeof metaMap extends Map<string, infer V> ? V | null : never };
    const allTasks: Task[] = [];

    for (const [cat, d] of Object.entries(data.categories ?? {})) {
        for (const name of d.tasks ?? []) {
            const isDone = completions.has(name);
            const meta = metaMap.get(name) ?? null;
            const ov = overdueMap.get(name);
            const dueStr = meta?.due_date ?? ov?.due ?? null;
            const dueDate = dueStr ? new Date(dueStr + 'T00:00:00') : null;
            const overdueDays = dueDate && dueDate < today ? Math.ceil((today.getTime() - dueDate.getTime()) / 86400000) : 0;

            if (meta?.parent_task) continue;

            let urgency = 'backlog', score = 100;
            if (isDone) { urgency = 'done'; score = -1; }
            else if (meta?.waiting_on) { urgency = 'waiting'; score = 10; }
            else if (overdueDays > 0) { urgency = 'overdue'; score = 1000 + overdueDays; }
            else if (meta?.priority && priCfg[meta.priority]) { urgency = meta.priority; score = priCfg[meta.priority].score; }
            else if (overdueMap.has(name)) { urgency = 'overdue'; score = 1000; }

            allTasks.push({ name, cat, urgency, score, done: isDone, overdueDays, meta });
        }
    }

    // Include completed tasks not in snapshot categories (Done section tasks, etc.)
    const taskNames = new Set(allTasks.map(t => t.name));
    for (const name of completions) {
        if (!taskNames.has(name)) {
            allTasks.push({ name, cat: 'Completed', urgency: 'done', score: -1, done: true, overdueDays: 0, meta: null });
        }
    }

    allTasks.sort((a, b) => b.score - a.score);

    const openTasks = allTasks.filter(t => !t.done);
    const doneTasks = allTasks.filter(t => t.done);
    const visible = openTasks.slice(0, 12);
    const remaining = openTasks.length - visible.length;

    const sectionLabel = (urgency: string) => {
        const labels: Record<string, { label: string; color: string }> = {
            overdue: { label: 'OVERDUE', color: '#c07070' }, urgent: { label: 'URGENT', color: '#c07070' },
            this_week: { label: 'THIS WEEK', color: '#c9a84c' }, this_month: { label: 'THIS MONTH', color: '#5a7a8a' },
            ongoing: { label: 'ONGOING', color: '#5a9a5a' }, waiting: { label: 'WAITING ON', color: '#c9a84c' },
            backlog: { label: 'BACKLOG', color: 'var(--color-text-muted)' },
        };
        return labels[urgency] ?? { label: urgency.toUpperCase(), color: 'var(--color-text-muted)' };
    };

    let lastUrgency = '';

    return (
        <div className={styles.widget}>
            <div className={styles.widgetHeader}>
                <div className={styles.widgetTitle}><span className={styles.widgetIcon}>⚡</span>The Pile</div>
                <span className={styles.widgetBadge}>{openTasks.length} open{loaded && doneTasks.length > 0 ? ` · ${doneTasks.length} ✓` : ''}</span>
            </div>

            <ul className={styles.priorityList}>
                {visible.map(t => {
                    const showHeader = t.urgency !== lastUrgency;
                    lastUrgency = t.urgency;
                    const sec = sectionLabel(t.urgency);
                    return (
                        <div key={t.name}>
                            {showHeader && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-2) 2px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: sec.color, borderBottom: `1px solid ${sec.color}33`, marginTop: 'var(--space-2)' }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: sec.color, flexShrink: 0 }} />
                                    {sec.label}
                                </div>
                            )}
                            <li className={styles.priorityItem}>
                                <button
                                    className={`${styles.taskCheck} ${t.done ? styles.taskCheckDone : ''}`}
                                    onClick={() => toggleTask(t.name, t.cat, t.done)}
                                    disabled={saving === t.name}
                                    style={{ width: 16, height: 16 }}
                                >
                                    {t.done && <svg width="8" height="6" viewBox="0 0 10 8" fill="none"><path d="M1 4L4 7L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                </button>
                                <span className={styles.priorityName} style={{ fontSize: 'var(--text-xs)' }}>{t.name}</span>
                                <span className={styles.priorityCat} style={{ color: catColors[t.cat] ?? 'var(--color-text-muted)' }}>{t.cat}</span>
                                {t.urgency === 'overdue' && <span style={{ fontSize: 9, fontWeight: 700, color: '#c07070' }}>{t.overdueDays}d</span>}
                                {t.meta?.waiting_on && <span style={{ fontSize: 9, color: '#c9a84c' }}>⏳</span>}
                            </li>
                        </div>
                    );
                })}
            </ul>

            {loaded && doneTasks.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', marginTop: 'var(--space-2)', background: 'rgba(90,154,90,0.08)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)', color: '#5a9a5a' }}>
                    <span style={{ fontWeight: 700 }}>✓ {doneTasks.length} completed</span>
                    <span style={{ color: 'var(--color-text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {doneTasks.slice(0, 3).map(t => t.name).join(', ')}{doneTasks.length > 3 ? '…' : ''}
                    </span>
                </div>
            )}

            {remaining > 0 && (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: 'var(--space-3)', maxWidth: 'none' }}>+{remaining} more</p>
            )}

            <a href="/dashboard/tasks" className={styles.widgetLink} style={{ display: 'block', textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-3)', textDecoration: 'none' }}>
                View all →
            </a>
        </div>
    );
}


// ─── Calendar Widget (today's events) ──────────────────────────────────────────
function CalendarWidget() {
    const [events, setEvents] = useState<{ id: string; title: string; start_time: string; end_time: string; all_day: boolean; source: string; source_id: string | null; account: string | null }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/dashboard/calendar')
            .then(r => r.json())
            .then(d => { setEvents(d.events ?? []); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });
    const todayEvents = events
        .filter(e => {
            const s = new Date(e.start_time).toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });
            return s === todayStr;
        })
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-AU', { timeZone: 'Australia/Melbourne', hour: '2-digit', minute: '2-digit', hour12: false });

    const colorMap: Record<string, { bg: string; border: string }> = {
        personal: { bg: 'rgba(90,130,200,0.08)', border: '#5a82c8' },
        business: { bg: 'rgba(201,168,76,0.08)', border: '#c9a84c' },
        task: { bg: 'rgba(193,127,58,0.08)', border: '#c17f3a' },
        habit: { bg: 'rgba(90,154,90,0.08)', border: '#5a9a5a' },
    };
    const getColor = (ev: typeof events[0]) => colorMap[ev.account ?? ev.source] ?? colorMap.personal;

    // Habit keyword matching (mirrors calendar page logic)
    const WIDGET_HABITS = [
        { icon: '🏃', label: 'Outdoor Workout', keywords: ['walk', 'outdoor', 'run', 'hike', 'park', 'jog'] },
        { icon: '💪', label: '2nd Workout', keywords: ['workout', 'gym', 'muay', 'thai', 'mma', 'exercise', 'train', 'pt', 'mobility'] },
        { icon: '🥗', label: 'Whole Foods', keywords: ['lunch', 'dinner', 'meal', 'food', 'eat'] },
        { icon: '📖', label: '10 Pages', keywords: ['read', 'reading', 'book'] },
        { icon: '😴', label: 'Bedtime', keywords: ['sleep', 'bed', 'chamomile', 'wind'] },
        { icon: '☀️', label: 'Wake', keywords: ['wake', 'morning'] },
    ];
    const matchHabits = (title: string) => {
        const lower = title.toLowerCase();
        return WIDGET_HABITS.filter(h => h.keywords.some(k => lower.includes(k)));
    };

    const currentMins = now.getHours() * 60 + now.getMinutes();

    if (loading) return <EmptyWidget icon="▦" title="Today" message="Loading events…" />;
    if (!todayEvents.length) return <EmptyWidget icon="▦" title="Today" message="No events scheduled for today." />;

    return (
        <div className={styles.widget}>
            <div className={styles.widgetHeader}>
                <div className={styles.widgetTitle}><span className={styles.widgetIcon}>▦</span>Today</div>
                <span className={styles.widgetBadge}>{todayEvents.length} event{todayEvents.length !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {todayEvents.slice(0, 8).map(ev => {
                    const c = getColor(ev);
                    const startMins = new Date(ev.start_time).getHours() * 60 + new Date(ev.start_time).getMinutes();
                    const endMins = new Date(ev.end_time).getHours() * 60 + new Date(ev.end_time).getMinutes();
                    const isPast = endMins < currentMins;
                    const isNow = startMins <= currentMins && currentMins < endMins;
                    const taskNames = ev.source_id ? ev.source_id.split(',').map(s => s.trim()).filter(Boolean) : [];
                    const matchedHabits = matchHabits(ev.title);
                    return (
                        <div key={ev.id} style={{
                            display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                            padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                            borderLeft: `3px solid ${c.border}`, background: isNow ? c.bg : 'transparent',
                            opacity: isPast ? 0.5 : 1, transition: 'opacity 0.2s',
                        }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)', minWidth: 38, fontVariantNumeric: 'tabular-nums' }}>
                                {ev.all_day ? 'All day' : fmtTime(ev.start_time)}
                            </span>
                            <span style={{ fontSize: 'var(--text-xs)', fontWeight: isNow ? 700 : 500, color: isNow ? c.border : 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                {ev.title}
                            </span>
                            {taskNames.length > 0 && <span style={{ fontSize: 10, flexShrink: 0, cursor: 'default' }} title={`📋 ${taskNames.join(', ')}`}>📋</span>}
                            {matchedHabits.map(h => <span key={h.label} style={{ fontSize: 10, flexShrink: 0, cursor: 'default' }} title={h.label}>{h.icon}</span>)}
                            {isNow && <span style={{ fontSize: 8, fontWeight: 700, color: c.border, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>NOW</span>}
                            {!ev.all_day && !isNow && (
                                <span style={{ fontSize: 9, color: 'var(--color-text-muted)', flexShrink: 0 }}>
                                    {Math.round((new Date(ev.end_time).getTime() - new Date(ev.start_time).getTime()) / 60000)}m
                                </span>
                            )}
                        </div>
                    );
                })}
                {todayEvents.length > 8 && (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-1)' }}>+{todayEvents.length - 8} more</span>
                )}
            </div>
            <a href="/dashboard/calendar" className={styles.widgetLink} style={{ display: 'block', textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-3)', textDecoration: 'none' }}>
                View calendar →
            </a>
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
    const [mounted, setMounted] = useState(false);
    // null = not yet loaded; number = index into hard75History
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

    useEffect(() => {
        setMounted(true);
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

    // Defer Date rendering to client-only to prevent hydration mismatch (server=UTC, client=AEST)
    const today = mounted ? new Date() : null;
    const greeting = today
        ? (today.getHours() < 12 ? 'Good morning' : today.getHours() < 17 ? 'Good afternoon' : 'Good evening')
        : 'Welcome';

    const lastSyncedLabel = data?.lastSynced && mounted
        ? `Synced ${new Date(data.lastSynced).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })} at ${new Date(data.lastSynced).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}`
        : 'Not yet synced';

    const [menuOpen, setMenuOpen] = useState(false);
    const navLinks = [
        { icon: '◉', label: 'Overview', href: '/dashboard', active: true },
        { icon: '◎', label: 'Health', href: '/dashboard/health' },
        { icon: '◈', label: 'Habits', href: '/dashboard/habits' },
        { icon: '◇', label: 'Tasks', href: '/dashboard/tasks' },
        { icon: '▦', label: 'Calendar', href: '/dashboard/calendar' },
        { icon: '⬡', label: '75 Hard', href: '/dashboard/75-hard' },
    ];

    return (
        <div className={styles.shell}>
            {/* Mobile hamburger */}
            <button
                className={styles.hamburger}
                onClick={() => setMenuOpen(o => !o)}
                aria-label="Toggle menu"
            >
                <span className={styles.hamburgerBar} style={menuOpen ? { transform: 'rotate(45deg) translate(4px,4px)' } : undefined} />
                <span className={styles.hamburgerBar} style={menuOpen ? { opacity: 0 } : undefined} />
                <span className={styles.hamburgerBar} style={menuOpen ? { transform: 'rotate(-45deg) translate(4px,-4px)' } : undefined} />
            </button>

            {/* Mobile overlay */}
            {menuOpen && (
                <div className={styles.mobileOverlay} onClick={() => setMenuOpen(false)}>
                    <nav className={styles.mobileMenu} onClick={e => e.stopPropagation()}>
                        <div className={styles.mobileMenuHeader}>
                            <div className={styles.logoMark}>LN</div>
                            <button className={styles.mobileMenuClose} onClick={() => setMenuOpen(false)}>✕</button>
                        </div>
                        {navLinks.map(({ icon, label, href, active }) => (
                            <a key={href} href={href}
                                className={`${styles.mobileNavLink} ${active ? styles.mobileNavActive : ''}`}
                                onClick={() => setMenuOpen(false)}
                            >
                                <span style={{ fontSize: 18 }}>{icon}</span>
                                <span>{label}</span>
                            </a>
                        ))}
                        <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                            <a href="/" className={styles.mobileNavLink} style={{ color: 'var(--color-text-muted)' }}>← Public site</a>
                            <button className={styles.mobileNavLink} style={{ color: '#c07070', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', font: 'inherit' }} onClick={handleSignOut}>Sign out</button>
                        </div>
                    </nav>
                </div>
            )}

            {/* Sidebar */}
            <aside className={styles.sidebar}>
                <div className={styles.sidebarLogo}>
                    <div className={styles.logoMark}>LN</div>
                </div>
                <nav className={styles.sidebarNav}>
                    {navLinks.map(({ icon, label, href, active }) => (
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
                            {today ? today.toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : ''}
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
                        🔗 Not yet synced — data will appear after the next sync.
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
                            <HabitsWidget data={selectedIdx !== null ? data.hard75History[selectedIdx] : null} history={data.hard75History} />
                        </div>

                        {/* Recent Tasks Snapshot */}
                        <div className={styles.gridItem}>
                            <TasksWidget data={data.tasks} />
                        </div>

                        {/* Today's Events */}
                        <div className={styles.gridItem}>
                            <CalendarWidget />
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
