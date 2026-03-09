import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/supabase/auth-guard';
import { NextResponse } from 'next/server';

// Open-Meteo weather codes → description + emoji
const WMO_CODES: Record<number, { desc: string; emoji: string }> = {
    0: { desc: 'Clear sky', emoji: '☀️' },
    1: { desc: 'Mainly clear', emoji: '🌤️' },
    2: { desc: 'Partly cloudy', emoji: '⛅' },
    3: { desc: 'Overcast', emoji: '☁️' },
    45: { desc: 'Fog', emoji: '🌫️' },
    48: { desc: 'Rime fog', emoji: '🌫️' },
    51: { desc: 'Light drizzle', emoji: '🌦️' },
    53: { desc: 'Drizzle', emoji: '🌦️' },
    55: { desc: 'Dense drizzle', emoji: '🌧️' },
    61: { desc: 'Light rain', emoji: '🌦️' },
    63: { desc: 'Rain', emoji: '🌧️' },
    65: { desc: 'Heavy rain', emoji: '🌧️' },
    80: { desc: 'Rain showers', emoji: '🌧️' },
    81: { desc: 'Heavy showers', emoji: '🌧️' },
    82: { desc: 'Violent showers', emoji: '⛈️' },
    95: { desc: 'Thunderstorm', emoji: '⛈️' },
    96: { desc: 'Thunderstorm + hail', emoji: '⛈️' },
    99: { desc: 'Thunderstorm + hail', emoji: '⛈️' },
    71: { desc: 'Light snow', emoji: '🌨️' },
    73: { desc: 'Snow', emoji: '❄️' },
    75: { desc: 'Heavy snow', emoji: '❄️' },
};

interface WeatherData {
    description: string;
    emoji: string;
    temp_c: number;
    feels_like_c: number;
    wind_kmh: number;
    wind_dir: string;
    humidity: number;
    rain_probability: number;
    rain_amount_mm: number;
    uv_index: number;
    is_day: boolean;
    high_c: number;
    low_c: number;
    location: string;
    fetched_at: string;
}

// Malvern, VIC coordinates
const LAT = -37.8618;
const LON = 145.0413;

function degToCompass(deg: number): string {
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return dirs[Math.round(deg / 22.5) % 16];
}

async function fetchLiveWeather(): Promise<WeatherData> {
    const params = new URLSearchParams({
        latitude: String(LAT),
        longitude: String(LON),
        current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,relative_humidity_2m,uv_index,is_day',
        daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
        hourly: 'precipitation_probability',
        forecast_hours: '6',
        forecast_days: '1',
        timezone: 'Australia/Melbourne',
    });

    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { next: { revalidate: 300 } });
    if (!res.ok) throw new Error(`Open-Meteo: ${res.status}`);

    const data = await res.json();
    const current = data.current;
    const daily = data.daily;
    const hourly = data.hourly;

    const code = current.weather_code as number;
    const wmo = WMO_CODES[code] ?? { desc: 'Weather data', emoji: '🌡️' };

    // Max rain probability in next 6 hours
    const rainProbs: number[] = hourly?.precipitation_probability ?? [];
    const maxRainProb = rainProbs.length > 0 ? Math.max(...rainProbs) : 0;

    return {
        description: wmo.desc,
        emoji: wmo.emoji,
        temp_c: current.temperature_2m,
        feels_like_c: current.apparent_temperature,
        wind_kmh: current.wind_speed_10m,
        wind_dir: degToCompass(current.wind_direction_10m),
        humidity: current.relative_humidity_2m,
        rain_probability: maxRainProb,
        rain_amount_mm: 0,
        uv_index: current.uv_index ?? 0,
        is_day: current.is_day === 1,
        high_c: daily?.temperature_2m_max?.[0] ?? current.temperature_2m,
        low_c: daily?.temperature_2m_min?.[0] ?? current.temperature_2m,
        location: 'Malvern, VIC',
        fetched_at: new Date().toISOString(),
    };
}

export async function GET() {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    try {
        const weather = await fetchLiveWeather();

        // Also cache to Supabase for OpenClaw
        try {
            const supabase = createAdminClient();
            await supabase.from('weather_cache').upsert({
                id: 'current',
                data: weather,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'id' });
        } catch { /* non-critical */ }

        return NextResponse.json(weather);
    } catch (err) {
        // Fallback: try Supabase cache
        try {
            const supabase = createAdminClient();
            const { data } = await supabase.from('weather_cache').select('data').eq('id', 'current').single();
            if (data?.data) {
                return NextResponse.json({ ...data.data, cached: true });
            }
        } catch { /* ignore */ }

        console.error('[weather] Error:', err);
        return NextResponse.json({ error: 'Weather unavailable' }, { status: 502 });
    }
}
