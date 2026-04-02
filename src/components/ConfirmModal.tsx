// Custom confirmation/alert modal to replace browser confirm() and alert()
'use client';

import { useState, useCallback, useEffect, createContext, useContext, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ModalConfig {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'info';
    onConfirm?: () => void;
    onCancel?: () => void;
}

interface ModalContextType {
    showConfirm: (config: ModalConfig) => Promise<boolean>;
    showAlert: (title: string, message: string, variant?: 'danger' | 'warning' | 'info') => Promise<void>;
}

const ModalContext = createContext<ModalContextType | null>(null);

export function useModal() {
    const ctx = useContext(ModalContext);
    if (!ctx) throw new Error('useModal must be used within ModalProvider');
    return ctx;
}

export function ModalProvider({ children }: { children: React.ReactNode }) {
    const [config, setConfig] = useState<ModalConfig | null>(null);
    const [isAlert, setIsAlert] = useState(false);
    const resolveRef = useRef<((value: boolean) => void) | null>(null);

    const showConfirm = useCallback((cfg: ModalConfig): Promise<boolean> => {
        return new Promise(resolve => {
            resolveRef.current = resolve;
            setIsAlert(false);
            setConfig(cfg);
        });
    }, []);

    const showAlert = useCallback((title: string, message: string, variant?: 'danger' | 'warning' | 'info'): Promise<void> => {
        return new Promise(resolve => {
            resolveRef.current = () => resolve() as unknown as boolean;
            setIsAlert(true);
            setConfig({ title, message, variant: variant ?? 'info' });
        });
    }, []);

    const handleConfirm = () => {
        config?.onConfirm?.();
        resolveRef.current?.(true);
        resolveRef.current = null;
        setConfig(null);
    };

    const handleCancel = () => {
        config?.onCancel?.();
        resolveRef.current?.(false);
        resolveRef.current = null;
        setConfig(null);
    };

    // Close on escape key
    useEffect(() => {
        if (!config) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') handleCancel();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    });

    const variantColors = {
        danger: { bg: 'rgba(192,80,80,0.08)', border: 'rgba(192,80,80,0.3)', btn: '#c05050', btnBg: 'rgba(192,80,80,0.12)' },
        warning: { bg: 'rgba(193,127,58,0.08)', border: 'rgba(193,127,58,0.3)', btn: '#c17f3a', btnBg: 'rgba(193,127,58,0.12)' },
        info: { bg: 'rgba(90,130,200,0.08)', border: 'rgba(90,130,200,0.3)', btn: '#5a82c8', btnBg: 'rgba(90,130,200,0.12)' },
    };

    return (
        <ModalContext.Provider value={{ showConfirm, showAlert }}>
            {children}
            {config && typeof document !== 'undefined' && createPortal(
                <div
                    onClick={handleCancel}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 10000,
                        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        animation: 'fadeIn 0.15s ease',
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: 'var(--color-bg, #1a1a1a)',
                            border: `1px solid ${variantColors[config.variant ?? 'info'].border}`,
                            borderRadius: 'var(--radius-lg, 12px)',
                            padding: '20px 24px',
                            maxWidth: 380,
                            width: '90%',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                            animation: 'slideUp 0.2s ease',
                        }}
                    >
                        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text, #e5e5e5)', marginBottom: 8 }}>
                            {config.title}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--color-text-muted, #999)', lineHeight: 1.5, marginBottom: 16 }}>
                            {config.message}
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            {!isAlert && (
                                <button
                                    onClick={handleCancel}
                                    style={{
                                        padding: '7px 16px', borderRadius: 'var(--radius-sm, 6px)',
                                        border: '1px solid var(--color-border, #333)',
                                        background: 'var(--color-surface, #222)', color: 'var(--color-text, #e5e5e5)',
                                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                    }}
                                >
                                    {config.cancelLabel ?? 'Cancel'}
                                </button>
                            )}
                            <button
                                onClick={handleConfirm}
                                autoFocus
                                style={{
                                    padding: '7px 16px', borderRadius: 'var(--radius-sm, 6px)',
                                    border: `1px solid ${variantColors[config.variant ?? 'info'].border}`,
                                    background: variantColors[config.variant ?? 'info'].btnBg,
                                    color: variantColors[config.variant ?? 'info'].btn,
                                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                }}
                            >
                                {isAlert ? 'OK' : (config.confirmLabel ?? 'Confirm')}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </ModalContext.Provider>
    );
}
