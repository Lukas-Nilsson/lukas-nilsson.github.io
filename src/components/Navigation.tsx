'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import styles from './Navigation.module.css';

const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/about', label: 'About' },
    { href: '/work', label: 'Work' },
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

    // Lock body scroll when menu is open
    useEffect(() => {
        if (menuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [menuOpen]);

    const closeMenu = () => setMenuOpen(false);

    const isActive = (href: string) => {
        if (href === '/') return pathname === '/';
        if (href === '/work') return pathname === '/work' || pathname === '/projects';
        return pathname === href || pathname.startsWith(`${href}/`);
    };

    return (
        <header className={`${styles.header} ${scrolled ? styles.scrolled : ''}`}>
            <nav className={`${styles.nav} container`}>
                <Link href="/" className={styles.logo} onClick={closeMenu}>
                    <span className={styles.logoMark}>LN</span>
                    <span className={styles.logoText}>Lukas Nilsson</span>
                </Link>

                {/* Desktop links */}
                <ul className={styles.links}>
                    {navLinks.map(({ href, label }) => (
                        <li key={href}>
                            <Link
                                href={href}
                                className={`${styles.link} ${isActive(href) ? styles.active : ''}`}
                                aria-current={isActive(href) ? 'page' : undefined}
                                onClick={closeMenu}
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
                    type="button"
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
                            className={`${styles.mobileLink} ${isActive(href) ? styles.mobileLinkActive : ''}`}
                            aria-current={isActive(href) ? 'page' : undefined}
                            onClick={closeMenu}
                            style={{ transitionDelay: menuOpen ? `${80 + i * 50}ms` : '0ms' }}
                        >
                            {label}
                        </Link>
                    ))}
                    <Link
                        href="/dashboard"
                        className={styles.mobileDashboardLink}
                        onClick={closeMenu}
                        style={{ transitionDelay: menuOpen ? `${80 + navLinks.length * 50}ms` : '0ms' }}
                    >
                        Dashboard →
                    </Link>
                </div>
            </div>
        </header>
    );
}
