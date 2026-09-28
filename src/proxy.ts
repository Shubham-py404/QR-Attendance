// src/proxy.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

export async function proxy(request: NextRequest) {
    // 1. Only protect the scanner route
    if (!request.nextUrl.pathname.startsWith('/scanner')) {
        return NextResponse.next();
    }

    // 2. Fetch the EXACT cookie name set by /api/auth
    const token = request.cookies.get('volunteer_token')?.value;

    if (!token) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    try {
        // 3. Verify the cryptographic signature
        if (!process.env.JWT_SECRET) throw new Error("Missing JWT_SECRET");

        const secret = new TextEncoder().encode(process.env.JWT_SECRET);
        await jwtVerify(token, secret);

        return NextResponse.next();
    } catch (err) {
        // If the token is missing, expired, or forged, deflect to login
        console.error("Auth rejection:", err);
        return NextResponse.redirect(new URL('/', request.url));
    }
}

// 4. Tell Next.js to only run this on the scanner
export const config = {
    matcher: ['/scanner/:path*'],
};