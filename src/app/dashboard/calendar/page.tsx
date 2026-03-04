'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import styles from '../dashboard.module.css';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CalendarEvent {
    id: string;
    google_event_id: string | null;
    account: string | null;
    title: string;
    description: string | null;
    location: string | null;
    start_time: string;
    end_time: string;
    all_day: boolean;
    color: string | null;
    source: string;
    source_id: string | null;
    status: string;
    is_flexible: boolean;
}

interface ConnectedAccount {
    account: string;
    email: string;
}

type ViewMode = 'day' | 'week' | 'month';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const AEST = 'Australia/Melbourne';

function toAESTDate(d: Date): string {
    return d.toLocaleDateString('en-CA', { timeZone: AEST });
}

function toAESTTime(d: Date): string {
    return d.toLocaleTimeString('en-AU', { timeZone: AEST, hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatHour(h: number): string {
    if (h === 0) return '12 AM';
    if (h < 12) return `${h} AM`;
    if (h === 12) return '12 PM';
    return `${h - 12} PM`;
}

function getWeekDays(date: Date): Date[] {
    const d = new Date(date);
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((day + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
        const dd = new Date(monday);
        dd.setDate(monday.getDate() + i);
        return dd;
    });
}

function isSameDay(a: Date, b: Date): boolean {
    return toAESTDate(a) === toAESTDate(b);
}

const accountColors: Record<string, { bg: string; border: string; text: string }> = {
    personal: { bg: 'rgba(90,130,200,0.18)', border: '#5a82c8', text: '#7aa0e0' },
    business: { bg: 'rgba(90,170,120,0.18)', border: '#5aaa78', text: '#7ac89a' },
    task: { bg: 'rgba(193,127,58,0.18)', border: '#c17f3a', text: '#d4a05a' },
    habit: { bg: 'rgba(154,90,170,0.18)', border: '#9a5aaa', text: '#b87ac8' },
};

function eventColor(ev: CalendarEvent) {
    if (ev.color) return { bg: `${ev.color}25`, border: ev.color, text: ev.color };
    return accountColors[ev.source === 'task' ? 'task' : ev.source === 'habit' ? 'habit' : ev.account ?? 'personal'] ?? accountColors.personal;
}

const shortDay = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const shortMonth = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [view, setView] = useState<ViewMode>('day');
    const [selectedDate, setSelectedDate] = useState(() => new Date());
    const [showCreate, setShowCreate] = useState(false);
    const [createSlot, setCreateSlot] = useState<{ start: string; end: string } | null>(null);

    const dateStr = toAESTDate(selectedDate);

    // Load events
    const fetchEvents = useCallback(async (sync = false) => {
        if (sync) setSyncing(true);
        try {
            const weekDays = getWeekDays(selectedDate);
            const start = new Date(weekDays[0]);
            start.setDate(start.getDate() - 7); // Buffer
            const end = new Date(weekDays[6]);
            end.setDate(end.getDate() + 7);

            const url = `/api/dashboard/calendar?start=${start.toISOString()}&end=${end.toISOString()}${sync ? '&sync=true' : ''}`;
            const res = await fetch(url);
            const data = await res.json();
            setEvents(data.events ?? []);
            setAccounts(data.connectedAccounts ?? []);
        } catch (e) {
            console.error('Failed to fetch calendar:', e);
        }
        setLoading(false);
        setSyncing(false);
    }, [selectedDate]);

    useEffect(() => { fetchEvents(true); }, [fetchEvents]);

    // Navigate
    const navigate = (delta: number) => {
        setSelectedDate(prev => {
            const d = new Date(prev);
            if (view === 'day') d.setDate(d.getDate() + delta);
            else if (view === 'week') d.setDate(d.getDate() + 7 * delta);
            else d.setMonth(d.getMonth() + delta);
            return d;
        });
    };

    const goToday = () => setSelectedDate(new Date());

    // Create event
    const handleCreateEvent = async (title: string, start: string, end: string, account: string) => {
        try {
            const res = await fetch('/api/dashboard/calendar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    start_time: start,
                    end_time: end,
                    account: account || null,
                    source: account ? 'google' : 'task',
                }),
            });
            if (res.ok) {
                setShowCreate(false);
                setCreateSlot(null);
                fetchEvents(true);
            }
        } catch (e) {
            console.error('Create failed:', e);
        }
    };

    // Delete event
    const handleDelete = async (id: string) => {
        if (!confirm('Delete this event?')) return;
        try {
            await fetch(`/api/dashboard/calendar?id=${id}`, { method: 'DELETE' });
            fetchEvents();
        } catch (e) {
            console.error('Delete failed:', e);
        }
    };

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <div style={{ padding: 'var(--space-4)', maxWidth: 1200, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>
                    📅 Calendar
                </h1>

                <div style={{ display: 'flex', gap: 4, background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)', padding: 2 }}>
                    {(['day', 'week', 'month'] as ViewMode[]).map(v => (
                        <button
                            key={v}
                            onClick={() => setView(v)}
                            style={{
                                padding: '4px 12px', borderRadius: 'var(--radius-sm)', border: 'none',
                                background: view === v ? 'var(--color-accent)' : 'transparent',
                                color: view === v ? 'white' : 'var(--color-text-muted)',
                                fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer',
                                textTransform: 'capitalize',
                            }}
                        >
                            {v}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <button onClick={() => navigate(-1)} style={navBtnStyle}>←</button>
                    <button onClick={goToday} style={{ ...navBtnStyle, padding: '4px 10px', fontSize: 'var(--text-xs)' }}>Today</button>
                    <button onClick={() => navigate(1)} style={navBtnStyle}>→</button>
                </div>

                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)' }}>
                    {view === 'day' && `${shortDay[selectedDate.getDay()]}, ${shortMonth[selectedDate.getMonth()]} ${selectedDate.getDate()}`}
                    {view === 'week' && (() => {
                        const days = getWeekDays(selectedDate);
                        return `${shortMonth[days[0].getMonth()]} ${days[0].getDate()} – ${shortMonth[days[6].getMonth()]} ${days[6].getDate()}`;
                    })()}
                    {view === 'month' && `${shortMonth[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`}
                </span>

                <div style={{ flex: 1 }} />

                {syncing && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Syncing…</span>}

                <button onClick={() => fetchEvents(true)} style={{ ...navBtnStyle, fontSize: 'var(--text-xs)', padding: '4px 10px' }}>
                    🔄 Sync
                </button>

                <button
                    onClick={() => { setCreateSlot(null); setShowCreate(true); }}
                    style={{
                        padding: '4px 12px', borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-accent)',
                        background: 'var(--color-accent)', color: 'white',
                        fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer',
                    }}
                >
                    + New Event
                </button>

                {/* Account status */}
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    {['personal', 'business'].map(acc => {
                        const connected = accounts.some(a => a.account === acc);
                        return (
                            <span key={acc} style={{
                                fontSize: 9, fontWeight: 600, padding: '2px 6px',
                                borderRadius: 'var(--radius-sm)',
                                background: connected ? 'rgba(90,154,90,0.15)' : 'rgba(192,112,112,0.15)',
                                color: connected ? '#5a9a5a' : '#c07070',
                            }}>
                                {connected ? '●' : '○'} {acc}
                            </span>
                        );
                    })}
                </div>
            </div>

            {/* Connect prompts */}
            {!loading && accounts.length < 2 && (
                <div style={{
                    padding: 'var(--space-3)', marginBottom: 'var(--space-3)',
                    background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)',
                    borderRadius: 'var(--radius-md)', fontSize: 'var(--text-xs)',
                }}>
                    <strong style={{ color: '#c9a84c' }}>Connect Google Calendar</strong>
                    <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                        {!accounts.some(a => a.account === 'personal') && (
                            <a href="/api/auth/google/connect?account=personal" style={{ color: accountColors.personal.text, textDecoration: 'underline' }}>
                                Connect Personal (lukaspnilsson@gmail.com)
                            </a>
                        )}
                        {!accounts.some(a => a.account === 'business') && (
                            <a href="/api/auth/google/connect?account=business" style={{ color: accountColors.business.text, textDecoration: 'underline' }}>
                                Connect Business (lukasnilssonbusiness@gmail.com)
                            </a>
                        )}
                    </div>
                </div>
            )}

            {/* Calendar views */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-muted)' }}>Loading calendar…</div>
            ) : view === 'day' ? (
                <DayView events={events} date={selectedDate} onSlotClick={(start, end) => { setCreateSlot({ start, end }); setShowCreate(true); }} onDelete={handleDelete} />
            ) : view === 'week' ? (
                <WeekView events={events} selectedDate={selectedDate} onDayClick={(d) => { setSelectedDate(d); setView('day'); }} />
            ) : (
                <MonthView events={events} selectedDate={selectedDate} onDayClick={(d) => { setSelectedDate(d); setView('day'); }} />
            )}

            {/* Create modal */}
            {showCreate && (
                <CreateEventModal
                    accounts={accounts}
                    defaultStart={createSlot?.start}
                    defaultEnd={createSlot?.end}
                    onClose={() => { setShowCreate(false); setCreateSlot(null); }}
                    onCreate={handleCreateEvent}
                />
            )}
        </div>
    );
}

// ─── Day View ────────────────────────────────────────────────────────────────

function DayView({ events, date, onSlotClick, onDelete }: {
    events: CalendarEvent[];
    date: Date;
    onSlotClick: (start: string, end: string) => void;
    onDelete: (id: string) => void;
}) {
    const dateStr = toAESTDate(date);
    const HOUR_HEIGHT = 52;
    const START_HOUR = 6;
    const END_HOUR = 23;
    const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

    // Filter events for this day
    const dayEvents = useMemo(() =>
        events.filter(ev => {
            const evStart = new Date(ev.start_time);
            const evEnd = new Date(ev.end_time);
            return toAESTDate(evStart) === dateStr || toAESTDate(evEnd) === dateStr ||
                (evStart <= date && evEnd >= date);
        }).filter(ev => !ev.all_day),
        [events, dateStr, date]
    );

    const allDayEvents = useMemo(() =>
        events.filter(ev => ev.all_day && toAESTDate(new Date(ev.start_time)) <= dateStr && toAESTDate(new Date(ev.end_time)) >= dateStr),
        [events, dateStr]
    );

    // Current time indicator
    const now = new Date();
    const isToday = isSameDay(now, date);
    const nowMinutes = isToday ? parseInt(toAESTTime(now).split(':')[0]) * 60 + parseInt(toAESTTime(now).split(':')[1]) : -1;
    const nowTop = ((nowMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;

    return (
        <div>
            {/* All-day events */}
            {allDayEvents.length > 0 && (
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
                    {allDayEvents.map(ev => {
                        const c = eventColor(ev);
                        return (
                            <div key={ev.id} style={{
                                padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                                background: c.bg, borderLeft: `3px solid ${c.border}`,
                                fontSize: 'var(--text-xs)', color: c.text, fontWeight: 600,
                            }}>
                                {ev.title}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Time grid */}
            <div style={{ position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                {hours.map(h => (
                    <div
                        key={h}
                        onClick={() => {
                            const s = new Date(date);
                            s.setHours(h, 0, 0, 0);
                            const e = new Date(s);
                            e.setHours(h + 1);
                            onSlotClick(s.toISOString(), e.toISOString());
                        }}
                        style={{
                            height: HOUR_HEIGHT, borderBottom: '1px solid var(--color-border)',
                            display: 'flex', alignItems: 'flex-start', cursor: 'pointer',
                        }}
                    >
                        <span style={{
                            width: 54, flexShrink: 0, textAlign: 'right', paddingRight: 'var(--space-2)',
                            paddingTop: 2, fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 500,
                        }}>
                            {formatHour(h)}
                        </span>
                        <div style={{ flex: 1, borderLeft: '1px solid var(--color-border)', height: '100%' }} />
                    </div>
                ))}

                {/* Current time line */}
                {isToday && nowTop > 0 && nowTop < hours.length * HOUR_HEIGHT && (
                    <div style={{
                        position: 'absolute', left: 54, right: 0, top: nowTop,
                        height: 2, background: '#c07070', zIndex: 10,
                        boxShadow: '0 0 4px rgba(192,112,112,0.5)',
                    }}>
                        <div style={{
                            position: 'absolute', left: -4, top: -3, width: 8, height: 8,
                            borderRadius: '50%', background: '#c07070',
                        }} />
                    </div>
                )}

                {/* Events */}
                {dayEvents.map(ev => {
                    const evStart = new Date(ev.start_time);
                    const evEnd = new Date(ev.end_time);
                    const startMins = parseInt(toAESTTime(evStart).split(':')[0]) * 60 + parseInt(toAESTTime(evStart).split(':')[1]);
                    const endMins = parseInt(toAESTTime(evEnd).split(':')[0]) * 60 + parseInt(toAESTTime(evEnd).split(':')[1]);
                    const top = ((startMins - START_HOUR * 60) / 60) * HOUR_HEIGHT;
                    const height = Math.max(((endMins - startMins) / 60) * HOUR_HEIGHT, 20);
                    const c = eventColor(ev);

                    return (
                        <div
                            key={ev.id}
                            style={{
                                position: 'absolute',
                                left: 60, right: 8,
                                top: Math.max(top, 0),
                                height,
                                background: c.bg,
                                borderLeft: `3px solid ${c.border}`,
                                borderRadius: 'var(--radius-sm)',
                                padding: '2px 8px',
                                fontSize: 'var(--text-xs)',
                                overflow: 'hidden',
                                cursor: 'pointer',
                                zIndex: 5,
                                backdropFilter: 'blur(4px)',
                                transition: 'opacity 0.15s',
                            }}
                            title={`${ev.title}\n${toAESTTime(evStart)} – ${toAESTTime(evEnd)}${ev.location ? '\n📍 ' + ev.location : ''}`}
                        >
                            <div style={{ fontWeight: 600, color: c.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {ev.title}
                            </div>
                            {height > 30 && (
                                <div style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>
                                    {toAESTTime(evStart)} – {toAESTTime(evEnd)}
                                    {ev.location && <span> · 📍 {ev.location}</span>}
                                </div>
                            )}
                            {ev.source === 'task' && (
                                <span style={{ fontSize: 9, color: accountColors.task.text, fontWeight: 600 }}>📋 Task</span>
                            )}
                            {ev.is_flexible && (
                                <span style={{ fontSize: 9, color: 'var(--color-text-muted)', marginLeft: 4 }}>~ flexible</span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Week View ───────────────────────────────────────────────────────────────

function WeekView({ events, selectedDate, onDayClick }: {
    events: CalendarEvent[];
    selectedDate: Date;
    onDayClick: (d: Date) => void;
}) {
    const days = getWeekDays(selectedDate);
    const today = toAESTDate(new Date());

    return (
        <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4,
            borderRadius: 'var(--radius-md)', overflow: 'hidden',
        }}>
            {days.map(day => {
                const ds = toAESTDate(day);
                const isToday = ds === today;
                const dayEvents = events.filter(ev => {
                    const s = toAESTDate(new Date(ev.start_time));
                    const e = toAESTDate(new Date(ev.end_time));
                    return s === ds || e === ds || (s < ds && e > ds);
                });

                return (
                    <div
                        key={ds}
                        onClick={() => onDayClick(day)}
                        style={{
                            background: isToday ? 'rgba(90,130,200,0.08)' : 'var(--color-surface)',
                            border: `1px solid ${isToday ? 'rgba(90,130,200,0.3)' : 'var(--color-border)'}`,
                            borderRadius: 'var(--radius-sm)',
                            padding: 'var(--space-2)',
                            minHeight: 140,
                            cursor: 'pointer',
                            transition: 'background 0.15s',
                        }}
                    >
                        <div style={{
                            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                            color: isToday ? '#5a82c8' : 'var(--color-text-muted)',
                            marginBottom: 'var(--space-1)',
                        }}>
                            {shortDay[day.getDay()]}
                        </div>
                        <div style={{
                            fontSize: 'var(--text-lg)', fontWeight: 700,
                            color: isToday ? '#5a82c8' : 'var(--color-text)',
                            marginBottom: 'var(--space-2)',
                        }}>
                            {day.getDate()}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {dayEvents.slice(0, 5).map(ev => {
                                const c = eventColor(ev);
                                return (
                                    <div key={ev.id} style={{
                                        padding: '1px 4px', borderRadius: 2,
                                        background: c.bg, borderLeft: `2px solid ${c.border}`,
                                        fontSize: 9, color: c.text, fontWeight: 500,
                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                    }}>
                                        {!ev.all_day && <span style={{ opacity: 0.7 }}>{toAESTTime(new Date(ev.start_time))} </span>}
                                        {ev.title}
                                    </div>
                                );
                            })}
                            {dayEvents.length > 5 && (
                                <div style={{ fontSize: 9, color: 'var(--color-text-muted)', fontWeight: 600 }}>
                                    +{dayEvents.length - 5} more
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Month View ──────────────────────────────────────────────────────────────

function MonthView({ events, selectedDate, onDayClick }: {
    events: CalendarEvent[];
    selectedDate: Date;
    onDayClick: (d: Date) => void;
}) {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7; // Monday start
    const today = toAESTDate(new Date());

    const cells: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);

    return (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, marginBottom: 1 }}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                    <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', padding: 4, textTransform: 'uppercase' }}>
                        {d}
                    </div>
                ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
                {cells.map((day, i) => {
                    if (!day) return <div key={`empty-${i}`} style={{ background: 'var(--color-bg)', minHeight: 70, borderRadius: 2 }} />;
                    const ds = toAESTDate(day);
                    const isToday = ds === today;
                    const count = events.filter(ev => {
                        const s = toAESTDate(new Date(ev.start_time));
                        return s === ds;
                    }).length;

                    return (
                        <div
                            key={ds}
                            onClick={() => onDayClick(day)}
                            style={{
                                background: isToday ? 'rgba(90,130,200,0.1)' : 'var(--color-surface)',
                                minHeight: 70, borderRadius: 2, padding: 4, cursor: 'pointer',
                                border: isToday ? '1px solid rgba(90,130,200,0.3)' : '1px solid transparent',
                            }}
                        >
                            <div style={{
                                fontSize: 12, fontWeight: isToday ? 700 : 500,
                                color: isToday ? '#5a82c8' : 'var(--color-text)',
                            }}>
                                {day.getDate()}
                            </div>
                            {count > 0 && (
                                <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginTop: 2 }}>
                                    {Array.from({ length: Math.min(count, 4) }).map((_, j) => (
                                        <div key={j} style={{ width: 5, height: 5, borderRadius: '50%', background: '#5a82c8' }} />
                                    ))}
                                    {count > 4 && <span style={{ fontSize: 8, color: 'var(--color-text-muted)' }}>+{count - 4}</span>}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Create Event Modal ──────────────────────────────────────────────────────

function CreateEventModal({ accounts, defaultStart, defaultEnd, onClose, onCreate }: {
    accounts: ConnectedAccount[];
    defaultStart?: string;
    defaultEnd?: string;
    onClose: () => void;
    onCreate: (title: string, start: string, end: string, account: string) => void;
}) {
    const [title, setTitle] = useState('');
    const [startTime, setStartTime] = useState(() => defaultStart ? new Date(defaultStart).toLocaleString('sv-SE', { timeZone: AEST }).replace(' ', 'T').slice(0, 16) : '');
    const [endTime, setEndTime] = useState(() => defaultEnd ? new Date(defaultEnd).toLocaleString('sv-SE', { timeZone: AEST }).replace(' ', 'T').slice(0, 16) : '');
    const [account, setAccount] = useState(accounts[0]?.account ?? '');

    return (
        <div onClick={onClose} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
            <div onClick={e => e.stopPropagation()} style={{
                background: 'var(--color-surface)', borderRadius: 'var(--radius-md)',
                padding: 'var(--space-4)', width: 380, border: '1px solid var(--color-border)',
            }}>
                <h3 style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-text)' }}>
                    New Event
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <input
                        type="text" placeholder="Event title" value={title}
                        onChange={e => setTitle(e.target.value)} autoFocus
                        style={inputStyle}
                    />
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                        <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                    </div>
                    <select value={account} onChange={e => setAccount(e.target.value)} style={inputStyle}>
                        <option value="">No Google sync</option>
                        {accounts.map(a => (
                            <option key={a.account} value={a.account}>{a.email}</option>
                        ))}
                    </select>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={cancelBtnStyle}>Cancel</button>
                    <button
                        onClick={() => {
                            if (!title || !startTime || !endTime) return;
                            const s = new Date(startTime + ':00+11:00').toISOString();
                            const e = new Date(endTime + ':00+11:00').toISOString();
                            onCreate(title, s, e, account);
                        }}
                        disabled={!title || !startTime || !endTime}
                        style={primaryBtnStyle}
                    >
                        Create
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const navBtnStyle: React.CSSProperties = {
    padding: '4px 8px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)', background: 'var(--color-surface)',
    color: 'var(--color-text)', cursor: 'pointer', fontSize: 'var(--text-sm)',
    fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
    padding: '6px 10px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)', background: 'var(--color-bg)',
    color: 'var(--color-text)', fontSize: 'var(--text-xs)',
};

const cancelBtnStyle: React.CSSProperties = {
    padding: '6px 14px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)', background: 'transparent',
    color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)',
    fontWeight: 600, cursor: 'pointer',
};

const primaryBtnStyle: React.CSSProperties = {
    padding: '6px 14px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-accent)', background: 'var(--color-accent)',
    color: 'white', fontSize: 'var(--text-xs)',
    fontWeight: 600, cursor: 'pointer',
};
