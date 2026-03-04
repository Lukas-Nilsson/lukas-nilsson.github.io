'use client';

import {
    AreaChart as RechartsArea,
    Area,
    LineChart as RechartsLine,
    Line,
    BarChart as RechartsBar,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';

// ─── Shared tooltip style ──────────────────────────────────────────────────────
const tooltipStyle = {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    fontSize: '12px',
    color: 'var(--color-text)',
};

// ─── Line Chart ───────────────────────────────────────────────────────────────
interface LineProps {
    data: Record<string, unknown>[];
    lines: { key: string; color: string; name?: string }[];
    xKey: string;
    height?: number;
    unit?: string;
    tickFormatter?: (v: unknown) => string;
    yDomain?: [number, number];
}

export function LineChart({ data, lines, xKey, height = 180, unit = '', tickFormatter, yDomain }: LineProps) {
    return (
        <ResponsiveContainer width="100%" height={height}>
            <RechartsLine data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} tickFormatter={tickFormatter} domain={yDomain} />
                <Tooltip contentStyle={tooltipStyle} />
                {lines.map(l => (
                    <Line
                        key={l.key}
                        type="monotone"
                        dataKey={l.key}
                        name={l.name ?? l.key}
                        stroke={l.color}
                        strokeWidth={2}
                        dot={{ fill: l.color, r: 3 }}
                        activeDot={{ r: 5 }}
                        unit={unit}
                    />
                ))}
            </RechartsLine>
        </ResponsiveContainer>
    );
}

// ─── Area Chart ───────────────────────────────────────────────────────────────
interface AreaProps {
    data: Record<string, unknown>[];
    areas: { key: string; color: string; name?: string }[];
    xKey: string;
    height?: number;
    unit?: string;
    tickFormatter?: (v: unknown) => string;
}

export function AreaChart({ data, areas, xKey, height = 180, unit = '', tickFormatter }: AreaProps) {
    return (
        <ResponsiveContainer width="100%" height={height}>
            <RechartsArea data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} tickFormatter={tickFormatter} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                {areas.map(a => (
                    <Area
                        key={a.key}
                        type="monotone"
                        dataKey={a.key}
                        name={a.name ?? a.key}
                        stroke={a.color}
                        fill={`${a.color}22`}
                        strokeWidth={2}
                        dot={{ fill: a.color, r: 3 }}
                        unit={unit}
                    />
                ))}
            </RechartsArea>
        </ResponsiveContainer>
    );
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────
interface BarProps {
    data: Record<string, unknown>[];
    bars: { key: string; color: string; name?: string }[];
    xKey: string;
    height?: number;
    unit?: string;
    tickFormatter?: (v: unknown) => string;
    yDomain?: [number, number];
}

export function BarChart({ data, bars, xKey, height = 160, unit = '', tickFormatter, yDomain }: BarProps) {
    return (
        <ResponsiveContainer width="100%" height={height}>
            <RechartsBar data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} tickFormatter={tickFormatter} domain={yDomain} />
                <Tooltip contentStyle={tooltipStyle} />
                {bars.map(b => (
                    <Bar key={b.key} dataKey={b.key} name={b.name ?? b.key} fill={b.color} radius={[3, 3, 0, 0]} unit={unit} />
                ))}
            </RechartsBar>
        </ResponsiveContainer>
    );
}
