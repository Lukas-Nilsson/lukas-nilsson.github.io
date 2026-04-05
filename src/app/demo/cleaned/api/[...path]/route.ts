import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BACKEND_ORIGIN =
    process.env.CLEANED_DEMO_BACKEND_ORIGIN ??
    'https://cleaned-demo-backend-hpogfshfba-uc.a.run.app';

const REQUEST_HEADERS_TO_STRIP = ['connection', 'content-length', 'host', 'origin', 'referer'];
const RESPONSE_HEADERS_TO_STRIP = ['connection', 'content-encoding', 'keep-alive', 'transfer-encoding'];

type RouteContext = {
    params: Promise<{ path: string[] }>;
};

async function proxyRequest(request: NextRequest, context: RouteContext) {
    const { path } = await context.params;
    const normalizedPath = path.filter(Boolean).join('/');
    const targetUrl = new URL(`/api/${normalizedPath}${request.nextUrl.search}`, BACKEND_ORIGIN);

    const headers = new Headers(request.headers);
    for (const header of REQUEST_HEADERS_TO_STRIP) {
        headers.delete(header);
    }

    const init: RequestInit = {
        method: request.method,
        headers,
        cache: 'no-store',
        redirect: 'manual',
    };

    if (request.method !== 'GET' && request.method !== 'HEAD') {
        init.body = await request.arrayBuffer();
    }

    let upstream: Response;
    try {
        upstream = await fetch(targetUrl, init);
    } catch (error) {
        console.error('[cleaned-demo proxy] Upstream request failed:', error);
        return NextResponse.json(
            { error: 'Failed to reach the CLEANED demo backend.' },
            { status: 502 }
        );
    }

    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.set('Cache-Control', 'no-store');
    for (const header of RESPONSE_HEADERS_TO_STRIP) {
        responseHeaders.delete(header);
    }

    const body = request.method === 'HEAD' ? null : await upstream.arrayBuffer();
    return new Response(body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders,
    });
}

export async function GET(request: NextRequest, context: RouteContext) {
    return proxyRequest(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
    return proxyRequest(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
    return proxyRequest(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
    return proxyRequest(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
    return proxyRequest(request, context);
}

export async function HEAD(request: NextRequest, context: RouteContext) {
    return proxyRequest(request, context);
}

export async function OPTIONS(request: NextRequest, context: RouteContext) {
    return proxyRequest(request, context);
}
