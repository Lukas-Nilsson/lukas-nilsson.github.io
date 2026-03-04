import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Dashboard',
    description: 'Personal data dashboard.',
    robots: { index: false, follow: false },
};

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div data-theme="dashboard" style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
            {children}
        </div>
    );
}
