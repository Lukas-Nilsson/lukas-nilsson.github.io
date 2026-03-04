import { getOpenAI, LUKAS_SYSTEM_PROMPT } from '@/lib/openai';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { messages } = await req.json();

        if (!messages || !Array.isArray(messages)) {
            return new Response('Invalid request', { status: 400 });
        }

        // Limit history to last 20 messages to control cost
        const recentMessages = messages.slice(-20);

        const stream = await getOpenAI().chat.completions.create({
            model: 'gpt-4o',
            stream: true,
            max_tokens: 600,
            temperature: 0.7,
            messages: [
                { role: 'system', content: LUKAS_SYSTEM_PROMPT },
                ...recentMessages,
            ],
        });

        const encoder = new TextEncoder();

        const readable = new ReadableStream({
            async start(controller) {
                for await (const chunk of stream) {
                    const data = `data: ${JSON.stringify(chunk)}\n\n`;
                    controller.enqueue(encoder.encode(data));
                }
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
            },
        });

        return new Response(readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-transform',
                Connection: 'keep-alive',
            },
        });
    } catch (error) {
        console.error('Chat API error:', error);
        return new Response('Internal server error', { status: 500 });
    }
}
