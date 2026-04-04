import { contactCta, contactLinks } from '@/lib/site-content';
import styles from './PublicCta.module.css';

type PublicCtaProps = {
    className?: string;
};

export default function PublicCta({ className }: PublicCtaProps) {
    const classes = [styles.cta, className].filter(Boolean).join(' ');

    return (
        <section className={classes}>
            <div className={styles.copy}>
                <p className={styles.eyebrow}>Contact</p>
                <h2 className={styles.title}>{contactCta.title}</h2>
                <p className={styles.body}>{contactCta.body}</p>
            </div>

            <div className={styles.actions}>
                <a href={contactLinks.email} className="btn btn-primary">
                    {contactCta.primaryLabel}
                </a>
                <a
                    href={contactLinks.linkedin}
                    className="btn btn-ghost"
                    target="_blank"
                    rel="noreferrer"
                >
                    {contactCta.secondaryLabel}
                </a>
            </div>

            <p className={styles.inlineLinks}>
                <a href={contactLinks.email}>{contactLinks.emailLabel}</a>
                <span aria-hidden="true"> / </span>
                <a href={contactLinks.linkedin} target="_blank" rel="noreferrer">
                    {contactLinks.linkedinLabel}
                </a>
            </p>
        </section>
    );
}
