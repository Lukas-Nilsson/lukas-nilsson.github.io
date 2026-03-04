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

const checkDefs = [
    { key: 'workout1', icon: '🏃', label: 'Outdoor Workout', category: '75hard' },
    { key: 'workout2', icon: '💪', label: '2nd Workout', category: '75hard' },
    { key: 'water', icon: '💧', label: 'Gallon Water', category: '75hard' },
    { key: 'diet', icon: '🥗', label: 'Whole Foods', category: '75hard' },
    { key: 'reading', icon: '📖', label: '10 Pages', category: '75hard' },
    { key: 'teeth', icon: '🦷', label: 'Brush teeth (AM + PM)', category: 'general' },
    { key: 'bedtime', icon: '🌙', label: 'In bed by 11pm', category: 'general' },
    { key: 'wake', icon: '🌅', label: 'Up by 7am', category: 'general' },
];

// ─── Per-habit modal field config ────────────────────────────────────────────
const modalFields: Record<string, { descLabel: string; timeLabel?: string }> = {
    workout1: { descLabel: 'Workout description', timeLabel: 'Duration / time' },
    workout2: { descLabel: 'Workout description', timeLabel: 'Duration / time' },
    water: { descLabel: 'Notes' },
    diet: { descLabel: 'What you ate' },
    reading: { descLabel: 'Title / chapter' },
    teeth: { descLabel: 'Notes' },
    bedtime: { descLabel: 'Notes', timeLabel: 'Actual bedtime' },
    wake: { descLabel: 'Notes', timeLabel: 'Actual wake time' },
};

const habitIdMap: Record<string, string> = {
    workout1: 'workout_outdoor', workout2: 'workout_2',
    water: 'water', diet: 'diet', reading: 'reading',
    teeth: 'teeth', bedtime: 'bedtime', wake: 'wake',
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
    return (
        <svg width={size} height={size} style={{ flexShrink: 0 }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth="4" />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={pct >= 1 ? '#5a9a5a' : '#c17f3a'} strokeWidth="4"
                strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
                style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 0.5s ease' }}
            />
            <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
                style={{ fontSize: size * 0.22, fontWeight: 800, fill: 'var(--color-text)' }}>
                {done}/{total}
            </text>
        </svg>
    );
}

// ─── 75-Day Calendar Grid ────────────────────────────────────────────────────
function CalendarGrid({ history }: { history: Hard75Day[] }) {
    const challengeDays = history.filter(d => d.day != null);
    if (!challengeDays.length) return null;

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
                    const allDone = entry ? checkDefs.filter(c => c.category === '75hard').every(c => entry.checks?.[c.key]?.done) : false;
                    const someDone = entry && !allDone ? Object.values(entry.checks ?? {}).some(c => c.done) : false;

                    let bg = 'var(--color-bg-secondary)';
                    let border = '1px solid var(--color-border)';
                    if (allDone) { bg = 'rgba(90,154,90,0.3)'; border = '1px solid #5a9a5a'; }
                    else if (someDone) { bg = 'rgba(201,168,76,0.2)'; border = '1px solid #c9a84c'; }
                    else if (entry && !allDone) { bg = 'rgba(192,112,112,0.15)'; border = '1px solid rgba(192,112,112,0.3)'; }

                    return (
                        <div key={dayNum} title={entry ? `Day ${dayNum}: ${shortDate(entry.date)}` : `Day ${dayNum}`}
                            style={{
                                width: '100%', aspectRatio: '1', borderRadius: 'var(--radius-sm)',
                                background: bg, border,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 9, fontWeight: 700,
                                color: isFuture ? 'var(--color-text-muted)' : allDone ? '#5a9a5a' : someDone ? '#c9a84c' : '#c07070',
                                opacity: isFuture ? 0.4 : 1,
                            }}>
                            {dayNum}
                        </div>
                    );
                })}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', paddingTop: 'var(--space-2)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(90,154,90,0.3)', border: '1px solid #5a9a5a' }} />All done</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(201,168,76,0.2)', border: '1px solid #c9a84c' }} />Partial</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(192,112,112,0.15)', border: '1px solid rgba(192,112,112,0.3)' }} />Missed</span>
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
        if (!isViewingToday) return; // Can only edit today
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

    // ── Challenge-only logic ──
    const challengeDays = useMemo(() => history.filter(d => d.day != null), [history]);
    const currentDay = today?.day ?? 0;
    const daysCompleted = useMemo(() =>
        challengeDays.filter(d => checkDefs.filter(c => c.category === '75hard').every(c => d.checks?.[c.key]?.done)).length,
        [challengeDays]
    );
    const programPct = currentDay ? Math.round((currentDay / 75) * 100) : 0;
    const startDate = challengeDays[0]?.date;
    const endDate = startDate ? new Date(new Date(startDate + 'T00:00:00').getTime() + 74 * 86400000).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

    // ── Active habits for current view ──
    const hard75Keys = new Set(['workout1', 'workout2', 'water', 'diet', 'reading']);
    const isChallenge = data?.day != null;
    const activeDefs = isChallenge ? checkDefs : checkDefs.filter(c => !hard75Keys.has(c.key));
    const doneCount = activeDefs.filter(c => getCheck(c.key).done).length;
    const pct = activeDefs.length > 0 ? Math.round((doneCount / activeDefs.length) * 100) : 0;

    // ── Per-habit streak ──
    const perHabitStreak = (key: string): number => {
        if (!history?.length || history.length < 2) return 0;
        let count = 0;
        for (let i = history.length - 2; i >= 0; i--) {
            const d = history[i];
            if (d.day == null && hard75Keys.has(key)) continue;
            if (d.checks?.[key]?.done) count++;
            else break;
        }
        if (count > 0 && getCheck(key).done) count++;
        return count;
    };

    // ── Best streak per habit ──
    const bestStreak = (key: string): number => {
        let best = 0, current = 0;
        for (const d of history) {
            if (d.day == null && hard75Keys.has(key)) continue;
            if (d.checks?.[key]?.done) { current++; best = Math.max(best, current); }
            else current = 0;
        }
        return best;
    };

    // ── Per-habit completion rate ──
    const completionRate = (key: string): number => {
        const applicable = history.filter(d => !(d.day == null && hard75Keys.has(key)));
        if (!applicable.length) return 0;
        const done = applicable.filter(d => d.checks?.[key]?.done).length;
        return Math.round((done / applicable.length) * 100);
    };

    // ── Overall streak ──
    const streak = useMemo(() => {
        if (!history?.length || history.length < 2) return 0;
        let count = 0;
        for (let i = history.length - 2; i >= 0; i--) {
            const d = history[i];
            const dayHabits = d.day != null ? checkDefs : checkDefs.filter(c => !hard75Keys.has(c.key));
            if (dayHabits.length > 0 && dayHabits.every(c => d.checks?.[c.key]?.done)) count++;
            else break;
        }
        if (count > 0 && today) {
            const todayHabits = today.day != null ? checkDefs : checkDefs.filter(c => !hard75Keys.has(c.key));
            if (todayHabits.length > 0 && todayHabits.every(c => getCheck(c.key).done)) count++;
        }
        return count;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [history, overrides]);

    // ── Melbourne hour for urgency ──
    const melbourneHour = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Melbourne', hour: 'numeric', hour12: false });
    const currentHour = parseInt(melbourneHour, 10);

    // ── Charts ──
    const disciplineChart = history.filter(d => d.day != null && d.discipline_score).map(d => ({
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

    const hard75Defs = checkDefs.filter(c => c.category === '75hard');
    const generalDefs = checkDefs.filter(c => c.category === 'general');

    const renderItem = (c: typeof checkDefs[0]) => {
        const item = getCheck(c.key);
        const done = item.done;
        const habitSt = perHabitStreak(c.key);
        const best = bestStreak(c.key);
        const rate = completionRate(c.key);

        let urgencyEmoji = '';
        if (habitSt > 0 && !done && currentHour >= 15) {
            if (currentHour >= 21) urgencyEmoji = '💀';
            else if (currentHour >= 18) urgencyEmoji = '⌛';
            else urgencyEmoji = '⏳';
        }

        return (
            <li key={c.key} className={styles.habitItem}
                onClick={() => openModal(c.key, c.icon, c.label)}
                style={{ cursor: isViewingToday ? 'pointer' : 'default' }}
                title={isViewingToday ? 'Click to update' : `Day ${data?.day ?? '—'}`}
            >
                <div className={`${styles.habitCheck} ${done ? styles.habitDone : ''}`}>
                    {done && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L4 7L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </div>
                <span className={`${styles.habitName} ${done ? styles.habitNameDone : ''}`}>{c.icon} {c.label}</span>
                {item.time && <span className={styles.streak} style={{ fontSize: 10 }}>{item.time}</span>}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>{rate}%</span>
                    {habitSt > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: urgencyEmoji ? '#c07070' : '#e8973a', whiteSpace: 'nowrap' }}>
                            {urgencyEmoji || '🔥'} {habitSt}
                        </span>
                    )}
                    {habitSt > 0 && best > habitSt && (
                        <span style={{ fontSize: 9, color: 'var(--color-text-muted)' }} title="Best streak">🏆{best}</span>
                    )}
                </div>
                {urgencyEmoji && !done && (
                    <span style={{ fontSize: 9, color: '#c07070', fontWeight: 600 }}>streak at risk!</span>
                )}
                {isViewingToday && <span className={styles.kanbanEdit}>✎</span>}
            </li>
        );
    };

    return (
        <DashboardShell>
            {modal && (
                <HabitModal state={modal} date={data.date} onClose={() => setModal(null)} onSave={handleSave} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
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
                            {today.finish_confidence != null && (
                                <>
                                    <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, letterSpacing: '-0.04em', color: today.finish_confidence >= 80 ? '#6db86d' : '#c9a84c' }}>{today.finish_confidence}%</div>
                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Confidence</div>
                                </>
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
                            <span className={styles.statValue} style={{ color: '#6db86d' }}>{daysCompleted}</span>
                            <span className={styles.statLabel}>Perfect days</span>
                        </div>
                        <div className={styles.statCard}>
                            <span className={styles.statValue} style={{ color: '#c07070' }}>{(currentDay ?? 0) - daysCompleted}</span>
                            <span className={styles.statLabel}>Imperfect</span>
                        </div>
                        <div className={styles.statCard}>
                            <span className={styles.statValue}>{75 - (currentDay ?? 0)}</span>
                            <span className={styles.statLabel}>Remaining</span>
                        </div>
                        <div className={styles.statCard}>
                            <span className={styles.statValue} style={{ color: '#e8973a' }}>{currentDay ? Math.round((daysCompleted / currentDay) * 100) : 0}%</span>
                            <span className={styles.statLabel}>Success rate</span>
                        </div>
                    </div>
                </div>

                {/* Day navigator + checklist */}
                <div className={styles.widget}>
                    <div className={styles.kanbanHeader}>
                        <ProgressRing done={doneCount} total={activeDefs.length} />
                        <div style={{ flex: 1 }}>
                            <div className={styles.widgetTitle}><span className={styles.widgetIcon}>◈</span>Daily Checklist</div>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                {isChallenge ? `Day ${data.day} of 75 Hard` : shortDate(data.date)}
                                {isViewingToday ? ' · Today' : ''}
                            </div>
                        </div>
                        <div className={styles.dayNav}>
                            <button className={styles.dayNavBtn} onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}>‹</button>
                            <span className={styles.dayNavDate}>{shortDate(data.date)}</span>
                            <button className={styles.dayNavBtn} onClick={() => setIdx(i => Math.min(history.length - 1, i + 1))} disabled={idx === history.length - 1}>›</button>
                        </div>
                    </div>

                    <div className={styles.habitProgress}>
                        <div className={styles.habitBar} style={{ width: `${pct}%`, background: pct === 100 ? '#5a9a5a' : undefined }} />
                    </div>

                    {/* 75 Hard habits */}
                    {isChallenge && (
                        <div>
                            <div className={styles.sectionLabel}>75 Hard</div>
                            <ul className={styles.habitList}>{hard75Defs.map(renderItem)}</ul>
                        </div>
                    )}

                    {/* General habits */}
                    <div>
                        <div className={styles.sectionLabel}>{isChallenge ? 'General' : 'Habits'}</div>
                        <ul className={styles.habitList}>{generalDefs.map(renderItem)}</ul>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', paddingTop: 'var(--space-2)' }}>
                        <span>{doneCount}/{activeDefs.length} complete</span>
                        {!isViewingToday && <span style={{ fontStyle: 'italic' }}>Viewing past day — edit disabled</span>}
                    </div>
                </div>

                {/* 75-Day Calendar */}
                <CalendarGrid history={history} />

                {/* Per-habit stats table */}
                <div className={styles.widget}>
                    <div className={styles.widgetHeader}>
                        <div className={styles.widgetTitle}><span className={styles.widgetIcon}>📊</span>Habit Stats</div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: 'var(--text-xs)', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 9, fontWeight: 700 }}>
                                    <td style={{ padding: '8px 6px' }}>Habit</td>
                                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>Rate</td>
                                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>Current</td>
                                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>Best</td>
                                </tr>
                            </thead>
                            <tbody>
                                {checkDefs.filter(c => isChallenge || !hard75Keys.has(c.key)).map(c => {
                                    const rate = completionRate(c.key);
                                    const current = perHabitStreak(c.key);
                                    const best2 = bestStreak(c.key);
                                    return (
                                        <tr key={c.key} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                            <td style={{ padding: '8px 6px', fontWeight: 600 }}>{c.icon} {c.label}</td>
                                            <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                                                    <div style={{ width: 50, height: 4, borderRadius: 2, background: 'var(--color-border)', overflow: 'hidden' }}>
                                                        <div style={{ width: `${rate}%`, height: '100%', borderRadius: 2, background: rate >= 80 ? '#5a9a5a' : rate >= 50 ? '#c9a84c' : '#c07070' }} />
                                                    </div>
                                                    <span>{rate}%</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '8px 6px', textAlign: 'center', color: current > 0 ? '#e8973a' : 'var(--color-text-muted)' }}>
                                                {current > 0 ? `🔥 ${current}` : '—'}
                                            </td>
                                            <td style={{ padding: '8px 6px', textAlign: 'center', color: best2 > 0 ? '#c17f3a' : 'var(--color-text-muted)' }}>
                                                {best2 > 0 ? `🏆 ${best2}` : '—'}
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
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', maxWidth: 'none' }}>Based on how many habits completed each day.</p>
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
                        <span className={styles.widgetBadge}>{daysCompleted} / {currentDay} perfect</span>
                    </div>
                    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
                        {[...challengeDays].reverse().map(d => {
                            const allDone = hard75Defs.every(c => d.checks?.[c.key]?.done);
                            return (
                                <li key={d.date}
                                    style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-3) 0', borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}
                                    onClick={() => { const i = history.findIndex(h => h.date === d.date); if (i >= 0) setIdx(i); }}
                                >
                                    <span style={{ fontSize: 'var(--text-base)', width: 20 }}>{allDone ? '✅' : '❌'}</span>
                                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', width: 56, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>Day {d.day}</span>
                                    <span style={{ flex: 1, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>{shortDate(d.date)}</span>
                                    <span style={{ display: 'flex', gap: 3 }}>
                                        {checkDefs.filter(c => c.category === '75hard').map(c => (
                                            <span key={c.key} style={{ fontSize: 12, opacity: d.checks?.[c.key]?.done ? 1 : 0.2 }} title={c.label}>{c.icon}</span>
                                        ))}
                                    </span>
                                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', width: 36, textAlign: 'right' }}>{d.discipline_score ? `${d.discipline_score}%` : '—'}</span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </div>
        </DashboardShell>
    );
}
