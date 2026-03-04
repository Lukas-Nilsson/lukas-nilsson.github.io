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

    useEffect(() => {
        setMenuOpen(false);
    }, [pathname]);

    return (
        <header className={`${styles.header} ${scrolled ? styles.scrolled : ''}`}>
            <nav className={`${styles.nav} container`}>
                <Link href="/" className={styles.logo} aria-label="Lukas Nilsson">
                    <span className={styles.logoMark}>LN</span>
                    <span className={styles.logoText}>Lukas Nilsson</span>
                </Link>

                <ul className={`${styles.links} ${menuOpen ? styles.open : ''}`}>
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
        </header>
    );
}
