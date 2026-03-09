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

async function fetchDayWeather(targetDate: string): Promise<WeatherData> {
    const todayAEST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Melbourne' })).toISOString().slice(0, 10);
    const isToday = targetDate === todayAEST;
    const isFuture = targetDate > todayAEST;
    const isPast = targetDate < todayAEST;

    if (isToday) {
        return fetchLiveWeather();
    }

    if (isFuture) {
        // Use forecast API — Open-Meteo supports up to 16 days forecast
        const daysDiff = Math.round((new Date(targetDate + 'T00:00:00').getTime() - new Date(todayAEST + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24));
        const params = new URLSearchParams({
            latitude: String(LAT), longitude: String(LON),
            daily: 'temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,wind_speed_10m_max,uv_index_max',
            forecast_days: String(Math.min(daysDiff + 1, 16)),
            timezone: 'Australia/Melbourne',
        });
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
        if (!res.ok) throw new Error(`Open-Meteo forecast: ${res.status}`);
        const data = await res.json();
        const idx = data.daily?.time?.indexOf(targetDate) ?? -1;
        if (idx === -1) throw new Error('Date not in forecast range');
        const code = data.daily.weather_code[idx] as number;
        const wmo = WMO_CODES[code] ?? { desc: 'Forecast', emoji: '🌡️' };
        return {
            description: wmo.desc, emoji: wmo.emoji,
            temp_c: (data.daily.temperature_2m_max[idx] + data.daily.temperature_2m_min[idx]) / 2,
            feels_like_c: (data.daily.temperature_2m_max[idx] + data.daily.temperature_2m_min[idx]) / 2,
            wind_kmh: data.daily.wind_speed_10m_max?.[idx] ?? 0,
            wind_dir: '', humidity: 0,
            rain_probability: data.daily.precipitation_probability_max?.[idx] ?? 0,
            rain_amount_mm: 0, uv_index: data.daily.uv_index_max?.[idx] ?? 0,
            is_day: true,
            high_c: data.daily.temperature_2m_max[idx],
            low_c: data.daily.temperature_2m_min[idx],
            location: 'Malvern, VIC',
            fetched_at: new Date().toISOString(),
        };
    }

    // Past — use Open-Meteo historical API
    const params = new URLSearchParams({
        latitude: String(LAT), longitude: String(LON),
        daily: 'temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum,wind_speed_10m_max',
        start_date: targetDate, end_date: targetDate,
        timezone: 'Australia/Melbourne',
    });
    const res = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params}`);
    if (!res.ok) throw new Error(`Open-Meteo archive: ${res.status}`);
    const data = await res.json();
    const daily = data.daily;
    if (!daily?.time?.length) throw new Error('No historical data');
    const code = daily.weather_code[0] as number;
    const wmo = WMO_CODES[code] ?? { desc: 'Historical', emoji: '🌡️' };
    return {
        description: wmo.desc, emoji: wmo.emoji,
        temp_c: (daily.temperature_2m_max[0] + daily.temperature_2m_min[0]) / 2,
        feels_like_c: (daily.temperature_2m_max[0] + daily.temperature_2m_min[0]) / 2,
        wind_kmh: daily.wind_speed_10m_max?.[0] ?? 0,
        wind_dir: '', humidity: 0,
        rain_probability: 0, rain_amount_mm: daily.precipitation_sum?.[0] ?? 0,
        uv_index: 0, is_day: true,
        high_c: daily.temperature_2m_max[0], low_c: daily.temperature_2m_min[0],
        location: 'Malvern, VIC',
        fetched_at: new Date().toISOString(),
    };
}

export async function GET(req: Request) {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    const url = new URL(req.url);
    const dateParam = url.searchParams.get('date');

    try {
        const weather = dateParam ? await fetchDayWeather(dateParam) : await fetchLiveWeather();

        // Cache current weather to Supabase for OpenClaw (only if no date param = today)
        if (!dateParam) {
            try {
                const supabase = createAdminClient();
                await supabase.from('weather_cache').upsert({
                    id: 'current',
                    data: weather,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'id' });
            } catch { /* non-critical */ }
        }

        return NextResponse.json({ ...weather, forecast: !!dateParam });
    } catch (err) {
        // Fallback: try Supabase cache (only for today)
        if (!dateParam) {
            try {
                const supabase = createAdminClient();
                const { data } = await supabase.from('weather_cache').select('data').eq('id', 'current').single();
                if (data?.data) {
                    return NextResponse.json({ ...data.data, cached: true });
                }
            } catch { /* ignore */ }
        }

        console.error('[weather] Error:', err);
        return NextResponse.json({ error: 'Weather unavailable' }, { status: 502 });
    }
}
