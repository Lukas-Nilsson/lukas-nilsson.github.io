'use client';

import { useState, useEffect, useCallback } from 'react';

interface Message {
    text: string | null;
    from_me: boolean;
    time: string;
    sender: string | null;
}

interface Thread {
    chat_id: string;
    display_name: string | null;
    handles: string[];
    is_group: boolean;
    priority: 'high' | 'medium' | 'low' | 'normal';
    unread_count: number;
    total_recent: number;
    last_message: string | null;
    last_message_time: string;
    you_last_sender: boolean;
    messages: Message[];
}

interface MessagesResponse {
    threads: Thread[];
    total: number;
    hoursBack: number;
    error?: string;
    detail?: string;
}

const PRIORITY_BADGES: Record<string, { emoji: string; label: string; color: string }> = {
    high: { emoji: '🔴', label: 'High', color: '#ef4444' },
    medium: { emoji: '🟡', label: 'Medium', color: '#eab308' },
    normal: { emoji: '⚪', label: 'Normal', color: '#6b7280' },
    low: { emoji: '⬜', label: 'Low', color: '#9ca3af' },
};

export default function MessagesWidget() {
    const [threads, setThreads] = useState<Thread[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedThread, setExpandedThread] = useState<string | null>(null);
    const [replyText, setReplyText] = useState<Record<string, string>>({});
    const [sending, setSending] = useState<string | null>(null);

    const fetchThreads = useCallback(async () => {
        try {
            const res = await fetch('/api/dashboard/messages?hours=24&limit=10');
            const data: MessagesResponse = await res.json();

            if (data.error) {
                setError(data.detail ?? data.error);
                return;
            }

            setThreads(data.threads ?? []);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load messages');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchThreads();
        // Refresh every 5 minutes
        const interval = setInterval(fetchThreads, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [fetchThreads]);

    const handleReply = async (thread: Thread) => {
        const text = replyText[thread.chat_id]?.trim();
        if (!text) return;

        setSending(thread.chat_id);
        try {
            const handle = thread.is_group ? thread.chat_id : thread.handles[0];
            const res = await fetch('/api/dashboard/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    handle,
                    text,
                    isGroup: thread.is_group,
                }),
            });

            if (res.ok) {
                setReplyText(prev => ({ ...prev, [thread.chat_id]: '' }));
                // Refresh threads after sending
                setTimeout(fetchThreads, 2000);
            }
        } catch {
            // Silent fail — UI will show the unsent text
        } finally {
            setSending(null);
        }
    };

    const formatTime = (iso: string) => {
        const d = new Date(iso);
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
        return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    };

    if (loading) {
        return (
            <div style={styles.widget}>
                <h3 style={styles.title}>📱 Messages</h3>
                <div style={styles.loading}>Loading iMessage threads...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={styles.widget}>
                <h3 style={styles.title}>📱 Messages</h3>
                <div style={styles.error}>
                    <span style={styles.errorIcon}>⚠️</span>
                    <div>
                        <div style={styles.errorTitle}>Cannot access iMessage</div>
                        <div style={styles.errorDetail}>{error}</div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.widget}>
            <div style={styles.header}>
                <h3 style={styles.title}>📱 Messages</h3>
                <button
                    onClick={() => { setLoading(true); fetchThreads(); }}
                    style={styles.refreshBtn}
                    title="Refresh"
                >
                    ↻
                </button>
            </div>

            {threads.length === 0 ? (
                <div style={styles.empty}>No recent messages</div>
            ) : (
                <div style={styles.threadList}>
                    {threads.map(thread => {
                        const badge = PRIORITY_BADGES[thread.priority];
                        const isExpanded = expandedThread === thread.chat_id;

                        return (
                            <div key={thread.chat_id} style={styles.thread}>
                                {/* Thread header */}
                                <button
                                    onClick={() => setExpandedThread(isExpanded ? null : thread.chat_id)}
                                    style={styles.threadHeader}
                                >
                                    <div style={styles.threadLeft}>
                                        <span style={styles.badge} title={badge.label}>{badge.emoji}</span>
                                        <div>
                                            <div style={styles.threadName}>
                                                {thread.display_name ?? thread.handles[0]}
                                                {thread.is_group && <span style={styles.groupTag}>group</span>}
                                            </div>
                                            <div style={styles.lastMessage}>
                                                {thread.you_last_sender && <span style={styles.youTag}>You: </span>}
                                                {thread.last_message
                                                    ? (thread.last_message.length > 60
                                                        ? thread.last_message.slice(0, 57) + '...'
                                                        : thread.last_message)
                                                    : '[attachment]'}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={styles.threadRight}>
                                        <div style={styles.time}>{formatTime(thread.last_message_time)}</div>
                                        {thread.unread_count > 0 && !thread.you_last_sender && (
                                            <div style={styles.unreadBadge}>{thread.unread_count}</div>
                                        )}
                                    </div>
                                </button>

                                {/* Expanded thread context */}
                                {isExpanded && (
                                    <div style={styles.expandedContent}>
                                        <div style={styles.messageList}>
                                            {thread.messages.map((msg, idx) => (
                                                <div
                                                    key={idx}
                                                    style={{
                                                        ...styles.message,
                                                        ...(msg.from_me ? styles.messageFromMe : styles.messageFromThem),
                                                    }}
                                                >
                                                    {!msg.from_me && thread.is_group && (
                                                        <div style={styles.messageSender}>{msg.sender}</div>
                                                    )}
                                                    <div style={styles.messageText}>
                                                        {msg.text ?? '[attachment]'}
                                                    </div>
                                                    <div style={styles.messageTime}>
                                                        {formatTime(msg.time)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Quick reply */}
                                        <div style={styles.replyBar}>
                                            <input
                                                type="text"
                                                placeholder="Quick reply..."
                                                value={replyText[thread.chat_id] ?? ''}
                                                onChange={e => setReplyText(prev => ({
                                                    ...prev,
                                                    [thread.chat_id]: e.target.value,
                                                }))}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault();
                                                        handleReply(thread);
                                                    }
                                                }}
                                                style={styles.replyInput}
                                                disabled={sending === thread.chat_id}
                                            />
                                            <button
                                                onClick={() => handleReply(thread)}
                                                disabled={!replyText[thread.chat_id]?.trim() || sending === thread.chat_id}
                                                style={{
                                                    ...styles.sendBtn,
                                                    opacity: replyText[thread.chat_id]?.trim() ? 1 : 0.4,
                                                }}
                                            >
                                                {sending === thread.chat_id ? '...' : '↑'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
    widget: {
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
    },
    title: {
        fontSize: '14px',
        fontWeight: 600,
        color: 'rgba(255,255,255,0.9)',
        margin: 0,
    },
    refreshBtn: {
        background: 'none',
        border: 'none',
        color: 'rgba(255,255,255,0.4)',
        cursor: 'pointer',
        fontSize: '16px',
        padding: '4px 8px',
        borderRadius: '6px',
    },
    loading: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: '13px',
        padding: '20px 0',
        textAlign: 'center' as const,
    },
    error: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '12px',
        background: 'rgba(239,68,68,0.08)',
        borderRadius: '8px',
        border: '1px solid rgba(239,68,68,0.2)',
    },
    errorIcon: { fontSize: '20px', flexShrink: 0 },
    errorTitle: { color: '#ef4444', fontSize: '13px', fontWeight: 600 },
    errorDetail: { color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginTop: '4px', lineHeight: 1.4 },
    empty: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: '13px',
        textAlign: 'center' as const,
        padding: '24px 0',
    },
    threadList: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '2px',
    },
    thread: {
        borderRadius: '8px',
        overflow: 'hidden',
    },
    threadHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        background: 'rgba(255,255,255,0.02)',
        border: 'none',
        padding: '10px 12px',
        cursor: 'pointer',
        textAlign: 'left' as const,
        color: 'inherit',
        fontSize: 'inherit',
        transition: 'background 0.15s',
    },
    threadLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flex: 1,
        minWidth: 0,
    },
    badge: { fontSize: '10px', flexShrink: 0 },
    threadName: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: '13px',
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
    },
    groupTag: {
        fontSize: '10px',
        color: 'rgba(255,255,255,0.3)',
        background: 'rgba(255,255,255,0.06)',
        padding: '1px 5px',
        borderRadius: '4px',
    },
    lastMessage: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: '12px',
        marginTop: '2px',
        whiteSpace: 'nowrap' as const,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: '260px',
    },
    youTag: { color: 'rgba(255,255,255,0.3)' },
    threadRight: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'flex-end',
        gap: '4px',
        flexShrink: 0,
    },
    time: { color: 'rgba(255,255,255,0.3)', fontSize: '11px' },
    unreadBadge: {
        background: '#3b82f6',
        color: '#fff',
        fontSize: '10px',
        fontWeight: 700,
        padding: '1px 6px',
        borderRadius: '10px',
        minWidth: '18px',
        textAlign: 'center' as const,
    },
    expandedContent: {
        background: 'rgba(0,0,0,0.15)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        padding: '12px',
    },
    messageList: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '6px',
        maxHeight: '240px',
        overflowY: 'auto' as const,
        marginBottom: '10px',
    },
    message: {
        padding: '6px 10px',
        borderRadius: '8px',
        maxWidth: '80%',
        fontSize: '12px',
        lineHeight: 1.4,
    },
    messageFromMe: {
        background: 'rgba(59,130,246,0.2)',
        alignSelf: 'flex-end' as const,
        borderBottomRightRadius: '2px',
    },
    messageFromThem: {
        background: 'rgba(255,255,255,0.06)',
        alignSelf: 'flex-start' as const,
        borderBottomLeftRadius: '2px',
    },
    messageSender: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: '10px',
        marginBottom: '2px',
    },
    messageText: { color: 'rgba(255,255,255,0.8)' },
    messageTime: {
        color: 'rgba(255,255,255,0.25)',
        fontSize: '10px',
        marginTop: '2px',
        textAlign: 'right' as const,
    },
    replyBar: {
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
    },
    replyInput: {
        flex: 1,
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        padding: '8px 12px',
        fontSize: '13px',
        color: 'rgba(255,255,255,0.9)',
        outline: 'none',
    },
    sendBtn: {
        background: '#3b82f6',
        border: 'none',
        borderRadius: '8px',
        width: '32px',
        height: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: '16px',
        fontWeight: 700,
        cursor: 'pointer',
        flexShrink: 0,
    },
};
