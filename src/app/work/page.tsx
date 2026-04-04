import type { Metadata } from 'next';
import Navigation from '@/components/Navigation';
import PublicCta from '@/components/PublicCta';
import { buildPageMetadata } from '@/lib/site-metadata';
import { workIntro, workItems } from '@/lib/site-content';
import styles from './work.module.css';

export const metadata: Metadata = buildPageMetadata({
    title: 'Work',
    description: 'The Human Archives, AI automation systems, and selected projects.',
    path: '/work',
});

export default function WorkPage() {
    return (
        <>
            <Navigation />
            <main className={styles.main}>
                <div className="container">
                    <header className={styles.header}>
                        <p className={styles.eyebrow}>Work</p>
                        <h1 className={styles.title}>The work in motion</h1>
                        <p className={styles.subtitle}>{workIntro}</p>
                    </header>

                    <div className={styles.workList}>
                        {workItems.map((item, index) => (
                            <article
                                key={item.title}
                                className={`${styles.workCard} ${index > 0 ? 'animate-fade-in-up' : ''}`.trim()}
                                style={index > 0 ? { animationDelay: `${index * 70}ms` } : undefined}
                            >
                                <div className={styles.meta}>
                                    <p className={styles.role}>{item.role}</p>
                                    <p className={styles.period}>{item.period}</p>
                                </div>

                                <div className={styles.content}>
                                    <div className={styles.headingRow}>
                                        <h2 className={styles.cardTitle}>{item.title}</h2>
                                        {item.link ? (
                                            <a
                                                href={item.link.href}
                                                target="_blank"
                                                rel="noreferrer"
                                                className={styles.link}
                                            >
                                                {item.link.label}
                                            </a>
                                        ) : null}
                                    </div>

                                    <p className={styles.summary}>{item.summary}</p>

                                    {item.thesis ? (
                                        <p className={styles.thesis}>{item.thesis}</p>
                                    ) : null}

                                    <ul className={styles.highlightList}>
                                        {item.highlights.map((highlight) => (
                                            <li key={highlight}>{highlight}</li>
                                        ))}
                                    </ul>

                                    <div className={styles.stack}>
                                        <span className={styles.stackLabel}>Stack</span>
                                        <div className={styles.stackItems}>
                                            {item.stack.map((entry) => (
                                                <span key={entry} className={styles.stackItem}>
                                                    {entry}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>

                    <PublicCta />
                </div>
            </main>
        </>
    );
}
