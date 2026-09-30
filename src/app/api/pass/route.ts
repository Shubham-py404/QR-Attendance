import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase';
import { createHmac } from 'crypto';

export async function POST(request: Request) {
    try {
        const { email, phone } = await request.json();

        // Validate inputs (HIGH-02)
        if (!email || !phone || typeof email !== 'string' || typeof phone !== 'string') {
            return NextResponse.json({ success: false, message: 'Invalid input' }, { status: 400 });
        }
        const cleanPhone = phone.replace(/\D/g, '');
        const { data, error } = await supabaseAdmin
            .from('attendees')
            .select('id, name, section, entry_count')
            .ilike('email', email.trim())
            .eq('phone', cleanPhone)
            .maybeSingle();

        if (error || !data) {
            return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
        }

        // No expiry — valid indefinitely (NEW-01)
        if (!process.env.QR_HMAC_SECRET) throw new Error("Missing QR_HMAC_SECRET");
        const secret = process.env.QR_HMAC_SECRET!;
        const payload = data.id; // Just the ID, no timestamp
        const signature = createHmac('sha256', secret).update(payload).digest('hex');

        const secureQrValue = `${payload}:${signature}`;

        return NextResponse.json({ success: true, student: data, secureQrValue });
    } catch (err) {
        console.error('[Pass Generation Error]:', err);
        return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
    }
}