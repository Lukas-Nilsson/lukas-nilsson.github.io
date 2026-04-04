import Navigation from '@/components/Navigation';
import PublicCta from '@/components/PublicCta';
import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/site-metadata';
import {
    aboutLead,
    aboutMilestones,
    currentFocus,
    visionStatement,
} from '@/lib/site-content';
import styles from './about.module.css';

export const metadata: Metadata = buildPageMetadata({
    title: 'About',
    description: 'Background, thesis, and current direction.',
    path: '/about',
});

export default function AboutPage() {
    return (
        <>
            <Navigation />
            <main className={styles.main}>
                <div className="container">
                    <header className={`${styles.header} animate-fade-in-up`}>
                        <p className={styles.eyebrow}>About</p>
                        <h1 className={styles.title}>Where the work comes from</h1>
                        <p className={styles.subtitle}>{aboutLead}</p>
                    </header>

                    <section className={styles.storyGrid}>
                        <div className={styles.storyColumn}>
                            {aboutMilestones.map((milestone, index) => (
                                <article
                                    key={milestone.title}
                                    className={`${styles.storyCard} animate-fade-in-up`}
                                    style={{ animationDelay: `${100 + index * 70}ms` }}
                                >
                                    <p className={styles.period}>{milestone.period}</p>
                                    <h2 className={styles.sectionTitle}>{milestone.title}</h2>
                                    <div className={styles.storyBody}>
                                        {milestone.body.map((paragraph) => (
                                            <p key={paragraph}>{paragraph}</p>
                                        ))}
                                    </div>
                                </article>
                            ))}
                        </div>

                        <aside className={`${styles.aside} animate-fade-in-up`} style={{ animationDelay: '220ms' }}>
                            <div className={styles.asideCard}>
                                <p className={styles.asideEyebrow}>Current focus</p>
                                <ul className={styles.focusList}>
                                    {currentFocus.map((item) => (
                                        <li key={item}>{item}</li>
                                    ))}
                                </ul>
                            </div>

                            <div className={styles.asideCard}>
                                <p className={styles.asideEyebrow}>North star</p>
                                <p className={styles.vision}>{visionStatement}</p>
                            </div>
                        </aside>
                    </section>

                    <PublicCta />
                </div>
            </main>
        </>
    );
}
