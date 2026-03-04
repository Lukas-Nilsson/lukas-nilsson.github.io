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
    { key: 'wake', icon: '🌅', label: 'Up by 7am' },
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
    const [time, setTime] = useState(state.time);
    const [desc, setDesc] = useState(state.description);
    const [notes, setNotes] = useState(state.notes);
    const [saving, setSaving] = useState(false);
    const fields = habitFields[state.key] ?? { showTime: false, showDescription: false, showNotes: true };

    const handleSave = async () => {
        setSaving(true);
        const value = [desc, time].filter(Boolean).join(' @ ') || null;
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
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    };
    const modal: React.CSSProperties = {
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-6)',
        width: '100%', maxWidth: 420,
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
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
                    {fields.showDescription && (
                        <div>
                            <span style={label}>Activity / Description</span>
                            <input style={input} type="text" placeholder="e.g. Morning run 5km, Soccer match…" value={desc} onChange={e => setDesc(e.target.value)} />
                        </div>
                    )}
                    {fields.showNotes && (
                        <div>
                            <span style={label}>Notes</span>
                            <textarea style={{ ...input, resize: 'vertical', minHeight: 72, fontFamily: 'inherit' }} placeholder="Extra context, how it felt…" value={notes} onChange={e => setNotes(e.target.value)} />
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

    const doneCount = checkDefs.filter(c => getCheck(c.key).done).length;
    const pct = Math.round((doneCount / checkDefs.length) * 100);

    // Calculate streak
    const streak = (() => {
        if (!history?.length) return 0;
        let count = 0;
        for (let i = history.length - 1; i >= 0; i--) {
            const allDone = checkDefs.every(c => history[i].checks?.[c.key]?.done);
            if (allDone) count++;
            else break;
        }
        return count;
    })();

    const hard75Keys = new Set(['workout1', 'workout2', 'water', 'diet', 'reading']);
    const hard75Defs = checkDefs.filter(c => hard75Keys.has(c.key));
    const generalDefs = checkDefs.filter(c => !hard75Keys.has(c.key));

    const renderItem = (c: typeof checkDefs[0]) => {
        const item = getCheck(c.key);
        const done = item.done;
        return (
            <li key={c.key} className={styles.habitItem} onClick={() => openModal(c.key, c.icon, c.label)}
                style={{ cursor: 'pointer' }} title="Click to update">
                <div className={`${styles.habitCheck} ${done ? styles.habitDone : ''}`}>
                    {done && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L4 7L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </div>
                <span className={`${styles.habitName} ${done ? styles.habitNameDone : ''}`}>{c.icon} {c.label}</span>
                {item.time && <span className={styles.streak}>{item.time}</span>}
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
                            {data.day != null ? `Day ${data.day} of 75 Hard` : 'Daily tracking'}
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

                {/* 75 Hard section */}
                <div>
                    <div className={styles.sectionLabel}>75 Hard</div>
                    <ul className={styles.habitList}>{hard75Defs.map(renderItem)}</ul>
                </div>

                {/* General section */}
                <div>
                    <div className={styles.sectionLabel}>General</div>
                    <ul className={styles.habitList}>{generalDefs.map(renderItem)}</ul>
                </div>

                {/* Weekly heatmap */}
                {history && history.length > 1 && <WeeklyHeatmap history={history} />}

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                    <span>{doneCount}/{checkDefs.length} complete</span>
                    {data.finish_confidence != null && (
                        <span>Confidence: <strong style={{ color: data.finish_confidence >= 80 ? '#6db86d' : '#c9a84c' }}>{data.finish_confidence}%</strong></span>
                    )}
                </div>
            </div>
        </>
    );
}

// ─── Tasks Widget ──────────────────────────────────────────────────────────────
function TasksWidget({ data }: { data: DashboardData['tasks'] }) {
    const [expanded, setExpanded] = useState<string | null>(null);
    if (!data) return <EmptyWidget icon="◇" title="The Pile" message="Task data will appear after the next sync." />;

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
