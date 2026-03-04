'use client';

import type { ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import styles from './dashboard.module.css';

export default function DashboardShell({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();

    const handleSignOut = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push('/');
        router.refresh();
    };

    const navLinks = [
        { icon: '◉', label: 'Overview', href: '/dashboard' },
        { icon: '◎', label: 'Health', href: '/dashboard/health' },
        { icon: '◈', label: 'Habits', href: '/dashboard/habits' },
        { icon: '◇', label: 'Tasks', href: '/dashboard/tasks' },
        { icon: '⬡', label: '75 Hard', href: '/dashboard/75-hard' },
    ];

    return (
        <div className={styles.shell}>
            <aside className={styles.sidebar}>
                <div className={styles.sidebarLogo}>
                    <div className={styles.logoMark}>LN</div>
                </div>
                <nav className={styles.sidebarNav}>
                    {navLinks.map(({ icon, label, href }) => {
                        const active = href === '/dashboard' ? pathname === href : pathname.startsWith(href);
                        return (
                            <a key={href} href={href} className={`${styles.navLink} ${active ? styles.navActive : ''}`}>
                                <span className={styles.navIcon}>{icon}</span>
                                <span className={styles.navLabel}>{label}</span>
                            </a>
                        );
                    })}
                </nav>
                <div className={styles.sidebarFooter}>
                    <a href="/" className={styles.siteLink}>← Public site</a>
                    <button className={styles.signOutBtn} onClick={handleSignOut}>Sign out</button>
                </div>
            </aside>
            <main className={styles.main}>
                {children}
            </main>
        </div>
    );
}
