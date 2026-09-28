import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { SignJWT } from 'jose';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
);

export async function POST(request: Request) {
    try {
        const { email, password } = await request.json();
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

        if (error || !data.user) {
            return NextResponse.json({ success: false }, { status: 401 });
        }

        // Cryptographically sign the cookie
        const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
        const token = await new SignJWT({ role: 'volunteer', email })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime('12h')
            .sign(secret);

        const cookieStore = await cookies();
        cookieStore.set('volunteer_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 12, // 12 hours in seconds
            path: '/',
        });

        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ success: false }, { status: 500 });
    }
}

export async function DELETE() {
    (await cookies()).delete('volunteer_token');
    return NextResponse.json({ success: true });
} export async function GET() {
    const cookieStore = await cookies();
    return NextResponse.json({ isLoggedIn: cookieStore.has('volunteer_token') });
}