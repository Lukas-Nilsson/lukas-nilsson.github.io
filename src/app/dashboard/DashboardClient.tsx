'use client';

import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AreaChart, BarChart, LineChart } from '@/components/charts/Charts';
import WeatherHeader from './components/WeatherHeader';
import styles from './dashboard.module.css';

interface Props { user: User; }

interface HabitDefinition {
    habit_id: string;
    label: string;
    icon: string;
    tracking_start: string;
    show_time: boolean;
    show_notes: boolean;
    default_to_now: boolean;
    sort_order: number;
}

interface DashboardData {
    whoop: { date: string; recovery: number; hrv: number; rhr: number; strain: number; sleep_hours: number; sleep_performance: number } | null;
    whoopHistory: { date: string; recovery: number; hrv: number; strain: number; sleep_hours: number; sleep_performance: number }[];
    habitHistory: { date: string; checks: Record<string, { done: boolean; time: string | null }>; discipline_score: number }[];
    habitDefinitions?: HabitDefinition[];
    tasks: {
        updated_at: string; total_open: number; total_done: number;
        categories: Record<string, { open: number; done: number; tasks: string[]; overdue: { name: string; due: string }[] }>;
        overdue_tasks: { name: string; due: string; category: string }[];
        history: { date: string; open: number; done: number; completed?: number; added?: number; removed?: number }[];
    } | null;
    sleep: { date: string; performance: number; hours_in_bed: number; deep: number; rem: number; light: number }[];
    lastSynced: string | null;
    todayAEST: string;
}

// Fallback check definitions — used when API hasn't returned habitDefinitions yet
const FALLBACK_CHECK_DEFS = [
    { key: 'teeth', icon: '🦷', label: 'Brush Teeth' },
    { key: 'bedtime', icon: '🌙', label: 'In Bed by 11pm' },
    { key: 'wake', icon: '🌅', label: 'Up by 7am' },
    { key: 'phone_down', icon: '📱', label: 'Phone Down', target: '11:30pm' },
    { key: 'meditation', icon: '🧘', label: 'Meditation' },
    { key: 'hydration', icon: '💧', label: 'Hydration' },
];

// Build checkDefs from API habitDefinitions (with fallback)
// Filters by tracking_start <= date so old habits (like 75 Hard) don't show on current days
function buildCheckDefs(defs?: HabitDefinition[], forDate?: string) {
    if (!defs?.length) return FALLBACK_CHECK_DEFS;
    const today = forDate ?? new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });
    return defs
        .filter(d => d.tracking_start <= today)
        .map(d => ({ key: d.habit_id, icon: d.icon, label: d.label }));
}

// Default export for components that use checkDefs outside DashboardClient
let checkDefs = FALLBACK_CHECK_DEFS;

const catColors: Record<string, string> = {
    Wedding: '#a07040', THA: '#7a5030', Home: '#8a7a5a',
    Fitness: '#5a8a5a', Finance: '#5a7a8a', Personal: '#7a5a8a', Dev: '#8a5a5a',
    Uncategorized: '#6a6a6a',
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
const habitFields: Record<string, { showTime: boolean; showDescription: boolean; showNotes: boolean; timePlaceholder?: string; defaultToNow?: boolean }> = {
    teeth: { showTime: false, showDescription: false, showNotes: false },
    bedtime: { showTime: true, showDescription: false, showNotes: false, timePlaceholder: 'e.g. 22:45' },
    wake: { showTime: true, showDescription: false, showNotes: false, timePlaceholder: 'e.g. 06:30' },
    phone_down: { showTime: true, showDescription: false, showNotes: false, timePlaceholder: 'e.g. 23:30', defaultToNow: true },
    meditation: { showTime: true, showDescription: false, showNotes: true, timePlaceholder: 'Duration e.g. 10 min', defaultToNow: true },
    hydration: { showTime: false, showDescription: false, showNotes: true },
};

// Helper: get current Melbourne time as HH:MM
function getMelbourneTime(): string {
    return new Date().toLocaleTimeString('en-AU', { timeZone: 'Australia/Melbourne', hour: '2-digit', minute: '2-digit', hour12: false });
}

// ─── Habit ID mapping (UI key → habit_id) ────────────────────────────────
const habitIdMap: Record<string, string> = {
    teeth: 'teeth',
    bedtime: 'bedtime',
    wake: 'wake',
    phone_down: 'phone_down',
    meditation: 'meditation',
    hydration: 'hydration',
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

    const handleMarkDone = () => {
        const newDone = !done;
        setDone(newDone);
        // Auto-fill time with current Melbourne time when marking done
        if (newDone && fields.showTime && (fields.defaultToNow || !time)) {
            setTime(getMelbourneTime());
        }
    };

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

                {/* Done button */}
                <button
                    onClick={handleMarkDone}
                    style={{
                        width: '100%', padding: 'var(--space-3)', borderRadius: 'var(--radius)',
                        border: `2px solid ${done ? 'rgba(90,154,90,0.5)' : 'rgba(180,80,80,0.3)'}`,
                        background: done ? 'rgba(90,154,90,0.12)' : 'rgba(180,80,80,0.06)',
                        color: done ? '#6db86d' : 'var(--color-text-muted)',
                        cursor: 'pointer', fontWeight: 700, fontSize: 'var(--text-base)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
                        transition: 'all 0.2s ease', marginBottom: 'var(--space-4)',
                    }}
                >
                    {done ? (
                        <><svg width="14" height="11" viewBox="0 0 14 11" fill="none"><path d="M1 5.5L5 9.5L13 1" stroke="#6db86d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg> Done{time && fields.showTime ? ` at ${time}` : ''}</>
                    ) : (
                        <>✓ Mark Done</>
                    )}
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {fields.showTime && (
                        <div>
                            <span style={label}>Time</span>
                            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                                <input
                                    style={{ ...input, flex: 1 }}
                                    type="time"
                                    value={time}
                                    onChange={e => setTime(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setTime(getMelbourneTime())}
                                    style={{
                                        padding: 'var(--space-2) var(--space-3)',
                                        borderRadius: 'var(--radius)',
                                        border: '1px solid var(--color-border)',
                                        background: 'var(--color-bg)',
                                        color: 'var(--accent-400)',
                                        cursor: 'pointer', fontSize: 'var(--text-xs)',
                                        fontWeight: 600, whiteSpace: 'nowrap',
                                    }}
                                >Now</button>
                            </div>
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
function WeeklyHeatmap({ history }: { history: DashboardData['habitHistory'] }) {
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
function HabitsWidget({ data, history }: { data: DashboardData['habitHistory'][0] | null; history?: DashboardData['habitHistory'] }) {
    const [overrides, setOverrides] = useState<Record<string, { done: boolean; time: string | null }>>({})
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

    const doneCount = checkDefs.filter(c => getCheck(c.key).done).length;
    const pct = checkDefs.length > 0 ? Math.round((doneCount / checkDefs.length) * 100) : 0;

    // Calculate overall streak — skip today (not yet complete), count from yesterday back
    const streak = (() => {
        if (!history?.length || history.length < 2) return 0;
        let count = 0;
        for (let i = history.length - 2; i >= 0; i--) {
            const d = history[i];
            const allDone = checkDefs.length > 0 && checkDefs.every(c => d.checks?.[c.key]?.done);
            if (allDone) count++;
            else break;
        }
        // If today is also fully done, add it too
        const todayData = history[history.length - 1];
        if (todayData && count > 0) {
            const todayAllDone = checkDefs.length > 0 && checkDefs.every(c => getCheck(c.key).done);
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
            if (d.checks?.[key]?.done) count++;
            else break;
        }
        // If today is also done, add it
        if (count > 0 && getCheck(key).done) count++;
        return count;
    };

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
                    <ProgressRing done={doneCount} total={checkDefs.length} />
                    <div style={{ flex: 1 }}>
                        <div className={styles.widgetTitle}><span className={styles.widgetIcon}>◈</span>Habits</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                            Daily tracking
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

                {/* Habits */}
                <div>
                    <ul className={styles.habitList}>{checkDefs.map(renderItem)}</ul>
                </div>

                {/* Weekly heatmap */}
                {history && history.length > 1 && <WeeklyHeatmap history={history} />}

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                    <span>{doneCount}/{checkDefs.length} complete</span>
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
        { icon: '🦷', label: 'Brush Teeth', keywords: ['teeth', 'brush', 'floss'] },
        { icon: '😴', label: 'Bedtime', keywords: ['sleep', 'bed', 'chamomile', 'wind'] },
        { icon: '☀️', label: 'Wake', keywords: ['wake', 'morning'] },
        { icon: '📱', label: 'Phone Down', keywords: ['phone'] },
        { icon: '🧘', label: 'Meditation', keywords: ['meditat', 'mindful', 'breathe', 'calm'] },
        { icon: '💧', label: 'Hydration', keywords: ['water', 'hydrat', 'drink'] },
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
                            {taskNames.length > 0 && (
                                <span className="tip-wrap" style={{ fontSize: 10, flexShrink: 0 }}>
                                    📋<span className="tip-label">{taskNames.join(', ')}</span>
                                </span>
                            )}
                            {matchedHabits.map(h => (
                                <span key={h.label} className="tip-wrap" style={{ fontSize: 10, flexShrink: 0 }}>
                                    {h.icon}<span className="tip-label">{h.label}</span>
                                </span>
                            ))}
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

// ─── Morning Brief Widget ────────────────────────────────────────────────────
interface SavedBriefItem { icon: string; text: string; color?: string; accent?: boolean; type: string }

function MorningBriefWidget({ data, selectedDate }: { data: DashboardData; selectedDate?: string }) {
    const [expanded, setExpanded] = useState(false);
    const [emails, setEmails] = useState<{ subject: string; from: string; url: string; unread: boolean }[]>([]);
    const [savedBrief, setSavedBrief] = useState<{ items: SavedBriefItem[]; emails: { subject: string; from: string; url: string }[] } | null>(null);
    const [briefSaved, setBriefSaved] = useState(false);

    const todayAEST = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });
    const isToday = !selectedDate || selectedDate === todayAEST;
    const isPast = selectedDate && selectedDate < todayAEST;

    const todayHabits = data.habitHistory?.[data.habitHistory.length - 1];
    const whoop = data.whoop;
    const tasks = data.tasks;
    const history = data.habitHistory ?? [];

    // For past dates: load saved brief
    useEffect(() => {
        if (isPast && selectedDate) {
            fetch(`/api/dashboard/brief?date=${selectedDate}`)
                .then(r => r.json())
                .then(d => { if (d.brief) setSavedBrief(d.brief); else setSavedBrief(null); })
                .catch(() => setSavedBrief(null));
        } else {
            setSavedBrief(null);
        }
    }, [isPast, selectedDate]);

    // Fetch emails on mount (only for today)
    useEffect(() => {
        if (!isToday) return;
        fetch('/api/dashboard/emails')
            .then(r => r.json())
            .then(d => { if (d.emails?.length) setEmails(d.emails.slice(0, 3)); })
            .catch(() => { });
    }, [isToday]);

    // Recovery context
    const recovery = whoop?.recovery ?? null;
    const recoveryLevel = recovery !== null ? (recovery >= 67 ? 'green' : recovery >= 34 ? 'yellow' : 'red') : null;
    const recoveryAdvice: Record<string, string> = {
        green: 'High recovery — great day for intense work & training',
        yellow: 'Moderate recovery — pace yourself today',
        red: 'Low recovery — prioritize rest and light activity',
    };
    const recoveryColors: Record<string, { bg: string; border: string; text: string }> = {
        green: { bg: 'rgba(90,154,90,0.08)', border: 'rgba(90,154,90,0.25)', text: '#6db86d' },
        yellow: { bg: 'rgba(201,168,76,0.08)', border: 'rgba(201,168,76,0.25)', text: '#c9a84c' },
        red: { bg: 'rgba(192,112,112,0.08)', border: 'rgba(192,112,112,0.25)', text: '#c07070' },
    };

    // Overdue tasks
    const overdueTasks = tasks?.overdue_tasks?.slice(0, 3) ?? [];
    const overdueCount = tasks?.overdue_tasks?.length ?? 0;

    // Streaks at risk
    const streaksAtRisk: { label: string; icon: string; streak: number }[] = [];
    if (todayHabits && history.length >= 2) {
        for (const c of checkDefs) {
            if (todayHabits.checks?.[c.key]?.done) continue;
            let count = 0;
            for (let i = history.length - 2; i >= 0; i--) {
                if (history[i].checks?.[c.key]?.done) count++;
                else break;
            }
            if (count > 0) streaksAtRisk.push({ label: c.label, icon: c.icon, streak: count });
        }
    }

    const todayDone = todayHabits ? checkDefs.filter(c => todayHabits.checks?.[c.key]?.done).length : 0;
    const todayTotal = checkDefs.length;

    const melbourneHour = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Melbourne', hour: 'numeric', hour12: false });
    const hour = parseInt(melbourneHour, 10);
    const timeIcon = hour < 12 ? '☀️' : hour < 17 ? '⛅' : '🌙';

    // Build items — primary items always visible, secondary toggled
    const primaryItems: { icon: string; text: string; color?: string; accent?: boolean }[] = [];
    const secondaryItems: { icon: string; text: string; color?: string }[] = [];

    if (recoveryLevel) {
        primaryItems.push({ icon: '❤️', text: `Recovery ${recovery}% — ${recoveryAdvice[recoveryLevel]}`, color: recoveryColors[recoveryLevel].text, accent: true });
    }

    primaryItems.push({ icon: '✅', text: `${todayDone}/${todayTotal} habits done today` });

    if (overdueCount > 0) {
        const names = overdueTasks.map(t => t.name).join(', ');
        secondaryItems.push({ icon: '⚠️', text: `${overdueCount} overdue: ${names}`, color: '#c07070' });
    }

    if (streaksAtRisk.length > 0) {
        const riskText = streaksAtRisk.map(s => `${s.icon} ${s.label} (🔥${s.streak})`).join(', ');
        secondaryItems.push({ icon: '💀', text: `Streaks at risk: ${riskText}`, color: '#e8973a' });
    }

    if (tasks) {
        secondaryItems.push({ icon: '📝', text: `${tasks.total_open} tasks open, ${tasks.total_done} completed` });
    }

    // Email items
    if (emails.length > 0) {
        secondaryItems.push({ icon: '📧', text: `${emails.length} important email${emails.length > 1 ? 's' : ''}:`, color: '#7a9ec9' });
    }

    // Auto-save today's brief (ref-based to avoid unstable deps)
    const briefDataRef = useRef({ primaryItems, secondaryItems, emails });
    briefDataRef.current = { primaryItems, secondaryItems, emails };

    useEffect(() => {
        if (!isToday || briefSaved) return;
        const timeout = setTimeout(() => {
            const { primaryItems: pi, secondaryItems: si, emails: em } = briefDataRef.current;
            const allItems = [...pi.map((i: { icon: string; text: string; color?: string; accent?: boolean }) => ({ ...i, type: 'primary' })), ...si.map((i: { icon: string; text: string; color?: string }) => ({ ...i, type: 'secondary' }))];
            if (allItems.length === 0) return;
            fetch('/api/dashboard/brief', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: todayAEST,
                    items: allItems,
                    emails: em.map((e: { subject: string; from: string; url: string }) => ({ subject: e.subject, from: e.from, url: e.url })),
                }),
            }).then(() => setBriefSaved(true)).catch(() => { });
        }, 3000); // 3s debounce to let all data settle
        return () => clearTimeout(timeout);
    }, [isToday, briefSaved, todayAEST]);

    // For past dates with saved brief, use saved data
    const displayPrimary = isPast && savedBrief ? savedBrief.items.filter(i => i.type === 'primary') : primaryItems;
    const displaySecondary = isPast && savedBrief ? savedBrief.items.filter(i => i.type === 'secondary') : secondaryItems;
    const displayEmails = isPast && savedBrief ? savedBrief.emails ?? [] : emails;

    const hasMore = displaySecondary.length > 0 || displayEmails.length > 0;

    const renderItem = (item: { icon: string; text: string; color?: string; accent?: boolean }, i: number) => {
        const isAccent = item.accent && recoveryLevel;
        const accentStyle = isAccent ? recoveryColors[recoveryLevel!] : null;
        return (
            <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)',
                fontSize: 'var(--text-sm)', lineHeight: 1.5,
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius)',
                background: accentStyle?.bg ?? 'transparent',
                borderLeft: accentStyle ? `3px solid ${accentStyle.border}` : '3px solid transparent',
                transition: 'all 0.2s ease',
            }}>
                <span style={{ flexShrink: 0, width: 22, textAlign: 'center', fontSize: 15 }}>{item.icon}</span>
                <span style={{ color: item.color ?? 'var(--color-text)', fontWeight: isAccent ? 600 : 400 }}>{item.text}</span>
            </div>
        );
    };

    return (
        <div className={styles.widget} style={{ cursor: hasMore ? 'pointer' : undefined }} onClick={() => hasMore && setExpanded(e => !e)}>
            <div className={styles.widgetHeader}>
                <div className={styles.widgetTitle}>
                    <span className={styles.widgetIcon}>{timeIcon}</span>
                    Daily Brief
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span className={styles.widgetBadge}>{selectedDate ?? data.todayAEST}</span>
                    {isPast && savedBrief && <span style={{ fontSize: 9, color: 'var(--color-text-muted)', opacity: 0.6 }}>(saved)</span>}
                    {isPast && !savedBrief && <span style={{ fontSize: 9, color: 'var(--color-text-muted)', opacity: 0.6 }}>(no data)</span>}
                    {hasMore && (
                        <span style={{
                            fontSize: 12, color: 'var(--color-text-muted)',
                            transition: 'transform 0.3s ease',
                            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            display: 'inline-block',
                        }}>▾</span>
                    )}
                </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                {displayPrimary.map(renderItem)}
                <div style={{
                    maxHeight: expanded ? `${(displaySecondary.length * 60) + (displayEmails.length * 50)}px` : '0px',
                    overflow: 'hidden',
                    transition: 'max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease',
                    opacity: expanded ? 1 : 0,
                    display: 'flex', flexDirection: 'column', gap: 'var(--space-1)',
                }}>
                    {displaySecondary.map((item, i) => renderItem(item, i + displayPrimary.length))}
                    {/* Email cards */}
                    {displayEmails.length > 0 && displayEmails.map((email, i) => (
                        <a
                            key={i}
                            href={(email as { url: string }).url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                                padding: 'var(--space-2) var(--space-3)',
                                borderRadius: 'var(--radius)',
                                background: 'rgba(122,158,201,0.06)',
                                borderLeft: '3px solid rgba(122,158,201,0.25)',
                                textDecoration: 'none', color: 'inherit',
                                transition: 'background 0.15s ease',
                                fontSize: 'var(--text-sm)',
                            }}
                        >
                            <span style={{ flexShrink: 0, width: 22, textAlign: 'center', fontSize: 15 }}>📧</span>
                            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                <span style={{ fontWeight: 600, color: '#7a9ec9', marginRight: 6 }}>{(email as { from: string }).from}</span>
                                <span style={{ color: 'var(--color-text-muted)' }}>{(email as { subject: string }).subject}</span>
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', flexShrink: 0, opacity: 0.6 }}>↗</span>
                        </a>
                    ))}
                </div>
                {hasMore && !expanded && (
                    <div style={{
                        fontSize: 'var(--text-xs)', color: 'var(--accent-400)',
                        textAlign: 'center', paddingTop: 'var(--space-1)', fontWeight: 500,
                    }}>
                        Tap for more • {displaySecondary.length} more items
                    </div>
                )}
            </div>
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
    // null = not yet loaded; number = index into habitHistory
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

    useEffect(() => {
        setMounted(true);
        fetch('/api/dashboard')
            .then(r => r.json())
            .then(d => {
                setData(d);
                // Override checkDefs with dynamic habit definitions from API
                if (d.habitDefinitions?.length) {
                    checkDefs = buildCheckDefs(d.habitDefinitions, d.todayAEST);
                }
                setLoading(false);
                // Default to today (not most recent / furthest future)
                if (d.habitHistory?.length) {
                    const todayIdx = d.habitHistory.findIndex((h: { date: string }) => h.date === d.todayAEST);
                    setSelectedIdx(prev => prev ?? (todayIdx >= 0 ? todayIdx : d.habitHistory.length - 1));
                }
            })
            .catch(() => setLoading(false));
    }, []);

    // ── Live polling: refresh every 60s ──
    useEffect(() => {
        if (!mounted) return;
        const interval = setInterval(() => {
            fetch('/api/dashboard')
                .then(r => r.json())
                .then(d => {
                    setData(d);
                    if (d.habitHistory?.length) {
                        setSelectedIdx(prev => prev ?? d.habitHistory.length - 1);
                    }
                })
                .catch(() => { });
        }, 60_000);
        return () => clearInterval(interval);
    }, [mounted]);

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

                    {!loading && data && (data.habitHistory?.length ?? 0) > 0 && selectedIdx !== null && (
                        <div className={styles.dayNav} style={{ background: 'var(--color-bg-secondary)', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', margin: '0 var(--space-4)' }}>
                            <button
                                className={styles.dayNavBtn}
                                onClick={() => setSelectedIdx(i => Math.max(0, (i ?? 0) - 1))}
                                disabled={selectedIdx === 0}
                            >‹</button>
                            <div style={{ textAlign: 'center', minWidth: 140 }}>
                                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text)' }}>
                                    {shortDate(data.habitHistory[selectedIdx].date)}
                                </div>
                                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>
                                    {(() => {
                                        const d = data.habitHistory[selectedIdx].date;
                                        if (d === data.todayAEST) return 'Today';
                                        const dateObj = new Date(d + 'T00:00:00');
                                        const todayObj = new Date(data.todayAEST + 'T00:00:00');
                                        const diffDays = Math.round((dateObj.getTime() - todayObj.getTime()) / (1000 * 60 * 60 * 24));
                                        if (diffDays === 1) return 'Tomorrow';
                                        if (diffDays > 1) return dateObj.toLocaleDateString('en-AU', { weekday: 'long' });
                                        if (diffDays === -1) return 'Yesterday';
                                        return 'Past';
                                    })()}
                                </div>
                            </div>
                            <button
                                className={styles.dayNavBtn}
                                onClick={() => setSelectedIdx(i => Math.min(data.habitHistory.length - 1, (i ?? 0) + 1))}
                                disabled={selectedIdx === data.habitHistory.length - 1}
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
                    // selectedIdx may still be null if habitHistory is empty
                    <div className={styles.grid}>
                        {/* Weather Header — full width */}
                        <div className={`${styles.gridItem} ${styles.gridItemFull}`}>
                            <WeatherHeader selectedDate={selectedIdx !== null ? data.habitHistory[selectedIdx].date : undefined} />
                        </div>

                        {/* Morning Brief — full width */}
                        <div className={`${styles.gridItem} ${styles.gridItemFull}`}>
                            <MorningBriefWidget data={data} selectedDate={selectedIdx !== null ? data.habitHistory[selectedIdx].date : undefined} />
                        </div>

                        {/* Whoop Status for selected day */}
                        <div className={`${styles.gridItem} ${styles.gridItemFull}`}>
                            <WhoopWidget
                                data={selectedIdx !== null ? (data.whoopHistory.find(h => h.date === data.habitHistory[selectedIdx].date) || null) : (data.whoopHistory[data.whoopHistory.length - 1] || null)}
                                todayAEST={data.todayAEST}
                                selectedDate={selectedIdx !== null ? data.habitHistory[selectedIdx].date : data.todayAEST}
                            />
                        </div>

                        {/* Habits for selected day */}
                        <div className={styles.gridItem}>
                            <HabitsWidget data={selectedIdx !== null ? data.habitHistory[selectedIdx] : null} history={data.habitHistory} />
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
                            <PileTrajectoryWidget data={data.tasks} selectedDate={selectedIdx !== null ? data.habitHistory[selectedIdx].date : data.todayAEST} />
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
