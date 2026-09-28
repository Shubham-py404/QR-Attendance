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

        const { data, error } = await supabaseAdmin
            .from('attendees')
            .select('id, name, section, entry_count')
            .ilike('email', email.trim())
            .eq('phone', phone.trim())
            .maybeSingle();

        if (error || !data) {
            return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
        }

        // No expiry — valid indefinitely (NEW-01)
        const secret = process.env.QR_HMAC_SECRET!;
        const payload = data.id; // Just the ID, no timestamp
        const signature = createHmac('sha256', secret).update(payload).digest('hex');

        const secureQrValue = `${payload}:${signature}`;

        return NextResponse.json({ success: true, student: data, secureQrValue });
    } catch (err) {
        return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
    }
}