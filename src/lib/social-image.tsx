import { ImageResponse } from 'next/og';
import { selectedHeroHeadline, siteDescription, siteName } from './site-content';

export const socialImageSize = {
    width: 1200,
    height: 630,
};

export const socialImageContentType = 'image/png';

export function createSocialImage() {
    return new ImageResponse(
        (
            <div
                style={{
                    display: 'flex',
                    width: '100%',
                    height: '100%',
                    position: 'relative',
                    overflow: 'hidden',
                    background:
                        'radial-gradient(circle at top left, rgba(196, 181, 253, 0.18), transparent 32%), radial-gradient(circle at bottom right, rgba(56, 189, 248, 0.14), transparent 34%), linear-gradient(160deg, #05070d 0%, #0f1625 55%, #131117 100%)',
                    color: '#f8fafc',
                    padding: '64px',
                    fontFamily: 'Inter, system-ui, sans-serif',
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        inset: 24,
                        borderRadius: 28,
                        border: '1px solid rgba(255,255,255,0.12)',
                    }}
                />
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        width: '100%',
                        height: '100%',
                        position: 'relative',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            gap: 12,
                            alignItems: 'center',
                            fontSize: 26,
                            letterSpacing: '0.16em',
                            textTransform: 'uppercase',
                            color: 'rgba(226, 232, 240, 0.72)',
                        }}
                    >
                        <div
                            style={{
                                width: 14,
                                height: 14,
                                borderRadius: '999px',
                                background: '#38bdf8',
                                boxShadow: '0 0 40px rgba(56, 189, 248, 0.55)',
                            }}
                        />
                        Melbourne, Australia
                    </div>

                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 24,
                            maxWidth: 940,
                        }}
                    >
                        <div
                            style={{
                                fontSize: 80,
                                lineHeight: 1,
                                letterSpacing: '-0.05em',
                                fontFamily: 'Georgia, serif',
                            }}
                        >
                            {selectedHeroHeadline}
                        </div>
                        <div
                            style={{
                                fontSize: 32,
                                lineHeight: 1.35,
                                color: 'rgba(226, 232, 240, 0.82)',
                                maxWidth: 980,
                            }}
                        >
                            {siteDescription}
                        </div>
                    </div>

                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-end',
                            width: '100%',
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 12,
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 24,
                                    letterSpacing: '0.12em',
                                    textTransform: 'uppercase',
                                    color: 'rgba(226, 232, 240, 0.62)',
                                }}
                            >
                                AI, culture, and human potential
                            </div>
                            <div
                                style={{
                                    fontSize: 40,
                                    lineHeight: 1,
                                    letterSpacing: '-0.04em',
                                    fontWeight: 600,
                                }}
                            >
                                {siteName}
                            </div>
                        </div>
                        <div
                            style={{
                                display: 'flex',
                                gap: 18,
                                fontSize: 24,
                                color: 'rgba(226, 232, 240, 0.7)',
                            }}
                        >
                            <span>The Human Archives</span>
                            <span>AI systems</span>
                        </div>
                    </div>
                </div>
            </div>
        ),
        socialImageSize,
    );
}
