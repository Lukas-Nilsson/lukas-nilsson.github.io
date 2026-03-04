'use client';

import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import styles from './dashboard.module.css';

interface Props {
    user: User;
}

// ─── Widget components ───────────────────────────────────────────────────────

function WhoopWidget() {
    // Placeholder: will connect to Whoop API with OAuth token stored in Supabase
    const stats = [
        { label: 'Recovery', value: '76%', color: 'var(--green-400)', sub: 'Good' },
        { label: 'Strain', value: '12.4', color: 'var(--accent-400)', sub: 'Moderate' },
        { label: 'Sleep', value: '7h 22m', color: 'var(--accent-300)', sub: '82% efficiency' },
        { label: 'HRV', value: '58 ms', color: 'var(--green-400)', sub: 'Above avg' },
    ];

    return (
        <div className={styles.widget}>
            <div className={styles.widgetHeader}>
                <div className={styles.widgetTitle}>
                    <span className={styles.widgetIcon}>◎</span>
                    Whoop
                </div>
                <span className={styles.widgetBadge}>Today</span>
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
            <p className={styles.widgetNotice}>
                🔗 Connect your Whoop account in Settings to see live data.
            </p>
        </div>
    );
}

function HabitsWidget() {
    const habits = [
        { name: 'Morning pages', done: true, streak: 14 },
        { name: 'Workout', done: true, streak: 7 },
        { name: 'Cold shower', done: false, streak: 3 },
        { name: 'Read 30 min', done: true, streak: 21 },
        { name: 'No alcohol', done: true, streak: 60 },
        { name: 'Meditate', done: false, streak: 0 },
    ];

    const completed = habits.filter(h => h.done).length;

    return (
        <div className={styles.widget}>
            <div className={styles.widgetHeader}>
                <div className={styles.widgetTitle}>
                    <span className={styles.widgetIcon}>◈</span>
                    Habits
                </div>
                <span className={styles.widgetBadge}>{completed}/{habits.length} today</span>
            </div>
            <div className={styles.habitProgress}>
                <div
                    className={styles.habitBar}
                    style={{ width: `${(completed / habits.length) * 100}%` }}
                />
            </div>
            <ul className={styles.habitList}>
                {habits.map(({ name, done, streak }) => (
                    <li key={name} className={styles.habitItem}>
                        <div className={`${styles.habitCheck} ${done ? styles.habitDone : ''}`}>
                            {done && <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
                                <path d="M1 4L4 7L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>}
                        </div>
                        <span className={`${styles.habitName} ${done ? styles.habitNameDone : ''}`}>{name}</span>
                        {streak > 0 && (
                            <span className={styles.streak}>🔥{streak}</span>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}

function TasksWidget() {
    const tasks = [
        { title: 'Review Pile integration docs', priority: 'high', done: false },
        { title: 'Write essay on AI consciousness', priority: 'medium', done: false },
        { title: 'Update Human Archives homepage', priority: 'high', done: true },
        { title: 'Set up Whoop OAuth flow', priority: 'medium', done: false },
        { title: 'Record intro video', priority: 'low', done: false },
    ];

    const priorityColor: Record<string, string> = {
        high: 'var(--red-400)',
        medium: 'var(--yellow-400)',
        low: 'var(--neutral-500)',
    };

    return (
        <div className={styles.widget}>
            <div className={styles.widgetHeader}>
                <div className={styles.widgetTitle}>
                    <span className={styles.widgetIcon}>◇</span>
                    Tasks
                </div>
                <span className={styles.widgetBadge}>{tasks.filter(t => !t.done).length} open</span>
            </div>
            <ul className={styles.taskList}>
                {tasks.map(({ title, priority, done }) => (
                    <li key={title} className={`${styles.taskItem} ${done ? styles.taskDone : ''}`}>
                        <div
                            className={styles.priorityDot}
                            style={{ background: done ? 'var(--neutral-400)' : priorityColor[priority] }}
                        />
                        <span className={styles.taskTitle}>{title}</span>
                    </li>
                ))}
            </ul>
            <p className={styles.widgetNotice}>
                🔗 Connect your task manager (Notion, Todoist, or Pile) in Settings.
            </p>
        </div>
    );
}

function CalendarWidget() {
    const today = new Date();
    const events = [
        { time: '9:00 AM', title: 'Deep work block', type: 'focus' },
        { time: '12:00 PM', title: 'Lunch + walk', type: 'personal' },
        { time: '2:00 PM', title: 'Architecture review', type: 'work' },
        { time: '5:00 PM', title: 'Gym', type: 'health' },
        { time: '8:00 PM', title: 'Reading', type: 'personal' },
    ];

    const typeColor: Record<string, string> = {
        focus: 'var(--accent-400)',
        work: 'var(--accent-500)',
        health: 'var(--green-400)',
        personal: 'var(--neutral-400)',
    };

    return (
        <div className={styles.widget}>
            <div className={styles.widgetHeader}>
                <div className={styles.widgetTitle}>
                    <span className={styles.widgetIcon}>◉</span>
                    Calendar
                </div>
                <span className={styles.widgetBadge}>
                    {today.toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
            </div>
            <ul className={styles.eventList}>
                {events.map(({ time, title, type }) => (
                    <li key={title} className={styles.event}>
                        <span className={styles.eventTime}>{time}</span>
                        <div className={styles.eventBar} style={{ background: typeColor[type] }} />
                        <span className={styles.eventTitle}>{title}</span>
                    </li>
                ))}
            </ul>
            <p className={styles.widgetNotice}>
                🔗 Connect Google Calendar in Settings for live events.
            </p>
        </div>
    );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardClient({ user }: Props) {
    const router = useRouter();
    const supabase = createClient();

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/');
        router.refresh();
    };

    const today = new Date();
    const greeting =
        today.getHours() < 12 ? 'Good morning' :
            today.getHours() < 17 ? 'Good afternoon' : 'Good evening';

    return (
        <div className={styles.shell}>
            {/* Sidebar */}
            <aside className={styles.sidebar}>
                <div className={styles.sidebarLogo}>
                    <div className={styles.logoMark} aria-label="Lukas Nilsson">LN</div>
                </div>

                <nav className={styles.sidebarNav}>
                    {[
                        { icon: '◉', label: 'Overview', href: '/dashboard', active: true },
                        { icon: '◎', label: 'Health', href: '/dashboard/health', active: false },
                        { icon: '◈', label: 'Habits', href: '/dashboard/habits', active: false },
                        { icon: '◇', label: 'Tasks', href: '/dashboard/tasks', active: false },
                        { icon: '◆', label: 'Calendar', href: '/dashboard/calendar', active: false },
                    ].map(({ icon, label, href, active }) => (
                        <a key={href} href={href} className={`${styles.navLink} ${active ? styles.navActive : ''}`}>
                            <span className={styles.navIcon} aria-hidden="true">{icon}</span>
                            <span className={styles.navLabel}>{label}</span>
                        </a>
                    ))}
                </nav>

                <div className={styles.sidebarFooter}>
                    <a href="/" className={styles.siteLink}>← Public site</a>
                    <button className={styles.signOutBtn} onClick={handleSignOut}>Sign out</button>
                </div>
            </aside>

            {/* Main content */}
            <main className={styles.main}>
                <header className={styles.header}>
                    <div>
                        <h1 className={styles.greeting}>{greeting}, Lukas.</h1>
                        <p className={styles.date}>
                            {today.toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                    </div>
                    <div className={styles.headerMeta}>
                        <span className={styles.userBadge}>{user.email}</span>
                    </div>
                </header>

                {/* Widget grid */}
                <div className={styles.grid}>
                    <div className={`${styles.gridItem} ${styles.gridItemFull} animate-fade-in-up`} style={{ animationDelay: '0ms' }}>
                        <WhoopWidget />
                    </div>
                    <div className={`${styles.gridItem} animate-fade-in-up`} style={{ animationDelay: '80ms' }}>
                        <HabitsWidget />
                    </div>
                    <div className={`${styles.gridItem} animate-fade-in-up`} style={{ animationDelay: '160ms' }}>
                        <TasksWidget />
                    </div>
                    <div className={`${styles.gridItem} ${styles.gridItemFull} animate-fade-in-up`} style={{ animationDelay: '240ms' }}>
                        <CalendarWidget />
                    </div>
                </div>
            </main>
        </div>
    );
}
