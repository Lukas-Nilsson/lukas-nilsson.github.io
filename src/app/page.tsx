import Navigation from '@/components/Navigation';
import AIChatWidget from '@/components/AIChatWidget';
import styles from './page.module.css';

export default function HomePage() {
  return (
    <>
      <Navigation />
      <main>
        {/* Hero */}
        <section className={styles.hero}>
          {/* Background ambient glow */}
          <div className={styles.heroBg} aria-hidden="true">
            <div className={styles.glow1} />
            <div className={styles.glow2} />
          </div>

          <div className={`container ${styles.heroInner}`}>
            {/* Left: Identity */}
            <div className={styles.heroLeft}>
              <p className={`${styles.eyebrow} animate-fade-in-up`}>
                Tech creative · Founder · Truth seeker
              </p>
              <h1 className={`${styles.heroTitle} animate-fade-in-up`} style={{ animationDelay: '80ms' }}>
                Lukas
                <br />
                <span className="gradient-text">Nilsson</span>
              </h1>
              <p className={`${styles.heroQuote} animate-fade-in-up`} style={{ animationDelay: '200ms' }}>
                &ldquo;A visionary builder — philosopher, artist, and teacher —
                who uses story, technology, and disciplined optimism to inspire
                human agency and meaning by revealing the beauty in the world.&rdquo;
              </p>
              <p className={`${styles.quoteAttr} animate-fade-in-up`} style={{ animationDelay: '260ms' }}>
                — ChatGPT, when asked to describe me in one sentence
              </p>

              <div className={`${styles.heroCta} animate-fade-in-up`} style={{ animationDelay: '340ms' }}>
                <a href="/about" className="btn btn-primary">About me</a>
                <a href="/projects" className="btn btn-ghost">Projects</a>
              </div>
            </div>

            {/* Right: AI Chat */}
            <div className={`${styles.heroRight} animate-fade-in-up`} style={{ animationDelay: '200ms' }}>
              <div className={styles.chatLabel}>
                <div className={styles.chatLabelDot} />
                <span>Chat with my AI — it knows me well</span>
              </div>
              <AIChatWidget />
            </div>
          </div>
        </section>

        {/* Brief intro strip */}
        <section className={styles.intro}>
          <div className={`container ${styles.introGrid}`}>
            {[
              { label: 'Currently building', value: 'The Human Archives' },
              { label: 'Based in', value: 'Australia' },
              { label: 'Focused on', value: 'AI × Human Potential' },
              { label: 'Philosophy', value: 'Disciplined optimism' },
            ].map(({ label, value }) => (
              <div key={label} className={styles.introItem}>
                <span className={styles.introLabel}>{label}</span>
                <span className={styles.introValue}>{value}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
