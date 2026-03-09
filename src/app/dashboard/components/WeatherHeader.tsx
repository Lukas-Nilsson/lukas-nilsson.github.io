'use client';

import { useEffect, useState } from 'react';

interface WeatherData {
    description: string; emoji: string; temp_c: number; feels_like_c: number;
    wind_kmh: number; wind_dir: string; humidity: number; rain_probability: number;
    uv_index: number; is_day: boolean; high_c: number; low_c: number;
    location: string; fetched_at: string; cached?: boolean;
}

export default function WeatherHeader({ selectedDate }: { selectedDate?: string }) {
    const [weather, setWeather] = useState<WeatherData | null>(null);

    useEffect(() => {
        const dateParam = selectedDate ? `?date=${selectedDate}` : '';
        fetch(`/api/dashboard/weather${dateParam}`)
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d && !d.error) setWeather(d); })
            .catch(() => { });
    }, [selectedDate]);

    if (!weather) return null;

    const isDay = weather.is_day;
    const gradientBg = isDay
        ? 'linear-gradient(135deg, rgba(40,90,140,0.35) 0%, rgba(70,140,200,0.20) 50%, rgba(200,160,60,0.12) 100%)'
        : 'linear-gradient(135deg, rgba(15,15,50,0.50) 0%, rgba(35,35,80,0.35) 50%, rgba(60,40,100,0.20) 100%)';

    const StatPill = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
            borderRadius: 'var(--radius)', background: 'rgba(0,0,0,0.15)',
            border: '1px solid rgba(255,255,255,0.10)', fontSize: 'var(--text-xs)',
        }}>
            <span style={{ fontSize: 14 }}>{icon}</span>
            <div>
                <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                <div style={{ color: '#fff', fontWeight: 600 }}>{value}</div>
            </div>
        </div>
    );

    return (
        <div style={{
            background: gradientBg, borderRadius: 'var(--radius-xl)',
            border: '1px solid rgba(255,255,255,0.12)',
            padding: 'var(--space-5) var(--space-6)',
            backdropFilter: 'blur(12px)', position: 'relative', overflow: 'hidden',
        }}>
            {/* Subtle decorative circle */}
            <div style={{
                position: 'absolute', top: -40, right: -40, width: 180, height: 180,
                borderRadius: '50%', background: isDay ? 'rgba(255,200,80,0.08)' : 'rgba(120,120,200,0.08)',
                pointerEvents: 'none',
            }} />

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)', position: 'relative' }}>
                {/* Left: Temperature + Conditions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                    <span style={{ fontSize: 52, lineHeight: 1, filter: 'drop-shadow(0 2px 12px rgba(0,0,0,0.3))' }}>
                        {weather.emoji}
                    </span>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
                            <span style={{
                                fontSize: 42, fontWeight: 800, letterSpacing: '-0.04em',
                                fontFamily: 'var(--font-heading)', color: '#fff',
                                textShadow: '0 2px 8px rgba(0,0,0,0.3)',
                            }}>
                                {Math.round(weather.temp_c)}°
                            </span>
                            <span style={{ fontSize: 'var(--text-sm)', color: 'rgba(255,255,255,0.65)', fontWeight: 500 }}>
                                Feels {Math.round(weather.feels_like_c)}°
                            </span>
                        </div>
                        <div style={{ fontSize: 'var(--text-sm)', color: '#fff', fontWeight: 600, textShadow: '0 1px 4px rgba(0,0,0,0.2)' }}>
                            {weather.description}
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
                            {weather.location} · H:{Math.round(weather.high_c)}° L:{Math.round(weather.low_c)}°
                            {weather.cached && <span style={{ marginLeft: 8, opacity: 0.6 }}>(cached)</span>}
                        </div>
                    </div>
                </div>

                {/* Right: Stats */}
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <StatPill icon="💨" label="Wind" value={`${Math.round(weather.wind_kmh)} km/h ${weather.wind_dir}`} />
                    <StatPill icon="💧" label="Humidity" value={`${weather.humidity}%`} />
                    {weather.uv_index > 0 && <StatPill icon="☀️" label="UV" value={String(Math.round(weather.uv_index))} />}
                    {weather.rain_probability > 0 && (
                        <div style={{
                            display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 10px',
                            borderRadius: 'var(--radius)', background: 'rgba(100,150,255,0.08)',
                            border: '1px solid rgba(100,150,255,0.15)', fontSize: 'var(--text-xs)', minWidth: 80,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ fontSize: 14 }}>🌧️</span>
                                <div>
                                    <div style={{ color: 'var(--color-text-muted)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rain (6h)</div>
                                    <div style={{ color: '#6ea8fe', fontWeight: 700 }}>{weather.rain_probability}%</div>
                                </div>
                            </div>
                            <div style={{
                                width: '100%', height: 3, borderRadius: 2,
                                background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
                            }}>
                                <div style={{
                                    width: `${weather.rain_probability}%`, height: '100%',
                                    borderRadius: 2, background: 'linear-gradient(90deg, #6ea8fe, #4a8af5)',
                                    transition: 'width 0.6s ease-out',
                                }} />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
