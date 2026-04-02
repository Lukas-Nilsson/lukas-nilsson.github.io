'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import styles from './Navigation.module.css';

const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/about', label: 'About' },
    { href: '/projects', label: 'Projects' },
];

export default function Navigation() {
    const pathname = usePathname();
    const [scrolled, setScrolled] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // Close on route change
    useEffect(() => {
        setMenuOpen(false);
    }, [pathname]);

    // Lock body scroll when menu is open
    useEffect(() => {
        if (menuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [menuOpen]);

    return (
        <header className={`${styles.header} ${scrolled ? styles.scrolled : ''}`}>
            <nav className={`${styles.nav} container`}>
                <Link href="/" className={styles.logo} aria-label="Lukas Nilsson">
                    <span className={styles.logoMark}>LN</span>
                    <span className={styles.logoText}>Lukas Nilsson</span>
                </Link>

                {/* Desktop links */}
                <ul className={styles.links}>
                    {navLinks.map(({ href, label }) => (
                        <li key={href}>
                            <Link
                                href={href}
                                className={`${styles.link} ${pathname === href ? styles.active : ''}`}
                            >
                                {label}
                            </Link>
                        </li>
                    ))}
                    <li>
                        <Link href="/dashboard" className={`${styles.link} ${styles.dashboardLink}`}>
                            Dashboard
                        </Link>
                    </li>
                </ul>

                {/* Mobile hamburger */}
                <button
                    className={`${styles.menuBtn} ${menuOpen ? styles.menuOpen : ''}`}
                    onClick={() => setMenuOpen(!menuOpen)}
                    aria-label="Toggle menu"
                    aria-expanded={menuOpen}
                >
                    <span />
                    <span />
                    <span />
                </button>
            </nav>

            {/* Mobile full-screen overlay */}
            <div
                className={`${styles.mobileOverlay} ${menuOpen ? styles.mobileOverlayOpen : ''}`}
                aria-hidden={!menuOpen}
            >
                <div className={styles.mobileNavInner}>
                    {navLinks.map(({ href, label }, i) => (
                        <Link
                            key={href}
                            href={href}
                            className={`${styles.mobileLink} ${pathname === href ? styles.mobileLinkActive : ''}`}
                            onClick={() => setMenuOpen(false)}
                            style={{ transitionDelay: menuOpen ? `${80 + i * 50}ms` : '0ms' }}
                        >
                            {label}
                        </Link>
                    ))}
                    <Link
                        href="/dashboard"
                        className={styles.mobileDashboardLink}
                        onClick={() => setMenuOpen(false)}
                        style={{ transitionDelay: menuOpen ? `${80 + navLinks.length * 50}ms` : '0ms' }}
                    >
                        Dashboard →
                    </Link>
                </div>
            </div>
        </header>
    );
}
