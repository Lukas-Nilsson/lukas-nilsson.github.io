import type { Metadata } from 'next';
import { siteDescription, siteName, siteUrl } from './site-content';

type BuildPageMetadataArgs = {
    title: string;
    description?: string;
    path: `/${string}` | '/';
    noIndex?: boolean;
};

export function buildPageMetadata({
    title,
    description = siteDescription,
    path,
    noIndex = false,
}: BuildPageMetadataArgs): Metadata {
    const url = path === '/' ? siteUrl : `${siteUrl}${path}`;
    const metaTitle = `${title} | ${siteName}`;

    return {
        title,
        description,
        alternates: {
            canonical: path,
        },
        openGraph: {
            title: metaTitle,
            description,
            url,
            type: 'website',
            siteName,
            images: [
                {
                    url: '/opengraph-image',
                    width: 1200,
                    height: 630,
                    alt: `${siteName} social card`,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title: metaTitle,
            description,
            images: ['/twitter-image'],
        },
        robots: noIndex
            ? {
                index: false,
                follow: false,
            }
            : undefined,
    };
}
