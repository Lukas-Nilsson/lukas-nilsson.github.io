import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site-content';

export default function sitemap(): MetadataRoute.Sitemap {
    const lastModified = new Date();

    return [
        {
            url: siteUrl,
            lastModified,
            changeFrequency: 'weekly',
            priority: 1,
        },
        {
            url: `${siteUrl}/about`,
            lastModified,
            changeFrequency: 'monthly',
            priority: 0.8,
        },
        {
            url: `${siteUrl}/work`,
            lastModified,
            changeFrequency: 'weekly',
            priority: 0.9,
        },
    ];
}
