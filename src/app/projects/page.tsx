import Navigation from '@/components/Navigation';
import type { Metadata } from 'next';
import styles from './projects.module.css';

export const metadata: Metadata = {
    title: 'Projects',
    description: "A selection of what Lukas Nilsson has built.",
};

const projects = [
    {
        name: 'The Human Archives',
        url: 'https://thehumanarchives.com',
        status: 'Live',
        year: '2024–present',
        tags: ['Philosophy', 'AI', 'Writing'],
        description:
            'A platform exploring the intersection of humanity and technology through philosophy, first-person essays, and deep conversations. Built as a response to AI commodifying intellectual discourse.',
        tech: ['Next.js', 'Supabase', 'OpenAI'],
    },
    {
        name: 'OpenClaw — Personal OS',
        url: '/dashboard',
        status: 'In progress',
        year: '2025–present',
        tags: ['AI', 'Productivity', 'Health', 'Integrations'],
        description:
            'A unified personal operating system that aggregates health data, habits, tasks, calendar, and email into a single AI-powered command centre. Features deep ClickUp integration (native time tracking, task scheduling via drag-drop, bi-directional sync), Google Calendar multi-account sync, Whoop biometrics, AI-generated daily briefs, and an intelligent habit tracking system. Calendar events are mapped to ClickUp time entries for native work-session tracking.',
        tech: ['Next.js 15', 'Supabase', 'ClickUp API', 'Google Calendar API', 'Whoop API', 'OpenAI GPT-4o', 'Vercel'],
    },
    {
        name: 'lukasnilsson.com',
        url: '/',
        status: 'Live',
        year: '2025',
        tags: ['Portfolio', 'AI chat', 'Web'],
        description:
            'This site — rebuilt from Astro + Obsidian into a full Next.js product with an AI persona that speaks on my behalf and a private dashboard layer.',
        tech: ['Next.js 15', 'Supabase', 'OpenAI GPT-4o', 'Vercel'],
    },
];

const statusColors: Record<string, string> = {
    'Live': 'var(--green-400)',
    'In progress': 'var(--yellow-400)',
    'Archived': 'var(--neutral-500)',
};

export default function ProjectsPage() {
    return (
        <>
            <Navigation />
            <main className={styles.main}>
                <div className="container">
                    <header className={`${styles.header} animate-fade-in-up`}>
                        <p className={styles.eyebrow}>Projects</p>
                        <h1 className={styles.title}>Things I&apos;ve built</h1>
                        <p className={styles.subtitle}>
                            A selection of products, experiments, and ongoing work.
                        </p>
                    </header>

                    <div className={styles.projectList}>
                        {projects.map((project, i) => (
                            <article
                                key={project.name}
                                className={`${styles.project} animate-fade-in-up`}
                                style={{ animationDelay: `${i * 80}ms` }}
                            >
                                <div className={styles.projectMeta}>
                                    <div className={styles.projectStatus}>
                                        <span
                                            className={styles.statusDot}
                                            style={{ background: statusColors[project.status] }}
                                        />
                                        <span className={styles.statusText}>{project.status}</span>
                                    </div>
                                    <span className={styles.projectYear}>{project.year}</span>
                                </div>

                                <div className={styles.projectContent}>
                                    <div className={styles.projectHeader}>
                                        <h2 className={styles.projectName}>{project.name}</h2>
                                        <a
                                            href={project.url}
                                            className={styles.projectLink}
                                            target={project.url.startsWith('http') ? '_blank' : undefined}
                                            rel={project.url.startsWith('http') ? 'noopener noreferrer' : undefined}
                                            aria-label={`Visit ${project.name}`}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                                <path d="M3 13L13 3M13 3H7M13 3V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        </a>
                                    </div>

                                    <p className={styles.projectDesc}>{project.description}</p>

                                    <div className={styles.tags}>
                                        {project.tags.map((tag) => (
                                            <span key={tag} className={styles.tag}>{tag}</span>
                                        ))}
                                    </div>

                                    <div className={styles.techStack}>
                                        <span className={styles.techLabel}>Built with</span>
                                        <span className={styles.techItems}>{project.tech.join(' · ')}</span>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </main>
        </>
    );
}
