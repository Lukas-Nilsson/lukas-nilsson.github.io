'use client';

import { useEffect, useState, useMemo } from 'react';
import { BarChart } from '@/components/charts/Charts';
import DashboardShell from '../DashboardShell';
import styles from '../dashboard.module.css';

interface HabitDay {
    date: string;
    checks: Record<string, { done: boolean; time: string | null }>;
    discipline_score: number;
}

// All daily habits
const allHabits = [
    { key: 'teeth', icon: '🦷', label: 'Brush teeth (AM + PM)', group: 'Health', weight: 12 },
    { key: 'bedtime', icon: '🌙', label: 'In bed by 11pm', group: 'Sleep', weight: 12 },
    { key: 'wake', icon: '🌅', label: 'Up by 7am', group: 'Sleep', weight: 12 },
    { key: 'phone_down', icon: '📱', label: 'Phone Down by 11:30pm', group: 'Sleep', weight: 12 },
    { key: 'meditation', icon: '🧘', label: 'Meditation', group: 'Mind', weight: 15 },
    { key: 'hydration', icon: '💧', label: 'Hydration', group: 'Health', weight: 12 },
];

const totalWeight = allHabits.reduce((s, h) => s + h.weight, 0);

const habitIdMap: Record<string, string> = {
    teeth: 'teeth', bedtime: 'bedtime', wake: 'wake',
    phone_down: 'phone_down', meditation: 'meditation', hydration: 'hydration',
};

const modalFields: Record<string, { descLabel: string; timeLabel?: string }> = {
    teeth: { descLabel: 'Notes' },
    bedtime: { descLabel: 'Notes', timeLabel: 'Actual bedtime' },
    wake: { descLabel: 'Notes', timeLabel: 'Actual wake time' },
    phone_down: { descLabel: 'Notes', timeLabel: 'Last message time' },
    meditation: { descLabel: 'Notes', timeLabel: 'Duration' },
    hydration: { descLabel: 'Notes' },
};

function shortDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

// ─── Modal ────────────────────────────────────────────────────────────────────
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
    const [time, setTime] = useState(state.time || state.description);
    const [notes, setNotes] = useState(state.notes);
    const [saving, setSaving] = useState(false);
    const cfg = modalFields[state.key] ?? { descLabel: 'Notes' };
    const input: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 'var(--text-sm)' };

    const handleSave = async () => {
        setSaving(true);
        const value = time || null;
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
                {cfg.timeLabel && (
                    <div className={styles.modalField}>
                        <label className={styles.modalLabel}>{cfg.timeLabel}</label>
                        <input style={input} value={time} onChange={e => setTime(e.target.value)} placeholder="e.g. 45 min, 6:30am…" />
                    </div>
                )}
                <div className={styles.modalField}>
                    <label className={styles.modalLabel}>Notes</label>
                    <textarea style={{ ...input, resize: 'vertical', minHeight: 48, fontFamily: 'inherit' }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional context…" />
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
                    <button className={styles.modalBtnSecondary} onClick={onClose}>Cancel</button>
                    <button className={styles.modalBtnPrimary} onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                </div>
            </div>
        </div>
    );
}

// ─── Progress Ring ───────────────────────────────────────────────────────────
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

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function HabitsPage() {
    const [history, setHistory] = useState<HabitDay[]>([]);
    const [idx, setIdx] = useState(0);
    const [loading, setLoading] = useState(true);
    const [overrides, setOverrides] = useState<Record<string, { done: boolean; time: string | null }>>({});
    const [modal, setModal] = useState<ModalState | null>(null);
    const [lastSynced, setLastSynced] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/dashboard')
            .then(r => r.json())
            .then(d => {
                const hist = d.habitHistory ?? [];
                setHistory(hist);
                setIdx(hist.length - 1);
                setLastSynced(d.lastSynced ?? null);
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
        if (!isViewingToday) return; // Only edit today
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

    // ── Streaks ──
    const perHabitStreak = (key: string): number => {
        if (!history?.length || history.length < 2) return 0;
        let count = 0;
        for (let i = history.length - 2; i >= 0; i--) {
            const d = history[i];
            if (d.checks?.[key]?.done) count++;
            else break;
        }
        if (count > 0 && getCheck(key).done) count++;
        return count;
    };

    const bestStreak = (key: string): number => {
        let best = 0, current = 0;
        for (const d of history) {
            if (d.checks?.[key]?.done) { current++; best = Math.max(best, current); }
            else current = 0;
        }
        return best;
    };

    const completionRate = (key: string): number => {
        if (!history.length) return 0;
        return Math.round(history.filter(d => d.checks?.[key]?.done).length / history.length * 100);
    };

    // ── Discipline score breakdown ──
    const viewDoneCount = allHabits.filter(c => getCheck(c.key).done).length;
    const viewScore = useMemo(() => {
        const doneWeight = allHabits.filter(h => getCheck(h.key).done).reduce((s, h) => s + h.weight, 0);
        return totalWeight > 0 ? Math.round((doneWeight / totalWeight) * 100) : 0;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [overrides, data]);
    const todayDoneCount = isViewingToday ? viewDoneCount : (today ? allHabits.filter(c => today.checks?.[c.key]?.done).length : 0);

    // ── Chart ──
    const chartData = useMemo(() => history.map(d => ({
        date: shortDate(d.date), Score: d.discipline_score ?? null,
    })).filter(d => d.Score !== null), [history]);

    // ── Melbourne hour for urgency ──
    const melbourneHour = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Melbourne', hour: 'numeric', hour12: false });
    const currentHour = parseInt(melbourneHour, 10);

    // ── Overall streak ──
    const overallStreak = useMemo(() => {
        if (!history?.length || history.length < 2) return 0;
        let count = 0;
        for (let i = history.length - 2; i >= 0; i--) {
            const d = history[i];
            if (allHabits.length > 0 && allHabits.every(c => d.checks?.[c.key]?.done)) count++;
            else break;
        }
        if (count > 0 && todayDoneCount === allHabits.length) count++;
        return count;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [history, overrides, todayDoneCount]);

    // ── Groups for rendering ──
    const groups = useMemo(() => {
        const map = new Map<string, typeof allHabits>();
        allHabits.forEach(h => {
            const arr = map.get(h.group) ?? [];
            arr.push(h);
            map.set(h.group, arr);
        });
        return Array.from(map.entries());
    }, []);

    if (loading) return (
        <DashboardShell>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                <span className="spinner" style={{ width: 16, height: 16 }} />Loading habits…
            </div>
        </DashboardShell>
    );

    if (!today) return (
        <DashboardShell>
            <div className={styles.widget}><p className={styles.widgetNotice}>🔗 No habits data yet. Data will appear after the next sync.</p></div>
        </DashboardShell>
    );

    return (
        <DashboardShell>
            {modal && <HabitModal state={modal} date={data.date} onClose={() => setModal(null)} onSave={handleSave} />}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                {/* Header with day nav + synced */}
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                    <div>
                        <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 'var(--space-1)' }}>Habits</h2>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: 0, maxWidth: 'none' }}>
                            Build consistency, one day at a time. {overallStreak > 0 && `🔥 ${overallStreak} day${overallStreak > 1 ? 's' : ''} all habits done.`}
                        </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div className={styles.dayNav}>
                            <button className={styles.dayNavBtn} onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}>‹</button>
                            <div style={{ textAlign: 'center', minWidth: 100 }}>
                                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text)' }}>
                                    {shortDate(data.date)}
                                </div>
                                <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>
                                    {isViewingToday ? 'Today' : 'Historical'}
                                </div>
                            </div>
                            <button className={styles.dayNavBtn} onClick={() => setIdx(i => Math.min(history.length - 1, i + 1))} disabled={idx === history.length - 1}>›</button>
                        </div>
                        {lastSynced && (
                            <span className={styles.userBadge} style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                                Synced {new Date(lastSynced).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} {new Date(lastSynced).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}
                    </div>
                </div>

                {/* Daily habits */}
                <div className={styles.widget}>
                    <div className={styles.kanbanHeader}>
                        <ProgressRing done={viewDoneCount} total={allHabits.length} />
                        <div style={{ flex: 1 }}>
                            <div className={styles.widgetTitle}><span className={styles.widgetIcon}>◈</span>{isViewingToday ? 'Today' : shortDate(data.date)}</div>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                {!isViewingToday ? 'View only' : 'Daily tracking'}
                            </div>
                        </div>
                        {overallStreak > 0 && isViewingToday && (
                            <div className={styles.streakBadge}>
                                <span className={styles.streakFire}>🔥</span>
                                <span className={styles.streakCount}>{overallStreak}</span>
                                <span className={styles.streakLabel}>day{overallStreak !== 1 ? 's' : ''}</span>
                            </div>
                        )}
                    </div>

                    {groups.map(([group, habits]) => (
                        <div key={group}>
                            <div className={styles.sectionLabel}>{group}</div>
                            <ul className={styles.habitList}>
                                {habits.map(c => {
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
                                            title={isViewingToday ? 'Click to update' : ''}
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
                                                {best > habitSt && best > 0 && (
                                                    <span style={{ fontSize: 9, color: 'var(--color-text-muted)' }} title="Best streak">🏆{best}</span>
                                                )}
                                            </div>
                                            {urgencyEmoji && !done && (
                                                <span style={{ fontSize: 9, color: '#c07070', fontWeight: 600 }}>streak at risk!</span>
                                            )}
                                            {isViewingToday && <span className={styles.kanbanEdit}>✎</span>}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                    {!isViewingToday && (
                        <div style={{ fontSize: 'var(--text-xs)', fontStyle: 'italic', color: 'var(--color-text-muted)', paddingTop: 'var(--space-2)' }}>
                            Viewing past day — edit disabled
                        </div>
                    )}
                </div>

                {/* Discipline Score Breakdown */}
                <div className={styles.widget}>
                    <div className={styles.widgetHeader}>
                        <div className={styles.widgetTitle}><span className={styles.widgetIcon}>◉</span>Discipline Score</div>
                        <span className={styles.widgetBadge} style={{ fontSize: 18, fontWeight: 800, color: viewScore >= 80 ? '#6db86d' : viewScore >= 50 ? '#c9a84c' : '#c07070' }}>{viewScore}%</span>
                    </div>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: '0 0 var(--space-3)', maxWidth: 'none' }}>
                        Each habit has a weighted contribution. Build streaks to boost your daily score.
                    </p>

                    {/* Per-habit contribution bars */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                        {allHabits.map(h => {
                            const done = getCheck(h.key).done;
                            const contribution = Math.round((h.weight / totalWeight) * 100);
                            const earned = done ? contribution : 0;
                            return (
                                <div key={h.key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                    <span style={{ fontSize: 14, width: 22, textAlign: 'center' }}>{h.icon}</span>
                                    <span style={{ fontSize: 'var(--text-xs)', width: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: done ? 'var(--color-text)' : 'var(--color-text-muted)', fontWeight: done ? 600 : 400 }}>{h.label}</span>
                                    <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--color-border)', overflow: 'hidden', position: 'relative' }}>
                                        <div style={{
                                            width: `${(earned / contribution) * 100}%`,
                                            height: '100%', borderRadius: 4,
                                            background: done ? '#5a9a5a' : 'transparent',
                                            transition: 'width 0.3s ease',
                                        }} />
                                        <div style={{
                                            position: 'absolute', top: 0, right: 0, bottom: 0,
                                            width: 1, background: 'var(--color-text-muted)', opacity: 0.3,
                                        }} />
                                    </div>
                                    <span style={{
                                        fontSize: 'var(--text-xs)', fontWeight: 700, width: 36, textAlign: 'right',
                                        color: done ? '#5a9a5a' : 'var(--color-text-muted)',
                                    }}>
                                        {done ? `+${contribution}` : `+0`}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Formula summary */}
                    <div style={{
                        marginTop: 'var(--space-4)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)',
                        background: 'var(--color-bg-secondary)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                        <span>
                            {allHabits.filter(h => getCheck(h.key).done).length} of {allHabits.length} habits done
                        </span>
                        <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>
                            = {viewScore}% discipline
                        </span>
                    </div>
                </div>

                {/* Habit stats table */}
                <div className={styles.widget}>
                    <div className={styles.widgetHeader}>
                        <div className={styles.widgetTitle}><span className={styles.widgetIcon}>📊</span>Habit Dashboard</div>
                        <span className={styles.widgetBadge}>{history.length} days tracked</span>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: 'var(--text-xs)', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 9, fontWeight: 700 }}>
                                    <td style={{ padding: '8px 6px' }}>Habit</td>
                                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>Rate</td>
                                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>Current 🔥</td>
                                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>Best 🏆</td>
                                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>Weight</td>
                                </tr>
                            </thead>
                            <tbody>
                                {allHabits.map(c => {
                                    const rate = completionRate(c.key);
                                    const current = perHabitStreak(c.key);
                                    const best2 = bestStreak(c.key);
                                    const isPersonalBest = current > 0 && current === best2;
                                    return (
                                        <tr key={c.key} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                            <td style={{ padding: '8px 6px', fontWeight: 600 }}>{c.icon} {c.label}</td>
                                            <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                                                    <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--color-border)', overflow: 'hidden' }}>
                                                        <div style={{ width: `${rate}%`, height: '100%', borderRadius: 2, background: rate >= 80 ? '#5a9a5a' : rate >= 50 ? '#c9a84c' : '#c07070' }} />
                                                    </div>
                                                    <span>{rate}%</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: current > 0 ? 700 : 400, color: current > 0 ? '#e8973a' : 'var(--color-text-muted)' }}>
                                                {current > 0 ? `${current}${isPersonalBest ? ' 🔥' : ''}` : '—'}
                                            </td>
                                            <td style={{ padding: '8px 6px', textAlign: 'center', color: best2 > 0 ? '#c17f3a' : 'var(--color-text-muted)' }}>
                                                {best2 > 0 ? best2 : '—'}
                                            </td>
                                            <td style={{ padding: '8px 6px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                                {Math.round((c.weight / totalWeight) * 100)}%
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Discipline score chart */}
                {chartData.length > 1 && (
                    <div className={styles.widget}>
                        <div className={styles.widgetHeader}>
                            <div className={styles.widgetTitle}><span className={styles.widgetIcon}>◆</span>Discipline Trend</div>
                            <span className={styles.widgetBadge}>All days</span>
                        </div>
                        <BarChart data={chartData} xKey="date" height={160} bars={[{ key: 'Score', color: 'var(--accent-400)', name: 'Discipline %' }]} yDomain={[0, 100]} unit="%" />
                    </div>
                )}

                {/* Monthly contribution heatmap — GitHub-style */}
                {history.length > 1 && (() => {
                    const dateMap = new Map<string, number>();
                    history.forEach(d => {
                        const dayDone = allHabits.filter(h => d.checks?.[h.key]?.done).length;
                        dateMap.set(d.date, allHabits.length > 0 ? dayDone / allHabits.length : 0);
                    });

                    const todayDate = new Date();
                    const totalDays = 5 * 7;
                    const startOffset = totalDays - 1;
                    const cells: { date: string; dow: number; pct: number; dayNum: number; monthStr: string }[] = [];

                    for (let i = startOffset; i >= 0; i--) {
                        const d = new Date(todayDate);
                        d.setDate(d.getDate() - i);
                        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                        cells.push({
                            date: key,
                            dow: d.getDay(),
                            pct: dateMap.get(key) ?? -1,
                            dayNum: d.getDate(),
                            monthStr: d.toLocaleDateString('en-AU', { month: 'short' }),
                        });
                    }

                    const weeks: typeof cells[] = [];
                    for (let i = 0; i < cells.length; i += 7) {
                        weeks.push(cells.slice(i, i + 7));
                    }

                    const monthLabels: (string | null)[] = [];
                    let lastMonth = '';
                    weeks.forEach(week => {
                        const m = week[0].monthStr;
                        if (m !== lastMonth) { monthLabels.push(m); lastMonth = m; }
                        else monthLabels.push(null);
                    });

                    const getColor = (pct: number) => {
                        if (pct < 0) return 'var(--color-bg-secondary)';
                        if (pct === 0) return 'rgba(192,112,112,0.2)';
                        if (pct < 0.4) return 'rgba(90,154,90,0.15)';
                        if (pct < 0.6) return 'rgba(90,154,90,0.3)';
                        if (pct < 0.8) return 'rgba(90,154,90,0.5)';
                        if (pct < 1) return 'rgba(90,154,90,0.7)';
                        return 'rgba(90,154,90,0.9)';
                    };

                    const sz = 16;
                    const gap = 3;
                    const dowLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

                    return (
                        <div className={styles.widget}>
                            <div className={styles.widgetHeader}>
                                <div className={styles.widgetTitle}><span className={styles.widgetIcon}>🟩</span>Monthly Heatmap</div>
                                <span className={styles.widgetBadge}>Last 5 weeks</span>
                            </div>

                            {/* Month labels row */}
                            <div style={{ display: 'flex', paddingLeft: 32, gap, marginBottom: 2 }}>
                                {monthLabels.map((label, i) => (
                                    <div key={i} style={{ width: sz, fontSize: 9, color: 'var(--color-text-muted)', fontWeight: 600, textAlign: 'left' }}>
                                        {label ?? ''}
                                    </div>
                                ))}
                            </div>

                            {/* Grid: 7 rows × N columns */}
                            <div style={{ display: 'flex', gap }}>
                                {/* Day-of-week labels */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap, width: 28, flexShrink: 0 }}>
                                    {dowLabels.map((label, i) => (
                                        <div key={i} style={{ height: sz, display: 'flex', alignItems: 'center', fontSize: 9, color: 'var(--color-text-muted)', fontWeight: 500 }}>
                                            {label}
                                        </div>
                                    ))}
                                </div>
                                {/* Week columns */}
                                {weeks.map((week, wi) => (
                                    <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap }}>
                                        {week.map((cell, ci) => (
                                            <div key={ci}
                                                title={`${cell.monthStr} ${cell.dayNum}: ${cell.pct < 0 ? 'No data' : `${Math.round(cell.pct * 100)}% complete`}`}
                                                style={{
                                                    width: sz, height: sz, borderRadius: 3,
                                                    background: getColor(cell.pct),
                                                    border: cell.pct >= 1 ? '1px solid #5a9a5a' : cell.pct === 0 ? '1px solid rgba(192,112,112,0.3)' : '1px solid rgba(120,120,120,0.15)',
                                                }}
                                            />
                                        ))}
                                    </div>
                                ))}
                            </div>
                            {/* Legend */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', paddingTop: 'var(--space-3)' }}>
                                <span>Less</span>
                                {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
                                    <div key={i} style={{ width: 12, height: 12, borderRadius: 2, background: getColor(p), border: '1px solid rgba(120,120,120,0.15)' }} />
                                ))}
                                <span>More</span>
                            </div>
                        </div>
                    );
                })()}

                {/* 14-day history table */}
                {history.length > 1 && (
                    <div className={styles.widget}>
                        <div className={styles.widgetHeader}>
                            <div className={styles.widgetTitle}><span className={styles.widgetIcon}>🗓</span>Recent History</div>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', fontSize: 'var(--text-xs)', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                        <td style={{ padding: '6px', fontWeight: 700, color: 'var(--color-text-muted)' }}>Date</td>
                                        {allHabits.map(h => (
                                            <td key={h.key} style={{ padding: '6px', textAlign: 'center', fontSize: 14 }} title={h.label}>{h.icon}</td>
                                        ))}
                                        <td style={{ padding: '6px', textAlign: 'center', fontWeight: 700, color: 'var(--color-text-muted)' }}>Score</td>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...history].reverse().slice(0, 14).map(d => {
                                        const dayDone = allHabits.filter(h => d.checks?.[h.key]?.done).length;
                                        const dayTotal = allHabits.length;
                                        return (
                                            <tr key={d.date} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                                <td style={{ padding: '6px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{shortDate(d.date)}</td>
                                                {allHabits.map(h => {
                                                    const done = d.checks?.[h.key]?.done;
                                                    return (
                                                        <td key={h.key} style={{ padding: '6px', textAlign: 'center' }}>
                                                            {done ? (
                                                                <span style={{ color: '#5a9a5a', fontWeight: 700 }}>✓</span>
                                                            ) : (
                                                                <span style={{ color: '#c07070' }}>✗</span>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                                <td style={{ padding: '6px', textAlign: 'center', fontWeight: 700, color: dayDone === dayTotal ? '#5a9a5a' : '#c9a84c' }}>
                                                    {dayTotal > 0 ? `${Math.round((dayDone / dayTotal) * 100)}%` : '—'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </DashboardShell>
    );
}
