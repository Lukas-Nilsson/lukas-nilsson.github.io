import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const metadata = {
    title: 'CLEANED Demo — Lukas Nilsson'
};

export default async function CleanedDemoPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login?redirect=/demo/cleaned');
    }

    return (
        <div style={{ width: '100%', height: '100dvh', overflow: 'hidden', background: '#0a0a0f' }}>
            <iframe 
                src="/demo/cleaned/index.html" 
                style={{ 
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
