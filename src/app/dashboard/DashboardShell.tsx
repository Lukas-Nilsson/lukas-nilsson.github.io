'use client';

import Link from 'next/link';
import { useState, useEffect, type ReactNode } from 'react';
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

    // Lock body scroll when menu is open
    useEffect(() => {
        if (menuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [menuOpen]);

    const navLinks = [
        { icon: '📊', label: 'Overview', href: '/dashboard' },
        { icon: '❤️', label: 'Health', href: '/dashboard/health' },
        { icon: '✅', label: 'Habits', href: '/dashboard/habits' },
        { icon: '📋', label: 'Tasks', href: '/dashboard/tasks' },
        { icon: '📅', label: 'Calendar', href: '/dashboard/calendar' },
    ];

    return (
        <div className={styles.shell}>
            {/* Mobile hamburger — hidden when menu is open */}
            {!menuOpen && (
                <button
                    className={styles.hamburger}
                    onClick={() => setMenuOpen(true)}
                    aria-label="Open menu"
                >
                    <span className={styles.hamburgerBar} />
                    <span className={styles.hamburgerBar} />
                    <span className={styles.hamburgerBar} />
                </button>
            )}

            {/* Mobile full-screen overlay */}
            <div
                className={`${styles.mobileOverlay} ${menuOpen ? styles.mobileOverlayOpen : ''}`}
                onClick={() => setMenuOpen(false)}
                aria-hidden={!menuOpen}
            >
                <div className={styles.mobileMenuInner} onClick={e => e.stopPropagation()}>
                    {/* Close button */}
                    <button
                        className={styles.mobileCloseBtn}
                        onClick={() => setMenuOpen(false)}
                        aria-label="Close menu"
                    >
                        <span /><span />
                    </button>

                    {/* Nav links */}
                    <nav className={styles.mobileNavList}>
                        {navLinks.map(({ icon, label, href }, i) => {
                            const active = href === '/dashboard' ? pathname === href : pathname.startsWith(href);
                            return (
                                <Link
                                    key={href}
                                    href={href}
                                    className={`${styles.mobileNavItem} ${active ? styles.mobileNavItemActive : ''}`}
                                    onClick={() => setMenuOpen(false)}
                                    style={{ transitionDelay: menuOpen ? `${60 + i * 40}ms` : '0ms' }}
                                >
                                    <span className={styles.mobileNavIcon}>{icon}</span>
                                    <span className={styles.mobileNavLabel}>{label}</span>
                                    {active && <span className={styles.mobileNavDot} />}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Footer */}
                    <div className={styles.mobileNavFooter}>
                        <Link
                            href="/"
                            className={styles.mobileNavFooterLink}
                            style={{ transitionDelay: menuOpen ? `${60 + navLinks.length * 40}ms` : '0ms' }}
                        >
                            ← Public site
                        </Link>
                        <button
                            className={styles.mobileNavSignOut}
                            onClick={handleSignOut}
                            style={{ transitionDelay: menuOpen ? `${60 + (navLinks.length + 1) * 40}ms` : '0ms' }}
                        >
                            Sign out
                        </button>
                    </div>
                </div>
            </div>

            <aside className={styles.sidebar}>
                <div className={styles.sidebarLogo}>
                    <div className={styles.logoMark}>LN</div>
                </div>
                <nav className={styles.sidebarNav}>
                    {navLinks.map(({ icon, label, href }) => {
                        const active = href === '/dashboard' ? pathname === href : pathname.startsWith(href);
                        return (
                            <Link key={href} href={href} className={`${styles.navLink} ${active ? styles.navActive : ''}`}>
                                <span className={styles.navIcon}>{icon}</span>
                                <span className={styles.navLabel}>{label}</span>
                            </Link>
                        );
                    })}
                </nav>
                <div className={styles.sidebarFooter}>
                    <Link href="/" className={styles.siteLink}>← Public site</Link>
                    <button className={styles.signOutBtn} onClick={handleSignOut}>Sign out</button>
                </div>
            </aside>
            <main className={styles.main}>
                {children}
            </main>
        </div>
    );
}
