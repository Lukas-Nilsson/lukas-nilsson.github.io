'use client';

import { useState, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import styles from './dashboard.module.css';

export default function DashboardShell({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [menuOpen, setMenuOpen] = useState(false);

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
                        {navLinks.map(({ icon, label, href }) => {
                            const active = href === '/dashboard' ? pathname === href : pathname.startsWith(href);
                            return (
                                <a key={href} href={href}
                                    className={`${styles.mobileNavLink} ${active ? styles.mobileNavActive : ''}`}
                                    onClick={() => setMenuOpen(false)}
                                >
                                    <span style={{ fontSize: 18 }}>{icon}</span>
                                    <span>{label}</span>
                                </a>
                            );
                        })}
                        <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                            <a href="/" className={styles.mobileNavLink} style={{ color: 'var(--color-text-muted)' }}>← Public site</a>
                            <button className={styles.mobileNavLink} style={{ color: '#c07070', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', font: 'inherit' }} onClick={handleSignOut}>Sign out</button>
                        </div>
                    </nav>
                </div>
            )}

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
