import Navigation from '@/components/Navigation';
import type { Metadata } from 'next';
import styles from './about.module.css';

export const metadata: Metadata = {
    title: 'About',
    description: 'Tech creative, founder, and truth seeker building at the intersection of philosophy, technology, and human potential.',
};

const skills = [
    { category: 'Engineering', items: ['Next.js / React', 'TypeScript', 'Node.js', 'Supabase / PostgreSQL', 'AI & LLM integration', 'System design'] },
    { category: 'Product', items: ['0→1 product building', 'User research', 'Design systems', 'Growth strategy', 'Community building'] },
    { category: 'Philosophy', items: ['Philosophy of mind', 'Epistemology', 'Ethics of AI', 'Consciousness studies', 'Stoicism'] },
];

export default function AboutPage() {
    return (
        <>
            <Navigation />
            <main className={styles.main}>
                <div className="container">
                    {/* Header */}
                    <header className={`${styles.header} animate-fade-in-up`}>
                        <p className={styles.eyebrow}>About</p>
                        <h1 className={styles.title}>
                            Building at the edge of what&apos;s possible
                        </h1>
                    </header>

                    {/* Bio */}
                    <section className={`${styles.section} animate-fade-in-up`} style={{ animationDelay: '100ms' }}>
                        <div className={styles.bio}>
                            <p>
                                I&apos;m Lukas Nilsson — a tech creative and founder based in Australia, building at the intersection of philosophy, technology, and human potential. I believe the most important work happening right now is figuring out what it means to be human in an age of artificial intelligence.
                            </p>
                            <p>
                                My background spans engineering, product design, and entrepreneurship. I became obsessed with the question of how we use technology not just to be more productive, but to actually become more human — more alive, more connected to meaning.
                            </p>
                            <p>
                                That obsession led me to build <strong>The Human Archives</strong> — a platform exploring the intersection of humanity and technology through philosophy, first-person essays, and deep conversations.
                            </p>
                            <p>
                                I operate from a philosophy I call disciplined optimism: a commitment to clear-eyed hope, rigorous thinking, and the belief that the future is worth building.
                            </p>
                        </div>
                    </section>

                    {/* Skills */}
                    <section className={`${styles.section} animate-fade-in-up`} style={{ animationDelay: '200ms' }}>
                        <h2 className={styles.sectionTitle}>What I bring</h2>
                        <div className={styles.skillsGrid}>
                            {skills.map(({ category, items }) => (
                                <div key={category} className={styles.skillCard}>
                                    <h3 className={styles.skillCategory}>{category}</h3>
                                    <ul className={styles.skillList}>
                                        {items.map((item) => (
                                            <li key={item}>{item}</li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Values */}
                    <section className={`${styles.section} animate-fade-in-up`} style={{ animationDelay: '280ms' }}>
                        <h2 className={styles.sectionTitle}>What I value</h2>
                        <div className={styles.valuesGrid}>
                            {[
                                { icon: '◈', title: 'Truth over comfort', desc: 'Honest inquiry into what actually is, not what we wish to be true.' },
                                { icon: '◇', title: 'Depth over breadth', desc: 'Going all the way into things. Understanding root causes, not symptoms.' },
                                { icon: '◉', title: 'Making things', desc: 'Ideas that live only in heads are just thoughts. Building is the test.' },
                                { icon: '◎', title: 'Human potential', desc: 'I believe most people are living far below what they\'re capable of.' },
                            ].map(({ icon, title, desc }) => (
                                <div key={title} className={styles.valueCard}>
                                    <span className={styles.valueIcon} aria-hidden="true">{icon}</span>
                                    <div>
                                        <h3 className={styles.valueTitle}>{title}</h3>
                                        <p className={styles.valueDesc}>{desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Connect */}
                    <section className={`${styles.contact} animate-fade-in-up`} style={{ animationDelay: '360ms' }}>
                        <h2 className={styles.sectionTitle}>Let&apos;s connect</h2>
                        <p>I&apos;m always interested in genuine conversations about technology, philosophy, or building something together. Reach out directly.</p>
                        <div className={styles.links}>
                            <a href="mailto:lukasnilssonbusiness@gmail.com" className="btn btn-primary">Email me</a>
                            <a href="https://www.linkedin.com/in/lukaspnilsson/" target="_blank" rel="noopener noreferrer" className="btn btn-ghost">LinkedIn</a>
                            <a href="https://github.com/Lukas-Nilsson" target="_blank" rel="noopener noreferrer" className="btn btn-ghost">GitHub</a>
                        </div>
                    </section>
                </div>
            </main>
        </>
    );
}
