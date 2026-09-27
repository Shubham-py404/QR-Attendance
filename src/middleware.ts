import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

export async function middleware(request: NextRequest) {
    if (request.nextUrl.pathname.startsWith('/scanner')) {
        const token = request.cookies.get('volunteer_auth')?.value;

        if (!token) return NextResponse.redirect(new URL('/', request.url));

        try {
            const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
            await jwtVerify(token, secret);
            return NextResponse.next();
        } catch (err) {
            // Token is invalid, tampered with, or expired
            return NextResponse.redirect(new URL('/', request.url));
        }
    }
}

export const config = {
    matcher: ['/scanner', '/scanner/:path*'],
};