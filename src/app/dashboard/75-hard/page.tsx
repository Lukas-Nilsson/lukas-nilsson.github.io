'use client';

import { useEffect, useState, useMemo } from 'react';
import { BarChart, LineChart } from '@/components/charts/Charts';
import DashboardShell from '../DashboardShell';
import styles from '../dashboard.module.css';

interface Hard75Day {
    date: string; day: number | null; today_complete: boolean;
    checks: Record<string, { done: boolean; time: string | null }>;
    discipline_score: number; finish_confidence: number | null;
}

// Only 75 Hard habits — general habits live on /dashboard/habits
const checkDefs = [
    { key: 'workout1', icon: '🏃', label: 'Outdoor Workout' },
    { key: 'workout2', icon: '💪', label: '2nd Workout' },
    { key: 'water', icon: '💧', label: 'Gallon Water' },
    { key: 'diet', icon: '🥗', label: 'Whole Foods' },
    { key: 'reading', icon: '📖', label: '10 Pages' },
];

const habitIdMap: Record<string, string> = {
    workout1: 'workout_outdoor', workout2: 'workout_2',
    water: 'water', diet: 'diet', reading: 'reading',
};

const modalFields: Record<string, { descLabel: string; timeLabel?: string }> = {
    workout1: { descLabel: 'Workout description', timeLabel: 'Duration / time' },
    workout2: { descLabel: 'Workout description', timeLabel: 'Duration / time' },
    water: { descLabel: 'Notes' },
    diet: { descLabel: 'What you ate' },
    reading: { descLabel: 'Title / chapter' },
};

// Milestone rewards every 15 days
const milestones: Record<number, { emoji: string; label: string }> = {
    15: { emoji: '🎁', label: 'Reward #1' },
    30: { emoji: '🏆', label: 'Reward #2' },
    45: { emoji: '💎', label: 'Reward #3' },
    60: { emoji: '👑', label: 'Reward #4' },
    75: { emoji: '🥇', label: 'FINISH LINE' },
};

function shortDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

// ─── Habit Edit Modal ─────────────────────────────────────────────────────────
interface ModalState {
    key: string; label: string; icon: string;
    done: boolean; time: string; description: string; notes: string;
}

function HabitModal({ state, date, onClose, onSave }: {
    state: ModalState; date: string;
    onClose: () => void;
    onSave: (key: string, done: boolean, value: string | null, notes: string | null) => void;
}) {
    const [done, setDone] = useState(state.done);
    const [description, setDescription] = useState(state.description);
    const [time, setTime] = useState(state.time);
    const [notes, setNotes] = useState(state.notes);
    const [saving, setSaving] = useState(false);
    const cfg = modalFields[state.key] ?? { descLabel: 'Notes' };
    const input: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 'var(--text-sm)' };

    const handleSave = async () => {
        setSaving(true);
        const value = [description, time].filter(Boolean).join(' @ ') || null;
        try {
            const res = await fetch('/api/dashboard/habits', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date, habit_id: habitIdMap[state.key], done, value, notes: notes || null }),
            });
            if (res.ok) { onSave(state.key, done, value, notes || null); onClose(); }
            else { const e = await res.json(); alert(`Save failed: ${e.error}`); }
        } catch (e) { alert(`Save failed: ${e}`); }
        setSaving(false);
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
                <div className={styles.modalHeader}>
                    <h3 className={styles.modalTitle}>{state.icon} {state.label}</h3>
                    <button className={styles.modalClose} onClick={onClose}>✕</button>
                </div>
                <div className={styles.modalField}>
                    <label className={styles.modalLabel} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <input type="checkbox" checked={done} onChange={e => setDone(e.target.checked)}
                            style={{ width: 18, height: 18, accentColor: '#5a9a5a' }} />
                        Done today
                    </label>
                </div>
                <div className={styles.modalField}>
                    <label className={styles.modalLabel}>{cfg.descLabel}</label>
                    <input style={input} value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional…" />
                </div>
                {cfg.timeLabel && (
                    <div className={styles.modalField}>
                        <label className={styles.modalLabel}>{cfg.timeLabel}</label>
                        <input style={input} value={time} onChange={e => setTime(e.target.value)} placeholder="e.g. 45 min, 6:30am…" />
                    </div>
                )}
                <div className={styles.modalField}>
                    <label className={styles.modalLabel}>Notes</label>
                    <textarea style={{ ...input, resize: 'vertical', minHeight: 72, fontFamily: 'inherit' }} placeholder="Extra context, how it felt…" value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
                    <button className={styles.modalBtnSecondary} onClick={onClose}>Cancel</button>
                    <button className={styles.modalBtnPrimary} onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                </div>
            </div>
        </div>
    );
}

// ─── Progress Ring SVG ───────────────────────────────────────────────────────
function ProgressRing({ done, total, size = 72 }: { done: number; total: number; size?: number }) {
    const r = (size - 8) / 2;
    const circumference = 2 * Math.PI * r;
    const pct = total > 0 ? done / total : 0;
    const offset = circumference * (1 - pct);
    const allDone = done === total && total > 0;
    return (
        <svg width={size} height={size} style={{ flexShrink: 0 }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth="4" />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={allDone ? '#5a9a5a' : '#c07070'} strokeWidth="4"
                strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
                style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 0.5s ease' }}
            />
            <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
                style={{ fontSize: size * 0.22, fontWeight: 800, fill: allDone ? '#5a9a5a' : 'var(--color-text)' }}>
                {done}/{total}
            </text>
        </svg>
    );
}

// ─── 75-Day Calendar Grid ────────────────────────────────────────────────────
function CalendarGrid({ history }: { history: Hard75Day[] }) {
    const challengeDays = history.filter(d => d.day != null);
    if (!challengeDays.length) return null;

    const currentDay = Math.max(...challengeDays.map(d => d.day!));

    return (
        <div className={styles.widget}>
            <div className={styles.widgetHeader}>
                <div className={styles.widgetTitle}><span className={styles.widgetIcon}>📅</span>75-Day Calendar</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(15, 1fr)', gap: 3, padding: 'var(--space-2) 0' }}>
                {Array.from({ length: 75 }, (_, i) => {
                    const dayNum = i + 1;
                    const entry = challengeDays.find(d => d.day === dayNum);
                    const isFuture = !entry;
                    const isMilestone = milestones[dayNum] != null;
                    const passed = entry ? checkDefs.every(c => entry.checks?.[c.key]?.done) : false;
                    const isToday = entry?.day === currentDay;

                    let bg = 'var(--color-bg-secondary)';
                    let border = '1px solid var(--color-border)';
                    let color = 'var(--color-text-muted)';

                    if (passed) {
                        bg = 'rgba(90,154,90,0.3)'; border = '1px solid #5a9a5a'; color = '#5a9a5a';
                    } else if (entry && !passed) {
                        bg = 'rgba(192,112,112,0.15)'; border = '1px solid rgba(192,112,112,0.4)'; color = '#c07070';
                    }

                    if (isMilestone && isFuture) {
                        border = '2px solid #c9a84c';
                    }

                    return (
                        <div key={dayNum}
                            title={isMilestone ? `Day ${dayNum}: ${milestones[dayNum].label}` : entry ? `Day ${dayNum}: ${shortDate(entry.date)} — ${passed ? 'PASS ✅' : 'FAIL ❌'}` : `Day ${dayNum}`}
                            style={{
                                width: '100%', aspectRatio: '1', borderRadius: 'var(--radius-sm)',
                                background: bg, border,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: isMilestone ? 14 : 9, fontWeight: 700, color,
                                opacity: isFuture ? 0.5 : 1,
                                boxShadow: isToday ? '0 0 0 2px var(--color-text)' : undefined,
                                position: 'relative',
                            }}>
                            {isMilestone ? milestones[dayNum].emoji : dayNum}
                        </div>
                    );
                })}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', paddingTop: 'var(--space-2)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(90,154,90,0.3)', border: '1px solid #5a9a5a' }} />Pass</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(192,112,112,0.15)', border: '1px solid rgba(192,112,112,0.4)' }} />Fail</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, border: '2px solid #c9a84c' }} />Milestone</span>
            </div>
        </div>
    );
}

// ─── Alert Banner ────────────────────────────────────────────────────────────
function AlertBanner({ remaining, currentHour }: { remaining: number; currentHour: number }) {
    if (remaining === 0) return null;

    let severity: 'warning' | 'danger' | 'critical';
    let message: string;
    let emoji: string;
    let bgColor: string;
    let borderColor: string;
    let textColor: string;

    if (currentHour >= 21) {
        severity = 'critical';
        emoji = '💀';
        message = `${remaining} habit${remaining > 1 ? 's' : ''} incomplete and it's past 9pm. You are about to FAIL today.`;
        bgColor = 'rgba(192,70,70,0.15)';
        borderColor = '#c04646';
        textColor = '#c04646';
    } else if (currentHour >= 18) {
        severity = 'danger';
        emoji = '⌛';
        message = `${remaining} habit${remaining > 1 ? 's' : ''} still to go. Evening is slipping away.`;
        bgColor = 'rgba(192,112,112,0.12)';
        borderColor = '#c07070';
        textColor = '#c07070';
    } else if (currentHour >= 15) {
        severity = 'warning';
        emoji = '⏳';
        message = `${remaining} habit${remaining > 1 ? 's' : ''} remaining. Afternoon — get it done.`;
        bgColor = 'rgba(201,168,76,0.12)';
        borderColor = '#c9a84c';
        textColor = '#c9a84c';
    } else {
        return null; // Before 3pm — no alert
    }

    return (
        <div style={{
            background: bgColor, border: `2px solid ${borderColor}`, borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            animation: severity === 'critical' ? 'pulse 1.5s ease-in-out infinite' : undefined,
        }}>
            <span style={{ fontSize: 32, lineHeight: 1 }}>{emoji}</span>
            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 'var(--text-sm)', color: textColor, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {severity === 'critical' ? 'CRITICAL' : severity === 'danger' ? 'WARNING' : 'HEADS UP'}
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', marginTop: 2 }}>{message}</div>
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SeventyFiveHardPage() {
    const [history, setHistory] = useState<Hard75Day[]>([]);
    const [idx, setIdx] = useState(0);
    const [loading, setLoading] = useState(true);
    const [overrides, setOverrides] = useState<Record<string, { done: boolean; time: string | null }>>({});
    const [modal, setModal] = useState<ModalState | null>(null);

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
    const isViewingToday = idx === history.length - 1;

    const getCheck = (key: string) => {
        if (isViewingToday && overrides[key] !== undefined) return overrides[key];
        return data?.checks?.[key] ?? { done: false, time: null };
    };

    const openModal = (key: string, icon: string, label: string) => {
        if (!isViewingToday) return;
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

    // ── Challenge stats ──
    const challengeDays = useMemo(() => history.filter(d => d.day != null), [history]);
    const currentDay = today?.day ?? 0;
    const passedDays = useMemo(() =>
        challengeDays.filter(d => checkDefs.every(c => d.checks?.[c.key]?.done)).length,
        [challengeDays]
    );
    const failedDays = (currentDay ?? 0) - passedDays;
    const programPct = currentDay ? Math.round((currentDay / 75) * 100) : 0;
    const startDate = challengeDays[0]?.date;
    const endDate = startDate ? new Date(new Date(startDate + 'T00:00:00').getTime() + 74 * 86400000).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

    // ── Next milestone ──
    const nextMilestone = useMemo(() => {
        const ms = Object.keys(milestones).map(Number).sort((a, b) => a - b);
        return ms.find(m => m > (currentDay ?? 0)) ?? null;
    }, [currentDay]);

    // ── Today's status ──
    const todayDoneCount = checkDefs.filter(c => getCheck(c.key).done).length;
    const todayRemaining = checkDefs.length - todayDoneCount;
    const todayPassed = todayDoneCount === checkDefs.length;

    // ── Streak (consecutive pass days) ──
    const streak = useMemo(() => {
        if (!challengeDays.length) return 0;
        let count = 0;
        // Count backwards from yesterday
        for (let i = challengeDays.length - 1; i >= 0; i--) {
            const d = challengeDays[i];
            // Skip today in the main count — we handle it separately
            if (d === today) continue;
            const passed = checkDefs.every(c => d.checks?.[c.key]?.done);
            if (passed) count++;
            else break;
        }
        // If today is also a pass, add it
        if (todayPassed) count++;
        return count;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [challengeDays, overrides, today, todayPassed]);

    // ── Per-habit streak ──
    const perHabitStreak = (key: string): number => {
        if (challengeDays.length < 2) return 0;
        let count = 0;
        for (let i = challengeDays.length - 2; i >= 0; i--) {
            if (challengeDays[i].checks?.[key]?.done) count++;
            else break;
        }
        if (count > 0 && getCheck(key).done) count++;
        return count;
    };

    const bestStreak = (key: string): number => {
        let best = 0, current = 0;
        for (const d of challengeDays) {
            if (d.checks?.[key]?.done) { current++; best = Math.max(best, current); }
            else current = 0;
        }
        return best;
    };

    // ── Melbourne hour ──
    const melbourneHour = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Melbourne', hour: 'numeric', hour12: false });
    const currentHour = parseInt(melbourneHour, 10);

    // ── Charts ──
    const disciplineChart = challengeDays.filter(d => d.discipline_score).map(d => ({
        date: shortDate(d.date), Score: d.discipline_score,
    }));
    const confidenceChart = history.filter(d => d.finish_confidence != null).map(d => ({
        date: shortDate(d.date), Confidence: d.finish_confidence!,
    }));

    // ── Render ──
    if (loading) return (
        <DashboardShell>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                <span className="spinner" style={{ width: 16, height: 16 }} />Loading 75 Hard…
            </div>
        </DashboardShell>
    );

    if (!today) return (
        <DashboardShell>
            <div className={styles.widget}><p className={styles.widgetNotice}>🔗 No 75 Hard data yet. Data will appear after the next sync.</p></div>
        </DashboardShell>
    );

    return (
        <DashboardShell>
            {modal && <HabitModal state={modal} date={data.date} onClose={() => setModal(null)} onSave={handleSave} />}

            <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }`}</style>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

                {/* Alert banner — only shows after 3pm when habits are incomplete */}
                {isViewingToday && <AlertBanner remaining={todayRemaining} currentHour={currentHour} />}

                {/* Hero */}
                <div className={styles.widget} style={{ background: 'var(--color-bg-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                        <div>
                            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-2)', maxWidth: 'none' }}>75 Hard</p>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
                                <span style={{ fontSize: 72, fontWeight: 900, letterSpacing: '-0.05em', lineHeight: 1, fontFamily: 'var(--font-heading)', color: 'var(--color-text)' }}>{currentDay}</span>
                                <span style={{ fontSize: 'var(--text-xl)', color: 'var(--color-text-muted)', fontWeight: 400 }}>/ 75</span>
                            </div>
                            {endDate && (
                                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: 'var(--space-2) 0 0', maxWidth: 'none' }}>
                                    Ends {endDate} · {75 - (currentDay ?? 0)} days to go
                                </p>
                            )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            {streak > 0 && (
                                <div className={styles.streakBadge} style={{ marginBottom: 'var(--space-2)' }}>
                                    <span className={styles.streakFire}>🔥</span>
                                    <span className={styles.streakCount}>{streak}</span>
                                    <span className={styles.streakLabel}>day{streak !== 1 ? 's' : ''} perfect</span>
                                </div>
                            )}
                            {nextMilestone && (
                                <div style={{ fontSize: 'var(--text-xs)', color: '#c9a84c', fontWeight: 600 }}>
                                    {milestones[nextMilestone].emoji} Next reward: Day {nextMilestone} ({nextMilestone - (currentDay ?? 0)} to go)
                                </div>
                            )}
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
                            <span className={styles.statValue} style={{ color: '#6db86d' }}>{passedDays}</span>
                            <span className={styles.statLabel}>Passed</span>
                        </div>
                        <div className={styles.statCard}>
                            <span className={styles.statValue} style={{ color: failedDays > 0 ? '#c07070' : 'var(--color-text-muted)' }}>{failedDays}</span>
                            <span className={styles.statLabel}>Failed</span>
                        </div>
                        <div className={styles.statCard}>
                            <span className={styles.statValue}>{75 - (currentDay ?? 0)}</span>
                            <span className={styles.statLabel}>Remaining</span>
                        </div>
                        <div className={styles.statCard}>
                            <span className={styles.statValue} style={{ color: '#e8973a' }}>{streak}</span>
                            <span className={styles.statLabel}>Streak</span>
                        </div>
                    </div>
                </div>

                {/* Today's checklist */}
                <div className={styles.widget} style={!todayPassed && isViewingToday ? { border: '1px solid rgba(192,112,112,0.3)' } : undefined}>
                    <div className={styles.kanbanHeader}>
                        <ProgressRing done={todayDoneCount} total={checkDefs.length} />
                        <div style={{ flex: 1 }}>
                            <div className={styles.widgetTitle}>
                                <span className={styles.widgetIcon}>{todayPassed ? '✅' : '◈'}</span>
                                {isViewingToday ? 'Today' : `Day ${data?.day ?? '—'}`}
                            </div>
                            <div style={{ fontSize: 'var(--text-xs)', color: todayPassed ? '#5a9a5a' : 'var(--color-text-muted)', marginTop: 2, fontWeight: todayPassed ? 700 : 400 }}>
                                {todayPassed ? 'ALL DONE — Day passed ✅' : `${todayRemaining} remaining`}
                            </div>
                        </div>
                        <div className={styles.dayNav}>
                            <button className={styles.dayNavBtn} onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}>‹</button>
                            <span className={styles.dayNavDate}>{shortDate(data.date)}</span>
                            <button className={styles.dayNavBtn} onClick={() => setIdx(i => Math.min(history.length - 1, i + 1))} disabled={idx === history.length - 1}>›</button>
                        </div>
                    </div>

                    <ul className={styles.habitList}>
                        {checkDefs.map(c => {
                            const item = getCheck(c.key);
                            const done = item.done;
                            const habitSt = perHabitStreak(c.key);
                            const best = bestStreak(c.key);

                            let urgencyEmoji = '';
                            if (isViewingToday && habitSt > 0 && !done && currentHour >= 15) {
                                if (currentHour >= 21) urgencyEmoji = '💀';
                                else if (currentHour >= 18) urgencyEmoji = '⌛';
                                else urgencyEmoji = '⏳';
                            }

                            return (
                                <li key={c.key} className={styles.habitItem}
                                    onClick={() => openModal(c.key, c.icon, c.label)}
                                    style={{ cursor: isViewingToday ? 'pointer' : 'default' }}
                                    title={isViewingToday ? 'Click to update' : ''}
                                >
                                    <div className={`${styles.habitCheck} ${done ? styles.habitDone : ''}`}>
                                        {done && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L4 7L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                    </div>
                                    <span className={`${styles.habitName} ${done ? styles.habitNameDone : ''}`}>{c.icon} {c.label}</span>
                                    {item.time && <span className={styles.streak} style={{ fontSize: 10 }}>{item.time}</span>}
                                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                        {habitSt > 0 && (
                                            <span style={{ fontSize: 11, fontWeight: 700, color: urgencyEmoji ? '#c07070' : '#e8973a', whiteSpace: 'nowrap' }}>
                                                {urgencyEmoji || '🔥'} {habitSt}
                                            </span>
                                        )}
                                        {best > habitSt && best > 0 && (
                                            <span style={{ fontSize: 9, color: 'var(--color-text-muted)' }} title="Best streak">🏆{best}</span>
                                        )}
                                    </div>
                                    {urgencyEmoji && !done && (
                                        <span style={{ fontSize: 9, color: '#c07070', fontWeight: 600 }}>at risk!</span>
                                    )}
                                    {isViewingToday && <span className={styles.kanbanEdit}>✎</span>}
                                </li>
                            );
                        })}
                    </ul>
                    {!isViewingToday && (
                        <div style={{ fontSize: 'var(--text-xs)', fontStyle: 'italic', color: 'var(--color-text-muted)', paddingTop: 'var(--space-2)' }}>
                            Viewing past day — edit disabled
                        </div>
                    )}
                </div>

                {/* 75-Day Calendar */}
                <CalendarGrid history={history} />

                {/* Per-habit stats */}
                <div className={styles.widget}>
                    <div className={styles.widgetHeader}>
                        <div className={styles.widgetTitle}><span className={styles.widgetIcon}>📊</span>Habit Streaks</div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: 'var(--text-xs)', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 9, fontWeight: 700 }}>
                                    <td style={{ padding: '8px 6px' }}>Habit</td>
                                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>Current 🔥</td>
                                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>Best 🏆</td>
                                </tr>
                            </thead>
                            <tbody>
                                {checkDefs.map(c => {
                                    const current = perHabitStreak(c.key);
                                    const best2 = bestStreak(c.key);
                                    const isPersonalBest = current > 0 && current === best2;
                                    return (
                                        <tr key={c.key} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                            <td style={{ padding: '8px 6px', fontWeight: 600 }}>{c.icon} {c.label}</td>
                                            <td style={{ padding: '8px 6px', textAlign: 'center', color: current > 0 ? '#e8973a' : 'var(--color-text-muted)', fontWeight: current > 0 ? 700 : 400 }}>
                                                {current > 0 ? `${current}${isPersonalBest ? ' 🔥' : ''}` : '—'}
                                            </td>
                                            <td style={{ padding: '8px 6px', textAlign: 'center', color: best2 > 0 ? '#c17f3a' : 'var(--color-text-muted)' }}>
                                                {best2 > 0 ? best2 : '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Discipline score chart */}
                {disciplineChart.length > 1 && (
                    <div className={styles.widget}>
                        <div className={styles.widgetHeader}>
                            <div className={styles.widgetTitle}><span className={styles.widgetIcon}>◉</span>Discipline Score</div>
                            <span className={styles.widgetBadge}>By day</span>
                        </div>
                        <BarChart data={disciplineChart} xKey="date" height={160} bars={[{ key: 'Score', color: 'var(--accent-400)', name: 'Discipline %' }]} yDomain={[0, 100]} unit="%" />
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

                {/* Day log */}
                <div className={styles.widget}>
                    <div className={styles.widgetHeader}>
                        <div className={styles.widgetTitle}><span className={styles.widgetIcon}>◆</span>Day Log</div>
                        <span className={styles.widgetBadge}>{passedDays} passed · {failedDays} failed</span>
                    </div>
                    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
                        {[...challengeDays].reverse().map(d => {
                            const passed = checkDefs.every(c => d.checks?.[c.key]?.done);
                            return (
                                <li key={d.date}
                                    style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-3) 0', borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}
                                    onClick={() => { const i = history.findIndex(h => h.date === d.date); if (i >= 0) setIdx(i); }}
                                >
                                    <span style={{ fontSize: 'var(--text-base)', width: 20 }}>{passed ? '✅' : '❌'}</span>
                                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', width: 56, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>Day {d.day}</span>
                                    <span style={{ flex: 1, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>{shortDate(d.date)}</span>
                                    <span style={{ display: 'flex', gap: 3 }}>
                                        {checkDefs.map(c => (
                                            <span key={c.key} style={{ fontSize: 12, opacity: d.checks?.[c.key]?.done ? 1 : 0.2 }} title={c.label}>{c.icon}</span>
                                        ))}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </div>
        </DashboardShell>
    );
}
