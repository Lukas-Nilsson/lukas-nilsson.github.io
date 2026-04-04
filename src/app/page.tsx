import type { Metadata } from 'next';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import PublicCta from '@/components/PublicCta';
import AieoSection from '@/components/AieoSection';
import {
  currentFocus,
  homeSections,
  homeSnapshot,
  homeSubheadline,
  personStructuredData,
  selectedHeroHeadline,
  siteDescription,
} from '@/lib/site-content';
import styles from './page.module.css';

export const metadata: Metadata = {
  description: siteDescription,
  alternates: {
    canonical: '/',
  },
};

export default function HomePage() {
  return (
    <>
      <Navigation />
      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroBg} aria-hidden="true">
            <div className={styles.glow1} />
            <div className={styles.glow2} />
          </div>

          <div className={`container ${styles.heroInner}`}>
            <div className={styles.heroLeft}>
              <p className={`${styles.eyebrow} animate-fade-in-up`}>
                Software engineer · Founder · Melbourne
              </p>
              <h1 className={`${styles.heroTitle} animate-fade-in-up`} style={{ animationDelay: '80ms' }}>
                {selectedHeroHeadline}
              </h1>
              <p className={`${styles.heroSubheadline} animate-fade-in-up`} style={{ animationDelay: '180ms' }}>
                {homeSubheadline}
              </p>

              <div className={`${styles.heroCta} animate-fade-in-up`} style={{ animationDelay: '260ms' }}>
                <a href="mailto:lukasnilssonbusiness@gmail.com" className="btn btn-primary">
                  Email Lukas
                </a>
                <Link href="/work" className="btn btn-ghost">
                  See the work
                </Link>
              </div>
            </div>

            <aside className={`${styles.heroRight} animate-fade-in-up`} style={{ animationDelay: '200ms' }}>
              <div className={styles.focusCard}>
                <p className={styles.cardEyebrow}>Current focus</p>
                <ul className={styles.focusList}>
                  {currentFocus.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <dl className={styles.snapshotGrid}>
                {homeSnapshot.map(({ label, value }) => (
                  <div key={label} className={styles.snapshotItem}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </aside>
          </div>
        </section>

        <section className={styles.sections}>
          <div className="container">
            <div className={styles.sectionGrid}>
              {homeSections.map((section, index) => (
                <article
                  key={section.title}
                  className={`${styles.sectionCard} animate-fade-in-up`}
                  style={{ animationDelay: `${120 + index * 80}ms` }}
                >
                  <p className={styles.sectionEyebrow}>0{index + 1}</p>
                  <h2 className={styles.sectionTitle}>{section.title}</h2>
                  <div className={styles.sectionBody}>
                    {section.body.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </article>
              ))}
            </div>

            <AieoSection />

            <PublicCta />
          </div>
        </section>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personStructuredData) }}
        />
      </main>
    </>
  );
}
