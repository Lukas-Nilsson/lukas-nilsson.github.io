'use client';

import { useEffect, useRef, useState } from 'react';
import {
    aieoAnnotations,
    aieoExplainer,
    aieoHeadline,
    personStructuredData,
} from '@/lib/site-content';
import styles from './AieoSection.module.css';

export default function AieoSection() {
    const codeRef = useRef<HTMLPreElement>(null);
    const [visible, setVisible] = useState(false);

    // Intersection observer to trigger animation when scrolled into view
    useEffect(() => {
        const el = codeRef.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisible(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.15 },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    // Build the displayed JSON (trimmed for readability)
    const displayData = {
        '@context': personStructuredData['@context'],
        '@type': personStructuredData['@type'],
        name: personStructuredData.name,
        jobTitle: personStructuredData.jobTitle,
        knowsAbout: personStructuredData.knowsAbout?.slice(0, 5),
        hasOccupation: personStructuredData.hasOccupation?.map((o) => ({
            '@type': o['@type'],
            name: o.name,
        })),
        brand: personStructuredData.brand,
        sameAs: personStructuredData.sameAs,
    };

    const jsonString = JSON.stringify(displayData, null, 2);

    return (
        <section className={styles.aieo}>
            <div className={styles.header}>
                <p className={styles.eyebrow}>AI Engine Optimisation</p>
                <h2 className={styles.title}>{aieoHeadline}</h2>
                <div className={styles.explainer}>
                    {aieoExplainer.map((p) => (
                        <p key={p}>{p}</p>
                    ))}
                </div>
            </div>

            <div className={styles.terminalWrapper}>
                <div className={styles.terminalBar}>
                    <span className={styles.dot} data-color="red" />
                    <span className={styles.dot} data-color="yellow" />
                    <span className={styles.dot} data-color="green" />
                    <span className={styles.terminalTitle}>
                        structured-data.jsonld
                    </span>
                </div>
                <pre
                    ref={codeRef}
                    className={`${styles.terminalBody} ${visible ? styles.revealed : ''}`}
                >
                    <code>{jsonString}</code>
                </pre>
            </div>

            <div className={styles.annotations}>
                <p className={styles.annotationsLabel}>
                    What this tells AI models
                </p>
                <dl className={styles.annotationList}>
                    {aieoAnnotations.map((a, i) => (
                        <div
                            key={a.key}
                            className={`${styles.annotationItem} ${visible ? styles.annotationRevealed : ''}`}
                            style={{ animationDelay: `${300 + i * 120}ms` }}
                        >
                            <dt>{a.key}</dt>
                            <dd>{a.note}</dd>
                        </div>
                    ))}
                </dl>
            </div>
        </section>
    );
}
