'use client';

import { useEffect, useState, useCallback, useMemo, useRef, type DragEvent } from 'react';
import { createPortal } from 'react-dom';
import styles from '../dashboard.module.css';
import DashboardShell from '../DashboardShell';

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

interface ConnectedAccount { account: string; email: string; }

interface TaskInfo {
    task_name: string;
    status: string;
    priority: string | null;
    category: string | null;
    estimated_duration: number | null;
}

type ViewMode = 'day' | 'week' | 'month';

// ─── Constants ───────────────────────────────────────────────────────────────

const AEST = 'Australia/Melbourne';
const HOUR_HEIGHT = 52;
const START_HOUR = 6;
const END_HOUR = 23;
const CACHE_KEY = 'calendar_cache_v1';
const CACHE_TTL = 5 * 60 * 1000; // 5 min

const shortDay = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const shortMonth = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ─── Habit Definitions ───────────────────────────────────────────────────────

interface HabitDef {
    key: string;
    label: string;
    icon: string;
    keywords: string[]; // words that match this habit to an event
}

const HABITS: HabitDef[] = [
    { key: 'teeth', label: 'Brush Teeth', icon: '🦷', keywords: ['teeth', 'brush', 'floss'] },
    { key: 'bedtime', label: 'Bedtime', icon: '🌙', keywords: ['sleep', 'bed', 'chamomile', 'wind'] },
    { key: 'wake', label: 'Wake', icon: '🌅', keywords: ['wake', 'morning'] },
    { key: 'phone_down', label: 'Phone Down', icon: '📱', keywords: ['phone'] },
    { key: 'meditation', label: 'Meditation', icon: '🧘', keywords: ['meditat', 'mindful', 'breathe', 'calm'] },
    { key: 'hydration', label: 'Hydration', icon: '💧', keywords: ['water', 'hydrat', 'drink'] },
];

const accountColors: Record<string, { bg: string; border: string; text: string }> = {
    personal: { bg: 'rgba(90,130,200,0.18)', border: '#5a82c8', text: '#7aa0e0' },
    business: { bg: 'rgba(90,170,120,0.18)', border: '#5aaa78', text: '#7ac89a' },
    task: { bg: 'rgba(193,127,58,0.18)', border: '#c17f3a', text: '#d4a05a' },
    habit: { bg: 'rgba(154,90,170,0.18)', border: '#9a5aaa', text: '#b87ac8' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toAESTDate(d: Date): string { return d.toLocaleDateString('en-CA', { timeZone: AEST }); }
function toAESTTime(d: Date): string { return d.toLocaleTimeString('en-AU', { timeZone: AEST, hour: '2-digit', minute: '2-digit', hour12: false }); }
function formatHour(h: number): string { return h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`; }
function formatDuration(mins: number): string { const h = Math.floor(mins / 60); const m = mins % 60; return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${mins}m`; }
function isSameDay(a: Date, b: Date): boolean { return toAESTDate(a) === toAESTDate(b); }
function eventColor(ev: CalendarEvent) {
    if (ev.color) return { bg: `${ev.color}25`, border: ev.color, text: ev.color };
    return accountColors[ev.source === 'task' ? 'task' : ev.source === 'habit' ? 'habit' : ev.account ?? 'personal'] ?? accountColors.personal;
}

function getWeekDays(date: Date): Date[] {
    const d = new Date(date);
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => { const dd = new Date(monday); dd.setDate(monday.getDate() + i); return dd; });
}

function getMinutesFromAEST(d: Date): number {
    const parts = toAESTTime(d).split(':');
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

// Portal-based hover tooltip — escapes overflow:hidden/auto containers
function HoverTip({ children, label }: { children: React.ReactNode; label: string }) {
    const ref = useRef<HTMLSpanElement>(null);
    const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
    return (
        <span
            ref={ref}
            onMouseEnter={() => {
                if (!ref.current) return;
                const r = ref.current.getBoundingClientRect();
                setPos({ x: r.left + r.width / 2, y: r.top });
            }}
            onMouseLeave={() => setPos(null)}
            style={{ cursor: 'default', position: 'relative', display: 'inline-flex' }}
        >
            {children}
            {pos && createPortal(
                <div style={{
                    position: 'fixed', left: pos.x, top: pos.y - 6,
                    transform: 'translate(-50%, -100%)',
                    padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--neutral-800, #262626)', color: 'var(--neutral-200, #e5e5e5)',
                    fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap',
                    pointerEvents: 'none', zIndex: 9999,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                }}>
                    {label}
                    <div style={{
                        position: 'absolute', top: '100%', left: '50%',
                        transform: 'translateX(-50%)',
                        border: '4px solid transparent',
                        borderTopColor: 'var(--neutral-800, #262626)',
                    }} />
                </div>,
                document.body
            )}
        </span>
    );
}

// ─── Task Matching ───────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
    return text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2);
}

function matchTasksToEvent(ev: CalendarEvent, tasks: TaskInfo[]): TaskInfo[] {
    if (!tasks.length) return [];
    // Direct link via source_id (supports comma-separated multi-task links)
    if (ev.source_id) {
        const ids = ev.source_id.split(',').map(s => s.trim()).filter(Boolean);
        const direct = tasks.filter(t => ids.includes(t.task_name));
        if (direct.length) return direct;
    }
    // Keyword matching
    const evTokens = tokenize(ev.title + ' ' + (ev.description ?? ''));
    if (evTokens.length === 0) return [];
    const matches: { task: TaskInfo; score: number }[] = [];
    for (const task of tasks) {
        const tTokens = tokenize(task.task_name);
        if (tTokens.length === 0) continue;
        // Check exact substring match
        const evLower = (ev.title + ' ' + (ev.description ?? '')).toLowerCase();
        const taskLower = task.task_name.toLowerCase();
        if (evLower.includes(taskLower) || taskLower.includes(ev.title.toLowerCase())) {
            matches.push({ task, score: 10 });
            continue;
        }
        // Keyword overlap
        const overlap = tTokens.filter(w => evTokens.includes(w)).length;
        const ratio = overlap / Math.max(tTokens.length, 1);
        if (overlap >= 2 || ratio >= 0.5) {
            matches.push({ task, score: overlap + ratio * 5 });
        }
    }
    return matches.sort((a, b) => b.score - a.score).map(m => m.task);
}

function matchHabitsToEvent(ev: CalendarEvent): HabitDef[] {
    const evTokens = tokenize(ev.title + ' ' + (ev.description ?? ''));
    if (evTokens.length === 0) return [];
    return HABITS.filter(h => h.keywords.length > 0 && h.keywords.some(kw => evTokens.includes(kw)));
}

// ─── Cache Helpers ───────────────────────────────────────────────────────────

function getCachedData(): { events: CalendarEvent[]; accounts: ConnectedAccount[]; ts: number } | null {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch { return null; }
}

function setCachedData(events: CalendarEvent[], accounts: ConnectedAccount[]) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ events, accounts, ts: Date.now() }));
    } catch { /* quota exceeded — ignore */ }
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
    const [tasks, setTasks] = useState<TaskInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
    const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
    const [view, setView] = useState<ViewMode>('day');
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [createSlot, setCreateSlot] = useState<{ start: string; end: string } | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
    const [mounted, setMounted] = useState(false);
    const [visibleSources, setVisibleSources] = useState<Set<string>>(new Set(['personal', 'business', 'task', 'habit', 'google']));
    const syncInFlight = useRef(false);

    // Responsive
    const [isMobile, setIsMobile] = useState(false);
    const [bottomSheet, setBottomSheet] = useState<'hidden' | 'peek' | 'half' | 'full'>('hidden');
    const [zoomHeight, setZoomHeight] = useState(HOUR_HEIGHT);
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    const calendarBodyRef = useRef<HTMLDivElement>(null);

    const toggleSource = (s: string) => setVisibleSources(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });

    const filteredEvents = useMemo(() => events.filter(ev => {
        // Google/calendar events: filter by account (personal/business)
        if (ev.source === 'google' || ev.source === 'calendar') return visibleSources.has(ev.account ?? 'personal');
        // Task/habit-only events (created from OpenClaw, not synced from Google)
        return visibleSources.has(ev.source);
    }), [events, visibleSources]);

    // Whether to show task UI overlays (chips, pills) on events
    const showTaskUI = visibleSources.has('task');

    // Init — load cached data immediately, then fetch fresh
    useEffect(() => {
        const cached = getCachedData();
        if (cached && Date.now() - cached.ts < CACHE_TTL * 10) {
            setEvents(cached.events);
            setAccounts(cached.accounts);
            setLoading(false);
        }
        setSelectedDate(new Date());
        setMounted(true);
        // Mobile detection
        const mq = window.matchMedia('(max-width: 768px)');
        setIsMobile(mq.matches);
        if (mq.matches) {
            setView('day');
            setZoomHeight(64); // Larger slots on mobile
        }
        const handler = (e: MediaQueryListEvent) => {
            setIsMobile(e.matches);
            if (e.matches) {
                setView('day');
                setZoomHeight(64);
            } else {
                setZoomHeight(HOUR_HEIGHT);
            }
        };
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    // Fetch cached events from Supabase (always fast — no Google sync)
    const fetchEvents = useCallback(async () => {
        if (!selectedDate) return;
        try {
            const weekDays = getWeekDays(selectedDate);
            const start = new Date(weekDays[0]); start.setDate(start.getDate() - 7);
            const end = new Date(weekDays[6]); end.setDate(end.getDate() + 7);
            const url = `/api/dashboard/calendar?start=${start.toISOString()}&end=${end.toISOString()}`;
            const res = await fetch(url);
            const data = await res.json();
            const evts = data.events ?? [];
            const accts = data.connectedAccounts ?? [];
            setEvents(evts);
            setAccounts(accts);
            setCachedData(evts, accts);
        } catch (e) { console.error('Failed to fetch calendar:', e); }
        setLoading(false);
    }, [selectedDate]);

    // Background sync — calls the dedicated sync endpoint, then refreshes cache
    const triggerSync = useCallback(async () => {
        if (syncInFlight.current) return;
        syncInFlight.current = true;
        setSyncStatus('syncing');
        try {
            const res = await fetch('/api/dashboard/calendar/sync', { method: 'POST' });
            if (!res.ok) throw new Error('Sync failed');
            const data = await res.json();
            setLastSyncedAt(new Date(data.lastSyncedAt));
            setSyncStatus('synced');
            // Refresh local cache with fresh data from Supabase
            await fetchEvents();
            // Fade "synced" indicator after 4s
            setTimeout(() => setSyncStatus(prev => prev === 'synced' ? 'idle' : prev), 4000);
        } catch (e) {
            console.error('Sync failed:', e);
            setSyncStatus('error');
        } finally {
            syncInFlight.current = false;
        }
    }, [fetchEvents]);

    // Fetch cache on date change (instant — Supabase only)
    useEffect(() => { if (selectedDate) fetchEvents(); }, [fetchEvents, selectedDate]);

    // Background sync on mount + every 60s
    useEffect(() => {
        if (!mounted) return;
        triggerSync();
        const interval = setInterval(triggerSync, 60_000);
        return () => clearInterval(interval);
    }, [mounted, triggerSync]);

    // Fetch tasks
    useEffect(() => {
        if (!mounted) return;
        (async () => {
            try {
                const res = await fetch('/api/dashboard/tasks');
                if (!res.ok) return;
                const td = await res.json();
                const done = new Set((td.completions ?? []).map((c: { task_name: string }) => c.task_name));
                setTasks((td.metadata ?? []).map((m: { task_name: string; priority?: number; context?: string; estimated_duration?: number }) => ({
                    task_name: m.task_name, status: done.has(m.task_name) ? 'done' : 'open',
                    priority: m.priority ?? null, category: m.context ?? null,
                    estimated_duration: (m as Record<string, unknown>).estimated_duration as number | null ?? null,
                })));
            } catch (e) { console.error('Failed to load tasks:', e); }
        })();
    }, [mounted]);

    const navigate = (delta: number) => {
        setSelectedDate(prev => {
            const d = new Date(prev!);
            if (view === 'day') d.setDate(d.getDate() + delta);
            else if (view === 'week') d.setDate(d.getDate() + 7 * delta);
            else d.setMonth(d.getMonth() + delta);
            return d;
        });
    };

    // ─── CRUD ────────────────────────────────────────────────────────────────

    const handleCreate = async (title: string, start: string, end: string, account: string, source?: string, sourceId?: string) => {
        // Optimistic: add a temporary event to the UI immediately
        const tempId = `temp-${Date.now()}`;
        const optimisticEvent: CalendarEvent = {
            id: tempId, google_event_id: null, account: account || null,
            title, description: null, location: null,
            start_time: start, end_time: end, all_day: false,
            color: null, source: source ?? (account ? 'google' : 'task'),
            source_id: sourceId ?? null, status: 'confirmed', is_flexible: false,
        };
        setEvents(prev => [...prev, optimisticEvent]);
        setShowCreate(false);
        setCreateSlot(null);

        try {
            const res = await fetch('/api/dashboard/calendar', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, start_time: start, end_time: end, account: account || null, source: source ?? (account ? 'google' : 'task'), source_id: sourceId ?? null }),
            });
            if (res.ok) {
                const data = await res.json();
                // Replace temp event with the real one from the server
                setEvents(prev => prev.map(ev => ev.id === tempId ? data.event : ev));
            } else {
                // Revert optimistic add
                setEvents(prev => prev.filter(ev => ev.id !== tempId));
            }
        } catch (e) {
            console.error('Create failed:', e);
            setEvents(prev => prev.filter(ev => ev.id !== tempId));
        }
    };

    const handleUpdate = async (id: string, updates: Partial<{ title: string; start_time: string; end_time: string; description: string; source_id: string }>) => {
        // Optimistic: apply updates immediately
        const rollback = events;
        setEvents(prev => prev.map(ev => ev.id === id ? { ...ev, ...updates } : ev));
        setEditEvent(null);
        setSelectedEvent(null);

        try {
            const res = await fetch('/api/dashboard/calendar', {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, ...updates }),
            });
            if (res.ok) {
                const data = await res.json();
                setEvents(prev => prev.map(ev => ev.id === id ? data.event : ev));
            } else {
                setEvents(rollback); // Revert
            }
        } catch (e) {
            console.error('Update failed:', e);
            setEvents(rollback);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this event?')) return;
        // Optimistic: remove from UI immediately
        const rollback = events;
        setEvents(prev => prev.filter(ev => ev.id !== id));
        setSelectedEvent(null);

        try {
            const res = await fetch(`/api/dashboard/calendar?id=${id}`, { method: 'DELETE' });
            if (!res.ok) setEvents(rollback); // Revert on failure
        } catch (e) {
            console.error('Delete failed:', e);
            setEvents(rollback);
        }
    };

    // ─── Drag & Drop ─────────────────────────────────────────────────────────

    const handleDrop = async (taskName: string, date: Date, hour: number, duration: number) => {
        const start = new Date(date);
        start.setHours(hour, 0, 0, 0);
        const end = new Date(start.getTime() + duration * 60000);
        await handleCreate(taskName, start.toISOString(), end.toISOString(), '', 'task', taskName);
    };

    // Drop a task onto an existing event to link them
    const handleLinkToEvent = async (eventId: string, taskName: string) => {
        // Append task to existing comma-separated list (don't overwrite)
        const existing = events.find(e => e.id === eventId);
        const currentIds = existing?.source_id ? existing.source_id.split(',').map(s => s.trim()).filter(Boolean) : [];
        if (currentIds.includes(taskName)) return; // Already linked
        const newSourceId = [...currentIds, taskName].join(',');
        await handleUpdate(eventId, { source_id: newSourceId });
    };

    // Drag an existing event to a new time slot
    const handleEventMove = async (eventId: string, newStart: string, newEnd: string) => {
        await handleUpdate(eventId, { start_time: newStart, end_time: newEnd });
    };

    // Tasks that are linked to any event via source_id are 'scheduled'
    const linkedTaskNames = useMemo(() => {
        const names = new Set<string>();
        events.forEach(e => {
            if (e.source_id) e.source_id.split(',').map(s => s.trim()).filter(Boolean).forEach(n => names.add(n));
        });
        return names;
    }, [events]);

    // Mobile: 3-day week view centred on selectedDate
    const mobileWeekDates = useMemo(() => {
        if (!selectedDate) return [];
        const prev = new Date(selectedDate); prev.setDate(prev.getDate() - 1);
        const next = new Date(selectedDate); next.setDate(next.getDate() + 1);
        return [prev, selectedDate, next];
    }, [selectedDate]);

    // Touch refs (must be before guard for Rules of Hooks)
    const touchStart = useRef<{ x: number; y: number; t: number } | null>(null);
    const lastPinchDist = useRef<number | null>(null);

    // Desktop: Ctrl+scroll to zoom (native event to allow preventDefault on non-passive listener)
    useEffect(() => {
        const el = calendarBodyRef.current;
        if (!el) return;
        const handler = (e: WheelEvent) => {
            if (!e.ctrlKey && !e.metaKey) return;
            e.preventDefault();
            setZoomHeight(h => Math.min(120, Math.max(32, h - e.deltaY * 0.3)));
        };
        el.addEventListener('wheel', handler, { passive: false });
        return () => el.removeEventListener('wheel', handler);
    });

    // ─── Guard ───────────────────────────────────────────────────────────────

    if (!mounted || !selectedDate) {
        return <DashboardShell><div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading calendar…</div></DashboardShell>;
    }

    const unscheduledTasks = tasks.filter(t => t.status === 'open' && !linkedTaskNames.has(t.task_name));
    const selectedTasks = selectedEvent?.source_id
        ? selectedEvent.source_id.split(',').map(s => s.trim()).filter(Boolean).map(n => tasks.find(t => t.task_name === n)).filter(Boolean) as TaskInfo[]
        : [];

    // Mobile: open bottom sheet when an event is tapped
    const handleEventSelect = (ev: CalendarEvent) => {
        setSelectedEvent(ev);
        if (isMobile) setBottomSheet('half');
    };

    // Touch swipe for day navigation
    const handleTouchStart = (e: React.TouchEvent) => {
        const t = e.touches[0];
        touchStart.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    };
    const handleTouchEnd = (e: React.TouchEvent) => {
        if (!touchStart.current) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - touchStart.current.x;
        const dy = Math.abs(t.clientY - touchStart.current.y);
        const dt = Date.now() - touchStart.current.t;
        touchStart.current = null;
        if (Math.abs(dx) > 50 && dy < 80 && dt < 500) {
            navigate(dx < 0 ? 1 : -1);
        }
    };

    // Pinch to zoom hour height (mobile) / Ctrl+scroll (desktop)
    const handlePinchMove = (e: React.TouchEvent) => {
        if (e.touches.length !== 2 || !isMobile) return;
        const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        if (lastPinchDist.current !== null) {
            const delta = dist - lastPinchDist.current;
            setZoomHeight(h => Math.min(120, Math.max(32, h + delta * 0.5)));
        }
        lastPinchDist.current = dist;
    };
    const handlePinchEnd = () => { lastPinchDist.current = null; };

    // ─── Render ──────────────────────────────────────────────────────────────

    const dateLabel = view === 'day'
        ? `${shortDay[selectedDate.getDay()]}, ${shortMonth[selectedDate.getMonth()]} ${selectedDate.getDate()}`
        : view === 'week'
            ? (() => { const d = getWeekDays(selectedDate); return `${shortMonth[d[0].getMonth()]} ${d[0].getDate()} – ${shortMonth[d[6].getMonth()]} ${d[6].getDate()}`; })()
            : `${shortMonth[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;

    const calendarBody = loading && events.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-muted)' }}>Loading…</div>
    ) : view === 'day' ? (
        <TimeGrid events={filteredEvents} dates={[selectedDate]} tasks={tasks} showTaskUI={showTaskUI} showHabitUI={visibleSources.has('habit')} onSlotClick={(s, e) => { setCreateSlot({ start: s, end: e }); setShowCreate(true); }} onEventClick={handleEventSelect} onDrop={handleDrop} onLinkToEvent={handleLinkToEvent} onEventMove={handleEventMove} onEventResize={handleEventMove} isMobile={isMobile} hourHeight={zoomHeight} />
    ) : view === 'week' ? (
        <TimeGrid events={filteredEvents} dates={isMobile ? mobileWeekDates : getWeekDays(selectedDate)} tasks={tasks} showTaskUI={showTaskUI} showHabitUI={visibleSources.has('habit')} onSlotClick={(s, e) => { setCreateSlot({ start: s, end: e }); setShowCreate(true); }} onEventClick={handleEventSelect} onDrop={handleDrop} onLinkToEvent={handleLinkToEvent} onEventMove={handleEventMove} onEventResize={handleEventMove} isMobile={isMobile} hourHeight={zoomHeight} />
    ) : (
        <MonthView events={filteredEvents} selectedDate={selectedDate} onDayClick={(d) => { setSelectedDate(d); setView('day'); }} />
    );

    return (
        <DashboardShell>
            <div style={{ display: 'flex', height: '100%', overflow: 'hidden', position: 'relative' }}>
                {/* Main area */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                    {/* ─── Header ─── */}
                    {isMobile ? (
                        /* Mobile: compact two-row header */
                        <div style={{ flexShrink: 0, borderBottom: '1px solid var(--color-border)' }}>
                            {/* Row 1: nav + date */}
                            <div style={{ display: 'flex', alignItems: 'center', height: 44, padding: '0 var(--space-3)', gap: 'var(--space-2)' }}>
                                <button onClick={() => navigate(-1)} style={{ ...navBtnStyle, minWidth: 36, minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
                                <button onClick={() => setSelectedDate(new Date())} style={{ ...navBtnStyle, minHeight: 36, padding: '0 10px', fontSize: 'var(--text-xs)' }}>Today</button>
                                <button onClick={() => navigate(1)} style={{ ...navBtnStyle, minWidth: 36, minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>→</button>
                                <span style={{ flex: 1, textAlign: 'center', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text)' }}>{dateLabel}</span>
                                {syncStatus === 'syncing' && <span style={{ width: 10, height: 10, border: '2px solid var(--color-text-muted)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />}
                                {syncStatus === 'error' && <span onClick={triggerSync} style={{ width: 8, height: 8, borderRadius: '50%', background: '#c07070', cursor: 'pointer', flexShrink: 0 }} />}
                                <button onClick={() => setShowMobileFilters(p => !p)} style={{ ...navBtnStyle, minWidth: 36, minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>⋯</button>
                            </div>
                            {/* Row 2: view toggle + filters (collapsible) */}
                            {showMobileFilters && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', borderTop: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', gap: 2, background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)', padding: 2 }}>
                                        {(['day', 'week', 'month'] as ViewMode[]).map(v => (
                                            <button key={v} onClick={() => setView(v)} style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: view === v ? 'var(--color-accent)' : 'transparent', color: view === v ? 'white' : 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize', minHeight: 32 }}>{v}</button>
                                        ))}
                                    </div>
                                    {[{ k: 'personal', l: 'P' }, { k: 'business', l: 'B' }, { k: 'task', l: 'T' }, { k: 'habit', l: 'H' }].map(({ k, l }) => {
                                        const c = accountColors[k], on = visibleSources.has(k);
                                        return <button key={k} onClick={() => toggleSource(k)} style={{ fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: `1px solid ${on ? c.border : 'var(--color-border)'}`, background: on ? c.bg : 'transparent', color: on ? c.text : 'var(--color-text-muted)', cursor: 'pointer', opacity: on ? 1 : 0.4, minHeight: 32 }}>{on ? '●' : '○'} {l}</button>;
                                    })}
                                    <SyncIndicator status={syncStatus} lastSyncedAt={lastSyncedAt} onSync={triggerSync} />
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Desktop: original header */
                        <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap', flexShrink: 0 }}>
                            <h1 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>📅 Calendar</h1>
                            <div style={{ display: 'flex', gap: 4, background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)', padding: 2 }}>
                                {(['day', 'week', 'month'] as ViewMode[]).map(v => (
                                    <button key={v} onClick={() => setView(v)} style={{ padding: '4px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: view === v ? 'var(--color-accent)' : 'transparent', color: view === v ? 'white' : 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>{v}</button>
                                ))}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <button onClick={() => navigate(-1)} style={navBtnStyle}>←</button>
                                <button onClick={() => setSelectedDate(new Date())} style={{ ...navBtnStyle, padding: '4px 10px', fontSize: 'var(--text-xs)' }}>Today</button>
                                <button onClick={() => navigate(1)} style={navBtnStyle}>→</button>
                            </div>
                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)' }}>{dateLabel}</span>
                            <div style={{ flex: 1 }} />
                            <SyncIndicator status={syncStatus} lastSyncedAt={lastSyncedAt} onSync={triggerSync} />
                            {/* Zoom controls */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)', padding: '1px 2px', border: '1px solid var(--color-border)' }}>
                                <button onClick={() => setZoomHeight(h => Math.max(32, h - 8))} style={{ ...navBtnStyle, padding: '2px 6px', fontSize: 12, border: 'none', background: 'transparent' }}>−</button>
                                <span style={{ fontSize: 9, color: 'var(--color-text-muted)', fontWeight: 600, minWidth: 28, textAlign: 'center' }}>{Math.round(zoomHeight)}px</span>
                                <button onClick={() => setZoomHeight(h => Math.min(120, h + 8))} style={{ ...navBtnStyle, padding: '2px 6px', fontSize: 12, border: 'none', background: 'transparent' }}>+</button>
                            </div>
                            <button onClick={() => { setCreateSlot(null); setShowCreate(true); }} style={{ padding: '4px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-accent)', background: 'var(--color-accent)', color: 'white', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer' }}>+ Event</button>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                                {[{ k: 'personal', l: 'Personal' }, { k: 'business', l: 'Business' }, { k: 'task', l: 'Tasks' }, { k: 'habit', l: 'Habits' }].map(({ k, l }) => {
                                    const c = accountColors[k], on = visibleSources.has(k);
                                    return <button key={k} onClick={() => toggleSource(k)} style={{ fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-sm)', border: `1px solid ${on ? c.border : 'var(--color-border)'}`, background: on ? c.bg : 'transparent', color: on ? c.text : 'var(--color-text-muted)', cursor: 'pointer', opacity: on ? 1 : 0.4, transition: 'all 0.15s' }}>{on ? '●' : '○'} {l}</button>;
                                })}
                            </div>
                        </div>
                    )}

                    {/* Connect prompts (desktop only) */}
                    {!isMobile && !loading && accounts.length < 2 && (
                        <div style={{ padding: 'var(--space-2) var(--space-4)', background: 'rgba(201,168,76,0.06)', borderBottom: '1px solid rgba(201,168,76,0.15)', fontSize: 'var(--text-xs)' }}>
                            <strong style={{ color: '#c9a84c' }}>Connect: </strong>
                            {!accounts.some(a => a.account === 'personal') && <a href="/api/auth/google/connect?account=personal" style={{ color: accountColors.personal.text, textDecoration: 'underline', marginRight: 12 }}>Personal</a>}
                            {!accounts.some(a => a.account === 'business') && <a href="/api/auth/google/connect?account=business" style={{ color: accountColors.business.text, textDecoration: 'underline' }}>Business</a>}
                        </div>
                    )}

                    {/* Calendar body with touch/scroll gestures */}
                    <div
                        ref={calendarBodyRef}
                        onTouchStart={isMobile ? handleTouchStart : undefined}
                        onTouchEnd={isMobile ? handleTouchEnd : undefined}
                        onTouchMove={isMobile ? handlePinchMove : undefined}
                        onTouchCancel={isMobile ? handlePinchEnd : undefined}
                        style={{ flex: 1, overflow: 'auto', touchAction: 'pan-y' }}
                    >
                        {calendarBody}
                    </div>
                </div>

                {/* Desktop sidebar */}
                {!isMobile && (
                    <div style={{ width: 260, flexShrink: 0, borderLeft: '1px solid var(--color-border)', padding: 'var(--space-3)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                        {selectedEvent ? (
                            <EventDetail event={selectedEvent} tasks={selectedTasks} onClose={() => setSelectedEvent(null)} onEdit={() => { setEditEvent(selectedEvent); setSelectedEvent(null); }} onDelete={() => handleDelete(selectedEvent.id)} />
                        ) : (
                            <TaskSidebar tasks={unscheduledTasks} />
                        )}
                    </div>
                )}

                {/* Mobile: FAB */}
                {isMobile && (
                    <button
                        onClick={() => { setCreateSlot(null); setShowCreate(true); }}
                        style={{
                            position: 'absolute', bottom: bottomSheet !== 'hidden' ? 'calc(60px + var(--space-4))' : 'var(--space-4)',
                            right: 'var(--space-4)', width: 56, height: 56, borderRadius: '50%',
                            background: 'var(--color-accent)', border: 'none', color: 'white',
                            fontSize: 24, fontWeight: 700, cursor: 'pointer',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            zIndex: 50, transition: 'bottom 0.3s ease',
                        }}
                    >+</button>
                )}

                {/* Mobile: Bottom Sheet */}
                {isMobile && (
                    <BottomSheet
                        state={bottomSheet}
                        onStateChange={setBottomSheet}
                        peekLabel={`${unscheduledTasks.length} unscheduled task${unscheduledTasks.length !== 1 ? 's' : ''}`}
                    >
                        {selectedEvent ? (
                            <EventDetail
                                event={selectedEvent}
                                tasks={selectedTasks}
                                onClose={() => { setSelectedEvent(null); setBottomSheet('peek'); }}
                                onEdit={() => { setEditEvent(selectedEvent); setSelectedEvent(null); setBottomSheet('hidden'); }}
                                onDelete={() => { handleDelete(selectedEvent.id); setBottomSheet('peek'); }}
                            />
                        ) : (
                            <TaskSidebar tasks={unscheduledTasks} />
                        )}
                    </BottomSheet>
                )}
            </div>

            {/* Modals */}
            {showCreate && <EventModal mode="create" accounts={accounts} defaultStart={createSlot?.start} defaultEnd={createSlot?.end} onClose={() => { setShowCreate(false); setCreateSlot(null); }} onSubmit={(t, s, e, a) => handleCreate(t, s, e, a)} isMobile={isMobile} />}
            {editEvent && <EventModal mode="edit" event={editEvent} accounts={accounts} onClose={() => setEditEvent(null)} onSubmit={(t, s, e, _a, desc) => handleUpdate(editEvent.id, { title: t, start_time: s, end_time: e, description: desc })} isMobile={isMobile} />}
        </DashboardShell>
    );
}

// ─── TimeGrid (shared day/week) ──────────────────────────────────────────────

function TimeGrid({ events, dates, tasks, showTaskUI, showHabitUI, onSlotClick, onEventClick, onDrop, onLinkToEvent, onEventMove, onEventResize, isMobile = false, hourHeight = HOUR_HEIGHT }: {
    events: CalendarEvent[];
    dates: Date[];
    tasks: TaskInfo[];
    showTaskUI: boolean;
    showHabitUI: boolean;
    onSlotClick: (start: string, end: string) => void;
    onEventClick: (ev: CalendarEvent) => void;
    onDrop: (taskName: string, date: Date, hour: number, duration: number) => void;
    onLinkToEvent: (eventId: string, taskName: string) => void;
    onEventMove: (eventId: string, newStart: string, newEnd: string) => void;
    onEventResize?: (eventId: string, newStart: string, newEnd: string) => void;
    isMobile?: boolean;
    hourHeight?: number;
}) {
    const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
    const isMulti = dates.length > 1;
    const now = new Date();
    const gridRef = useRef<HTMLDivElement>(null);
    const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const wasDragging = useRef(false);

    // Resize state
    const [resizingId, setResizingId] = useState<string | null>(null);
    const [resizePreviewHeight, setResizePreviewHeight] = useState<number | null>(null);
    const resizeStart = useRef<{ eventId: string; startTime: string; colEl: HTMLElement; initialEndMins: number; headerOffset: number } | null>(null);

    // Scroll to 7am on mount
    useEffect(() => {
        if (gridRef.current) {
            gridRef.current.scrollTop = (7 - START_HOUR) * hourHeight;
        }
    }, [dates.length]);

    const handleDragOver = (e: DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };

    return (
        <div ref={gridRef} style={{ display: 'flex', height: '100%', overflow: 'auto' }}>
            {/* Time labels */}
            <div style={{ width: 48, flexShrink: 0, paddingTop: isMulti ? 36 : 0 }}>
                {hours.map(h => (
                    <div key={h} style={{ height: hourHeight, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: 6, paddingTop: 2 }}>
                        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 500 }}>{formatHour(h)}</span>
                    </div>
                ))}
            </div>

            {/* Day columns */}
            {dates.map(date => {
                const ds = toAESTDate(date);
                const isToday = isSameDay(now, date);
                const nowMins = isToday ? getMinutesFromAEST(now) : -1;
                const nowTop = ((nowMins - START_HOUR * 60) / 60) * hourHeight;

                const dayEvents = events.filter(ev => {
                    if (ev.all_day) return false;
                    const s = toAESTDate(new Date(ev.start_time));
                    const e = toAESTDate(new Date(ev.end_time));
                    return s === ds || e === ds || (s < ds && e > ds);
                });

                const allDayEvts = events.filter(ev => ev.all_day && toAESTDate(new Date(ev.start_time)) <= ds && toAESTDate(new Date(ev.end_time)) >= ds);

                return (
                    <div key={ds} data-col style={{ flex: 1, minWidth: isMulti ? 80 : 0, borderLeft: '1px solid var(--color-border)', position: 'relative' }}>
                        {/* Column header (week only) */}
                        {isMulti && (
                            <div style={{ height: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(--color-border)', background: isToday ? 'rgba(90,130,200,0.06)' : 'transparent', position: 'sticky', top: 0, zIndex: 20 }}>
                                <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: isToday ? '#5a82c8' : 'var(--color-text-muted)' }}>{shortDay[date.getDay()]}</span>
                                <span style={{ fontSize: 14, fontWeight: 700, color: isToday ? '#5a82c8' : 'var(--color-text)' }}>{date.getDate()}</span>
                            </div>
                        )}

                        {/* All-day events */}
                        {allDayEvts.length > 0 && (
                            <div style={{ padding: '2px 4px', borderBottom: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {allDayEvts.map(ev => {
                                    const c = eventColor(ev);
                                    return <div key={ev.id} onClick={() => onEventClick(ev)} style={{ padding: '1px 4px', borderRadius: 2, background: c.bg, borderLeft: `2px solid ${c.border}`, fontSize: 9, color: c.text, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</div>;
                                })}
                            </div>
                        )}

                        {/* Hour slots */}
                        {hours.map(h => {
                            const slotKey = `${ds}-${h}`;
                            return (
                                <div
                                    key={h}
                                    onClick={() => {
                                        const s = new Date(date); s.setHours(h, 0, 0, 0);
                                        const e = new Date(s); e.setHours(h + 1);
                                        onSlotClick(s.toISOString(), e.toISOString());
                                    }}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        setDragOverSlot(slotKey);
                                    }}
                                    onDragLeave={() => setDragOverSlot(prev => prev === slotKey ? null : prev)}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        setDragOverSlot(null);
                                        // Calculate sub-hour offset from drop Y position (snap to 15min)
                                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                        const yInSlot = e.clientY - rect.top;
                                        const fracMins = (yInSlot / hourHeight) * 60;
                                        const snapMins = Math.round(fracMins / 15) * 15;
                                        const minuteOffset = Math.max(0, Math.min(45, snapMins));
                                        const data = e.dataTransfer.getData('text/plain');
                                        try {
                                            const parsed = JSON.parse(data);
                                            if (parsed.eventId) {
                                                // Event move: compute new start/end preserving duration
                                                const newStart = new Date(date);
                                                newStart.setHours(h, minuteOffset, 0, 0);
                                                const newEnd = new Date(newStart.getTime() + (parsed.durationMins ?? 60) * 60000);
                                                onEventMove(parsed.eventId, newStart.toISOString(), newEnd.toISOString());
                                            } else if (parsed.taskName) {
                                                // Task drag from sidebar
                                                onDrop(parsed.taskName, date, h, parsed.duration ?? 30);
                                            }
                                        } catch { /* ignore */ }
                                    }}
                                    style={{
                                        height: hourHeight, borderBottom: '1px solid var(--color-border)',
                                        cursor: 'pointer', position: 'relative',
                                        background: dragOverSlot === slotKey ? 'rgba(90,130,200,0.08)' : undefined,
                                        transition: 'background 0.1s',
                                    }}
                                />
                            );
                        })}

                        {/* Now line */}
                        {isToday && nowTop > 0 && nowTop < hours.length * hourHeight && (
                            <div style={{ position: 'absolute', left: 0, right: 0, top: (isMulti ? 36 : 0) + nowTop, height: 2, background: '#c07070', zIndex: 15, pointerEvents: 'none', boxShadow: '0 0 4px rgba(192,112,112,0.5)' }}>
                                <div style={{ position: 'absolute', left: -3, top: -3, width: 8, height: 8, borderRadius: '50%', background: '#c07070' }} />
                            </div>
                        )}

                        {/* Rendered events */}
                        {dayEvents.map(ev => {
                            const startMins = getMinutesFromAEST(new Date(ev.start_time));
                            const endMins = getMinutesFromAEST(new Date(ev.end_time));
                            const top = ((startMins - START_HOUR * 60) / 60) * hourHeight + (isMulti ? 36 : 0);
                            const height = Math.max(((endMins - startMins) / 60) * hourHeight, 18);
                            const c = eventColor(ev);
                            const matchedTasks = showTaskUI ? matchTasksToEvent(ev, tasks) : [];
                            const matchedHabits = showHabitUI ? matchHabitsToEvent(ev) : [];

                            return (
                                <div
                                    key={ev.id}
                                    draggable
                                    onDragStart={(e) => {
                                        const durationMins = Math.round((new Date(ev.end_time).getTime() - new Date(ev.start_time).getTime()) / 60000);
                                        e.dataTransfer.setData('text/plain', JSON.stringify({ eventId: ev.id, durationMins }));
                                        e.dataTransfer.effectAllowed = 'all';
                                        (e.currentTarget as HTMLElement).style.opacity = '0.4';
                                        setDraggingId(ev.id);
                                        wasDragging.current = true;
                                    }}
                                    onDragEnd={(e) => {
                                        (e.currentTarget as HTMLElement).style.opacity = '1';
                                        setDraggingId(null);
                                        // Suppress the click that fires after drag
                                        setTimeout(() => { wasDragging.current = false; }, 0);
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (wasDragging.current) return; // Suppress click after drag
                                        onEventClick(ev);
                                    }}
                                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                    onDrop={(e) => {
                                        e.preventDefault(); e.stopPropagation();
                                        try {
                                            const parsed = JSON.parse(e.dataTransfer.getData('text/plain'));
                                            if (parsed.taskName) onLinkToEvent(ev.id, parsed.taskName);
                                        } catch { /* ignore */ }
                                    }}
                                    style={{
                                        position: 'absolute', left: 2, right: 2, top: Math.max(top, isMulti ? 36 : 0),
                                        height: resizingId === ev.id && resizePreviewHeight !== null ? resizePreviewHeight : height,
                                        background: c.bg, borderLeft: `3px solid ${c.border}`, borderRadius: 'var(--radius-sm)',
                                        padding: isMobile ? '4px 8px' : '1px 4px', fontSize: isMobile ? 12 : isMulti ? 9 : 'var(--text-xs)',
                                        cursor: 'grab', zIndex: draggingId && draggingId !== ev.id ? 1 : 5,
                                        backdropFilter: 'blur(4px)', transition: 'opacity 0.15s',
                                        userSelect: 'none', WebkitUserSelect: 'none',
                                        // During drag, make OTHER events transparent to drops so slots receive them
                                        pointerEvents: draggingId && draggingId !== ev.id ? 'none' : undefined,
                                    }}
                                    title={`${ev.title}\n${toAESTTime(new Date(ev.start_time))} – ${toAESTTime(new Date(ev.end_time))}${matchedTasks.length ? '\n\n📋 Tasks: ' + matchedTasks.map(t => t.task_name).join(', ') : ''}${matchedHabits.length ? '\n' + matchedHabits.map(h => h.icon + ' ' + h.label).join(', ') : ''}`}
                                >
                                    <div style={{ fontWeight: 600, color: c.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.3', display: 'flex', alignItems: 'center', gap: 3 }}>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</span>
                                        {matchedHabits.length > 0 && !isMulti && (
                                            <span style={{ display: 'inline-flex', gap: 1, flexShrink: 0, fontSize: 10 }}>
                                                {matchedHabits.map(h => (
                                                    <HoverTip key={h.key} label={h.label}>{h.icon}</HoverTip>
                                                ))}
                                            </span>
                                        )}
                                        {matchedTasks.length > 0 && !isMulti && (
                                            <TaskChips tasks={matchedTasks} compact={height < 36} />
                                        )}
                                    </div>
                                    {height > 28 && !isMulti && (
                                        <div style={{ color: 'var(--color-text-muted)', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                                            {toAESTTime(new Date(ev.start_time))} – {toAESTTime(new Date(ev.end_time))}
                                        </div>
                                    )}
                                    {height > 42 && !isMulti && matchedTasks.length > 0 && (
                                        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginTop: 1 }}>
                                            {matchedTasks.slice(0, 3).map(t => (
                                                <span key={t.task_name} style={{ fontSize: 8, padding: '0 4px', borderRadius: 2, background: accountColors.task.bg, border: `1px solid ${accountColors.task.border}40`, color: accountColors.task.text, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100 }}>
                                                    {t.task_name}
                                                </span>
                                            ))}
                                            {matchedTasks.length > 3 && <span style={{ fontSize: 8, color: accountColors.task.text }}>+{matchedTasks.length - 3}</span>}
                                        </div>
                                    )}
                                    {/* Week view: dot indicators */}
                                    {isMulti && (matchedTasks.length > 0 || matchedHabits.length > 0) && (
                                        <div style={{ position: 'absolute', top: 1, right: 2, display: 'flex', gap: 1 }}>
                                            {matchedHabits.slice(0, 2).map(h => (
                                                <span key={h.key} style={{ fontSize: 6, lineHeight: 1 }}>{h.icon}</span>
                                            ))}
                                            {matchedTasks.length > 0 && (
                                                <div style={{ width: 4, height: 4, borderRadius: '50%', background: accountColors.task.border, marginTop: 1 }} />
                                            )}
                                        </div>
                                    )}
                                    {/* Resize handle at bottom */}
                                    {onEventResize && !isMulti && (
                                        <div
                                            onMouseDown={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                const colEl = (e.currentTarget as HTMLElement).closest('[data-col]') as HTMLElement;
                                                if (!colEl) return;
                                                const endMins = getMinutesFromAEST(new Date(ev.end_time));
                                                resizeStart.current = { eventId: ev.id, startTime: ev.start_time, colEl, initialEndMins: endMins, headerOffset: isMulti ? 36 : 0 };
                                                setResizingId(ev.id);
                                                const onMove = (me: MouseEvent) => {
                                                    if (!resizeStart.current) return;
                                                    const rect = resizeStart.current.colEl.getBoundingClientRect();
                                                    const scrollTop = gridRef.current?.scrollTop ?? 0;
                                                    const y = me.clientY - rect.top - resizeStart.current.headerOffset + scrollTop;
                                                    const rawMins = START_HOUR * 60 + (y / hourHeight) * 60;
                                                    const snapped = Math.round(rawMins / 15) * 15;
                                                    const startMins = getMinutesFromAEST(new Date(resizeStart.current.startTime));
                                                    const clamped = Math.max(snapped, startMins + 15);
                                                    const newH = Math.max(((clamped - startMins) / 60) * hourHeight, 18);
                                                    setResizePreviewHeight(newH);
                                                };
                                                const onUp = (me: MouseEvent) => {
                                                    document.removeEventListener('mousemove', onMove);
                                                    document.removeEventListener('mouseup', onUp);
                                                    if (!resizeStart.current) return;
                                                    const rect = resizeStart.current.colEl.getBoundingClientRect();
                                                    const scrollTop = gridRef.current?.scrollTop ?? 0;
                                                    const y = me.clientY - rect.top - resizeStart.current.headerOffset + scrollTop;
                                                    const rawMins = START_HOUR * 60 + (y / hourHeight) * 60;
                                                    const snapped = Math.round(rawMins / 15) * 15;
                                                    const startMins = getMinutesFromAEST(new Date(resizeStart.current.startTime));
                                                    const clamped = Math.max(snapped, startMins + 15);
                                                    // Build new end date in AEST
                                                    const evDate = new Date(resizeStart.current.startTime);
                                                    const newEnd = new Date(evDate.toLocaleString('en-US', { timeZone: AEST }));
                                                    newEnd.setHours(Math.floor(clamped / 60), clamped % 60, 0, 0);
                                                    // Convert back to ISO via AEST offset
                                                    const isoEnd = newEnd.toLocaleString('sv-SE', { timeZone: AEST }).replace(' ', 'T');
                                                    const utcEnd = new Date(isoEnd + '+11:00').toISOString();
                                                    onEventResize(resizeStart.current.eventId, resizeStart.current.startTime, utcEnd);
                                                    resizeStart.current = null;
                                                    setResizingId(null);
                                                    setResizePreviewHeight(null);
                                                };
                                                document.addEventListener('mousemove', onMove);
                                                document.addEventListener('mouseup', onUp);
                                            }}
                                            style={{
                                                position: 'absolute', bottom: 0, left: 0, right: 0, height: 6,
                                                cursor: 'ns-resize', background: 'transparent',
                                                borderBottomLeftRadius: 'var(--radius-sm)', borderBottomRightRadius: 'var(--radius-sm)',
                                            }}
                                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = `${c.border}40`; }}
                                            onMouseLeave={(e) => { if (resizingId !== ev.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                );
            })}
        </div>
    );
}

// ─── Month View ──────────────────────────────────────────────────────────────

function MonthView({ events, selectedDate, onDayClick }: { events: CalendarEvent[]; selectedDate: Date; onDayClick: (d: Date) => void }) {
    const year = selectedDate.getFullYear(), month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1), lastDay = new Date(year, month + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const today = toAESTDate(new Date());
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);

    return (
        <div style={{ padding: 'var(--space-3)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, marginBottom: 1 }}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                    <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', padding: 4, textTransform: 'uppercase' }}>{d}</div>
                ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
                {cells.map((day, i) => {
                    if (!day) return <div key={`e-${i}`} style={{ background: 'var(--color-bg)', minHeight: 70, borderRadius: 2 }} />;
                    const ds = toAESTDate(day), isToday = ds === today;
                    const count = events.filter(ev => toAESTDate(new Date(ev.start_time)) === ds).length;
                    return (
                        <div key={ds} onClick={() => onDayClick(day)} style={{ background: isToday ? 'rgba(90,130,200,0.1)' : 'var(--color-surface)', minHeight: 70, borderRadius: 2, padding: 4, cursor: 'pointer', border: isToday ? '1px solid rgba(90,130,200,0.3)' : '1px solid transparent' }}>
                            <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 500, color: isToday ? '#5a82c8' : 'var(--color-text)' }}>{day.getDate()}</div>
                            {count > 0 && (
                                <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginTop: 2 }}>
                                    {Array.from({ length: Math.min(count, 4) }).map((_, j) => <div key={j} style={{ width: 5, height: 5, borderRadius: '50%', background: '#5a82c8' }} />)}
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

// ─── Task Chips (hover popover — rendered via portal to escape overflow) ─────

function TaskChips({ tasks, compact }: { tasks: TaskInfo[]; compact?: boolean }) {
    const [showPopover, setShowPopover] = useState(false);
    const [popoverPos, setPopoverPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const chipRef = useRef<HTMLSpanElement>(null);
    const hideTimer = useRef<ReturnType<typeof setTimeout>>(null);

    const handleEnter = () => {
        if (hideTimer.current) clearTimeout(hideTimer.current);
        if (chipRef.current) {
            const rect = chipRef.current.getBoundingClientRect();
            // Position below the chip, clamp to viewport
            const x = Math.min(rect.left, window.innerWidth - 310);
            const y = rect.bottom + 6;
            setPopoverPos({ x: Math.max(8, x), y: Math.min(y, window.innerHeight - 200) });
        }
        setShowPopover(true);
    };

    const handleLeave = () => {
        hideTimer.current = setTimeout(() => setShowPopover(false), 150);
    };

    return (
        <span
            ref={chipRef}
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
            onClick={(e) => e.stopPropagation()}
            style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
        >
            <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 2,
                padding: compact ? '0 3px' : '0 5px',
                borderRadius: 3,
                background: accountColors.task.bg,
                border: `1px solid ${accountColors.task.border}50`,
                color: accountColors.task.text,
                fontSize: compact ? 7 : 8,
                fontWeight: 700,
                cursor: 'default',
                whiteSpace: 'nowrap',
                lineHeight: '1.4',
            }}>
                📋 {tasks.length}
            </span>

            {showPopover && createPortal(
                <div
                    onMouseEnter={() => { if (hideTimer.current) clearTimeout(hideTimer.current); }}
                    onMouseLeave={handleLeave}
                    style={{
                        position: 'fixed',
                        top: popoverPos.y,
                        left: popoverPos.x,
                        zIndex: 99999,
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        padding: 'var(--space-2)',
                        minWidth: 220, maxWidth: 300,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
                    }}
                >
                    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                        Linked Tasks ({tasks.length})
                    </div>
                    {tasks.map(t => (
                        <div key={t.task_name} style={{
                            padding: '4px 6px', marginBottom: 2,
                            borderRadius: 'var(--radius-sm)',
                            borderLeft: `3px solid ${accountColors.task.border}`,
                            background: accountColors.task.bg,
                        }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.3 }}>
                                {t.task_name}
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 2 }}>
                                {t.category && (
                                    <span style={{ fontSize: 8, padding: '0 4px', borderRadius: 2, background: 'rgba(90,130,200,0.1)', color: '#5a82c8' }}>
                                        {t.category}
                                    </span>
                                )}
                                {t.estimated_duration && (
                                    <span style={{ fontSize: 8, padding: '0 4px', borderRadius: 2, background: 'rgba(90,154,90,0.1)', color: '#5a9a5a' }}>
                                        {formatDuration(t.estimated_duration)}
                                    </span>
                                )}
                                <span style={{
                                    fontSize: 8, padding: '0 4px', borderRadius: 2,
                                    background: t.status === 'done' ? 'rgba(90,154,90,0.1)' : 'rgba(193,127,58,0.1)',
                                    color: t.status === 'done' ? '#5a9a5a' : '#c17f3a',
                                }}>
                                    {t.status}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </span>
    );
}

// ─── Event Detail Panel ──────────────────────────────────────────────────────

function EventDetail({ event, tasks, onClose, onEdit, onDelete }: {
    event: CalendarEvent; tasks?: TaskInfo[]; onClose: () => void; onEdit: () => void; onDelete: () => void;
}) {
    const c = eventColor(event);
    const start = new Date(event.start_time), end = new Date(event.end_time);
    const durMins = Math.round((end.getTime() - start.getTime()) / 60000);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Event Details</span>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 16 }}>×</button>
            </div>

            <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', background: c.bg, borderLeft: `4px solid ${c.border}`, marginBottom: 'var(--space-3)' }}>
                <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: c.text, marginBottom: 4 }}>{event.title}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                    {event.all_day ? 'All day' : `${toAESTTime(start)} – ${toAESTTime(end)}`}
                    <span style={{ opacity: 0.6 }}> · {formatDuration(durMins)}</span>
                </div>
                {event.location && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>📍 {event.location}</div>}
            </div>

            {/* Source */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', padding: '4px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--color-surface)', marginBottom: 'var(--space-2)', fontSize: 'var(--text-xs)' }}>
                <span style={{ fontWeight: 600, color: c.text }}>{event.source === 'task' ? '📋 Task' : event.source === 'habit' ? '🔁 Habit' : '📅 Calendar'}</span>
                {event.account && <span style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>· {event.account}</span>}
            </div>

            {event.description && (
                <div style={{ padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', background: 'var(--color-surface)', marginBottom: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{event.description}</div>
            )}

            {tasks && tasks.length > 0 && (
                <div style={{ padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(193,127,58,0.2)', background: 'rgba(193,127,58,0.05)', marginBottom: 'var(--space-2)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: accountColors.task.text, textTransform: 'uppercase', marginBottom: 4 }}>📋 Linked Task{tasks.length > 1 ? 's' : ''}</div>
                    {tasks.map(task => (
                        <div key={task.task_name} style={{ marginBottom: tasks.length > 1 ? 4 : 0 }}>
                            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text)' }}>{task.task_name}</div>
                            {task.estimated_duration && <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 1 }}>{formatDuration(task.estimated_duration)} estimated</div>}
                        </div>
                    ))}
                </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                <button onClick={onEdit} style={{ flex: 1, padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer' }}>✏️ Edit</button>
                <button onClick={onDelete} style={{ flex: 1, padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(192,112,112,0.3)', background: 'rgba(192,112,112,0.08)', color: '#c07070', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer' }}>Delete</button>
            </div>
        </div>
    );
}

// ─── Task Sidebar (draggable, priority-sorted) ──────────────────────────────

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, this_week: 1, this_month: 2, ongoing: 3, someday: 4 };
function priorityRank(p: string | null): number { return p ? (PRIORITY_ORDER[p] ?? 5) : 5; }
const priorityColors: Record<string, { bg: string; text: string }> = {
    urgent: { bg: 'rgba(192,80,80,0.12)', text: '#c05050' },
    this_week: { bg: 'rgba(193,127,58,0.12)', text: '#c17f3a' },
    this_month: { bg: 'rgba(90,130,200,0.12)', text: '#5a82c8' },
    ongoing: { bg: 'rgba(90,154,90,0.12)', text: '#5a9a5a' },
    someday: { bg: 'rgba(120,120,140,0.1)', text: '#78788c' },
};

function TaskSidebar({ tasks }: { tasks: TaskInfo[] }) {
    const sorted = useMemo(() => [...tasks].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority)), [tasks]);

    return (
        <div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-2)' }}>
                Unscheduled Tasks
            </div>
            <div style={{ fontSize: 9, color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
                Drag onto calendar to schedule
            </div>

            {sorted.length === 0 ? (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', padding: 'var(--space-2)' }}>All tasks scheduled ✓</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {sorted.slice(0, 20).map(task => {
                        const pc = priorityColors[task.priority ?? ''] ?? priorityColors.someday;
                        return (
                            <div
                                key={task.task_name}
                                draggable
                                onDragStart={(e) => {
                                    e.dataTransfer.setData('text/plain', JSON.stringify({ taskName: task.task_name, duration: task.estimated_duration ?? 30 }));
                                    e.dataTransfer.effectAllowed = 'copy';
                                }}
                                style={{
                                    padding: '5px 8px', borderRadius: 'var(--radius-sm)',
                                    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                                    fontSize: 'var(--text-xs)', cursor: 'grab', userSelect: 'none',
                                    borderLeft: `3px solid ${accountColors.task.border}`,
                                    transition: 'border-color 0.15s, box-shadow 0.15s',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <div style={{ fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{task.task_name}</div>
                                    {task.priority && (
                                        <span style={{ fontSize: 7, padding: '0 4px', borderRadius: 2, background: pc.bg, color: pc.text, fontWeight: 700, whiteSpace: 'nowrap' }}>
                                            {String(task.priority).replace('_', ' ')}
                                        </span>
                                    )}
                                </div>
                                <div style={{ fontSize: 9, color: 'var(--color-text-muted)', marginTop: 1 }}>
                                    {task.estimated_duration ? formatDuration(task.estimated_duration) : '30m'}
                                    {task.category && ` · ${task.category}`}
                                </div>
                            </div>
                        );
                    })}
                    {sorted.length > 20 && <div style={{ fontSize: 9, color: 'var(--color-text-muted)', textAlign: 'center' }}>+{sorted.length - 20} more</div>}
                </div>
            )}
        </div>
    );
}

// ─── Sync Status Indicator ───────────────────────────────────────────────────

function SyncIndicator({ status, lastSyncedAt, onSync }: {
    status: 'idle' | 'syncing' | 'synced' | 'error';
    lastSyncedAt: Date | null;
    onSync: () => void;
}) {
    const formatAgo = (d: Date | null): string => {
        if (!d) return '';
        const s = Math.floor((Date.now() - d.getTime()) / 1000);
        if (s < 10) return 'just now';
        if (s < 60) return `${s}s ago`;
        if (s < 3600) return `${Math.floor(s / 60)}m ago`;
        return `${Math.floor(s / 3600)}h ago`;
    };

    const [, setTick] = useState(0);
    // Update "X ago" every 15s
    useEffect(() => {
        if (!lastSyncedAt) return;
        const t = setInterval(() => setTick(n => n + 1), 15_000);
        return () => clearInterval(t);
    }, [lastSyncedAt]);

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {status === 'syncing' && (
                <span style={{
                    fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)',
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                    <span style={{
                        display: 'inline-block', width: 10, height: 10,
                        border: '2px solid var(--color-text-muted)', borderTopColor: 'transparent',
                        borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                    }} />
                    Syncing
                </span>
            )}
            {status === 'synced' && (
                <span style={{
                    fontSize: 'var(--text-xs)', color: '#5a9a5a',
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    animation: 'fadeIn 0.3s ease',
                }}>
                    <span style={{ fontSize: 10 }}>✓</span> Synced
                </span>
            )}
            {status === 'error' && (
                <button
                    onClick={onSync}
                    style={{
                        fontSize: 'var(--text-xs)', color: '#c07070',
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        background: 'rgba(192,112,112,0.08)', border: '1px solid rgba(192,112,112,0.2)',
                        borderRadius: 'var(--radius-sm)', padding: '2px 8px', cursor: 'pointer',
                    }}
                >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c07070' }} />
                    Sync failed · Retry
                </button>
            )}
            {status === 'idle' && lastSyncedAt && (
                <span style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>
                    Synced {formatAgo(lastSyncedAt)}
                </span>
            )}
            <button
                onClick={onSync}
                disabled={status === 'syncing'}
                style={{
                    ...navBtnStyle,
                    fontSize: 'var(--text-xs)', padding: '4px 10px',
                    opacity: status === 'syncing' ? 0.5 : 1,
                    cursor: status === 'syncing' ? 'not-allowed' : 'pointer',
                }}
            >
                🔄 Sync
            </button>
        </div>
    );
}

// ─── Bottom Sheet (mobile) ──────────────────────────────────────────────────────────

function BottomSheet({ state, onStateChange, peekLabel, children }: {
    state: 'hidden' | 'peek' | 'half' | 'full';
    onStateChange: (s: 'hidden' | 'peek' | 'half' | 'full') => void;
    peekLabel: string;
    children: React.ReactNode;
}) {
    const sheetRef = useRef<HTMLDivElement>(null);
    const dragStartY = useRef<number | null>(null);
    const heightMap = { hidden: 0, peek: 60, half: 45, full: 85 };
    const h = heightMap[state];

    const handleDragStart = (e: React.TouchEvent) => {
        dragStartY.current = e.touches[0].clientY;
    };
    const handleDragEnd = (e: React.TouchEvent) => {
        if (dragStartY.current === null) return;
        const dy = dragStartY.current - e.changedTouches[0].clientY;
        dragStartY.current = null;
        if (dy > 40) {
            // Swipe up
            onStateChange(state === 'peek' ? 'half' : state === 'half' ? 'full' : 'full');
        } else if (dy < -40) {
            // Swipe down
            onStateChange(state === 'full' ? 'half' : state === 'half' ? 'peek' : 'hidden');
        }
    };

    if (state === 'hidden') return null;

    return (
        <div
            ref={sheetRef}
            style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                height: `${h}vh`, minHeight: state === 'peek' ? 60 : undefined,
                background: 'var(--color-surface)',
                borderTop: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
                boxShadow: '0 -4px 24px rgba(0,0,0,0.25)',
                zIndex: 60,
                display: 'flex', flexDirection: 'column',
                transition: 'height 0.3s cubic-bezier(0.4,0,0.2,1)',
                overflow: 'hidden',
            }}
        >
            {/* Drag handle */}
            <div
                onTouchStart={handleDragStart}
                onTouchEnd={handleDragEnd}
                onClick={() => onStateChange(state === 'peek' ? 'half' : 'peek')}
                style={{
                    padding: 'var(--space-2) var(--space-3)',
                    cursor: 'grab', flexShrink: 0,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                }}
            >
                <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--color-border)' }} />
                {state === 'peek' && (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                        {peekLabel}
                    </span>
                )}
            </div>
            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '0 var(--space-3) var(--space-3)' }}>
                {children}
            </div>
        </div>
    );
}

// ─── Event Modal (create/edit) ─────────────────────────────────────────────────────────────

function EventModal({ mode, event, accounts, defaultStart, defaultEnd, onClose, onSubmit, isMobile = false }: {
    mode: 'create' | 'edit';
    event?: CalendarEvent;
    accounts?: ConnectedAccount[];
    defaultStart?: string;
    defaultEnd?: string;
    onClose: () => void;
    onSubmit: (title: string, start: string, end: string, account: string, description?: string) => void;
    isMobile?: boolean;
}) {
    const [title, setTitle] = useState(event?.title ?? '');
    const [desc, setDesc] = useState(event?.description ?? '');
    const [startTime, setStartTime] = useState(() => {
        const d = event ? event.start_time : defaultStart;
        return d ? new Date(d).toLocaleString('sv-SE', { timeZone: AEST }).replace(' ', 'T').slice(0, 16) : '';
    });
    const [endTime, setEndTime] = useState(() => {
        const d = event ? event.end_time : defaultEnd;
        return d ? new Date(d).toLocaleString('sv-SE', { timeZone: AEST }).replace(' ', 'T').slice(0, 16) : '';
    });
    const [account, setAccount] = useState(event?.account ?? accounts?.[0]?.account ?? '');

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 100 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'var(--color-surface)', borderRadius: isMobile ? 'var(--radius-md) var(--radius-md) 0 0' : 'var(--radius-md)', padding: 'var(--space-4)', width: isMobile ? '100%' : 400, maxWidth: '100%', border: '1px solid var(--color-border)', maxHeight: '80vh', overflowY: 'auto' }}>
                <h3 style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-text)' }}>
                    {mode === 'create' ? 'New Event' : 'Edit Event'}
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <input type="text" placeholder="Event title" value={title} onChange={e => setTitle(e.target.value)} autoFocus style={inputStyle} />
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 600 }}>Start</label>
                            <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 600 }}>End</label>
                            <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                        </div>
                    </div>
                    <textarea placeholder="Description (optional)" value={desc} onChange={e => setDesc(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                    {accounts && accounts.length > 0 && (
                        <select value={account} onChange={e => setAccount(e.target.value)} style={inputStyle}>
                            <option value="">No Google sync</option>
                            {accounts.map(a => <option key={a.account} value={a.account}>{a.email}</option>)}
                        </select>
                    )}
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={cancelBtnStyle}>Cancel</button>
                    <button onClick={() => {
                        if (!title || !startTime || !endTime) return;
                        const s = new Date(startTime + ':00+11:00').toISOString();
                        const e = new Date(endTime + ':00+11:00').toISOString();
                        onSubmit(title, s, e, account, desc || undefined);
                    }} disabled={!title || !startTime || !endTime} style={primaryBtnStyle}>
                        {mode === 'create' ? 'Create' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const navBtnStyle: React.CSSProperties = { padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 600 };
const inputStyle: React.CSSProperties = { padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 'var(--text-xs)' };
const cancelBtnStyle: React.CSSProperties = { padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer' };
const primaryBtnStyle: React.CSSProperties = { padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-accent)', background: 'var(--color-accent)', color: 'white', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer' };
