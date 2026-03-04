'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './AIChatWidget.module.css';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

const INITIAL_MESSAGE: Message = {
    role: 'assistant',
    content:
        'Hi — I\'m Lukas\'s AI. Ask me anything about his work, philosophy, or what he\'s building. I\'ll do my best to represent him faithfully.',
};

export default function AIChatWidget() {
    const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        const trimmed = input.trim();
        if (!trimmed || isLoading) return;

        const userMessage: Message = { role: 'user', content: trimmed };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInput('');
        setIsLoading(true);

        const assistantMessage: Message = { role: 'assistant', content: '' };
        setMessages([...newMessages, assistantMessage]);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
                }),
            });

            if (!response.ok) throw new Error('Failed to get response');

            const reader = response.body!.getReader();
            const decoder = new TextDecoder();
            let fullContent = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter((line) => line.startsWith('data: '));

                for (const line of lines) {
                    const data = line.slice(6);
                    if (data === '[DONE]') break;
                    try {
                        const parsed = JSON.parse(data);
                        const delta = parsed.choices?.[0]?.delta?.content ?? '';
                        fullContent += delta;
                        setMessages((prev) => {
                            const updated = [...prev];
                            updated[updated.length - 1] = { role: 'assistant', content: fullContent };
                            return updated;
                        });
                    } catch {
                        // ignore parse errors
                    }
                }
            }
        } catch {
            setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                    role: 'assistant',
                    content: 'Sorry, something went wrong. Please try again.',
                };
                return updated;
            });
        } finally {
            setIsLoading(false);
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const SUGGESTIONS = [
        "What are you currently building?",
        "What's your philosophy on technology?",
        "Tell me about The Human Archives",
        "What kind of work do you take on?",
    ];

    return (
        <div className={styles.widget}>
            <div className={styles.header}>
                <div className={styles.statusDot} aria-hidden="true" />
                <span className={styles.headerLabel}>Ask Lukas anything</span>
            </div>

            <div className={styles.messages} role="log" aria-live="polite" aria-label="Chat messages">
                {messages.map((msg, i) => (
                    <div
                        key={i}
                        className={`${styles.message} ${msg.role === 'user' ? styles.userMessage : styles.aiMessage}`}
                    >
                        {msg.role === 'assistant' && (
                            <div className={styles.aiAvatar} aria-hidden="true">L</div>
                        )}
                        <div className={styles.bubble}>
                            {msg.content || (isLoading && i === messages.length - 1 ? (
                                <span className={styles.typingIndicator}>
                                    <span /><span /><span />
                                </span>
                            ) : '')}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {messages.length === 1 && (
                <div className={styles.suggestions}>
                    {SUGGESTIONS.map((s) => (
                        <button
                            key={s}
                            className={styles.suggestion}
                            onClick={() => {
                                setInput(s);
                                inputRef.current?.focus();
                            }}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            )}

            <form className={styles.inputRow} onSubmit={handleSubmit}>
                <textarea
                    ref={inputRef}
                    className={styles.input}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask me anything..."
                    rows={1}
                    disabled={isLoading}
                    aria-label="Your message"
                />
                <button
                    type="submit"
                    className={styles.sendBtn}
                    disabled={!input.trim() || isLoading}
                    aria-label="Send message"
                >
                    {isLoading ? <span className="spinner" /> : (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path d="M14 8L2 2l2.5 6L2 14l12-6z" fill="currentColor" />
                        </svg>
                    )}
                </button>
            </form>
        </div>
    );
}
