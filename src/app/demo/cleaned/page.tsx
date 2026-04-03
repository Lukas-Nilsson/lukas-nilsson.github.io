import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const metadata = {
    title: 'CLEANED Demo — Lukas Nilsson'
};

export const viewport = {
    themeColor: '#0a0a0f',
};

export default async function CleanedDemoPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login?redirect=/demo/cleaned');
    }

    const email = (user.email ?? '').toLowerCase();
    const viewer =
        email.includes('horng')
            ? 'horng'
            : email.includes('lukas')
                ? 'lukas'
                : 'unknown';

    return (
        <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#0a0a0f' }}>
            <style dangerouslySetInnerHTML={{ __html: `
                html, body { 
                    background-color: #0a0a0f !important; 
                    margin: 0; padding: 0; 
                    overflow: hidden !important; 
                    position: fixed !important; 
                    width: 100% !important; 
                    height: 100% !important;
                    overscroll-behavior: none;
                    -webkit-overflow-scrolling: none;
                }
            ` }} />
            <iframe 
                src={`/demo/cleaned/index.html?viewer=${viewer}`}
                style={{ 
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%', 
                    height: '100%', 
                    border: 'none',
                    display: 'block'
                }}
                title="CLEANED AI Inspection Demo"
            />
        </div>
    );
}
