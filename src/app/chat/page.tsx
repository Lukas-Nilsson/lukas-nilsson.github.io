import type { Metadata } from 'next';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import AIChatWidget from '@/components/AIChatWidget';
import { buildPageMetadata } from '@/lib/site-metadata';
import { contactLinks } from '@/lib/site-content';
import styles from './chat.module.css';

export const metadata: Metadata = buildPageMetadata({
    title: 'AI Briefing',
    description: "A secondary page for getting a quick AI briefing on Lukas's work.",
    path: '/chat',
    noIndex: true,
});

export default function ChatPage() {
    return (
        <>
            <Navigation />
            <main className={styles.main}>
                <div className="container">
                    <header className={`${styles.header} animate-fade-in-up`}>
                        <p className={styles.eyebrow}>Secondary page</p>
                        <h1 className={styles.title}>AI briefing</h1>
                        <p className={styles.subtitle}>
                            This page is here for quick orientation. The main site is the better place to understand
                            the thesis. If you want a real conversation, reach out directly.
                        </p>
                        <div className={styles.links}>
                            <a href={contactLinks.email} className="btn btn-primary">
                                Email Lukas
                            </a>
                            <Link href="/work" className="btn btn-ghost">
                                View work
                            </Link>
                        </div>
                    </header>

                    <div className={`${styles.widgetWrap} animate-fade-in-up`} style={{ animationDelay: '120ms' }}>
                        <AIChatWidget />
                    </div>
                </div>
            </main>
        </>
    );
}
