// src/app/api/verify/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase';
import { createHmac } from 'crypto';

// CRIT-02 & CRIT-04 FIXED: Removed `export const runtime = 'edge'`

export async function POST(request: Request) {
    try {
        const { id } = await request.json();

        if (!id || typeof id !== 'string') return NextResponse.json({ status: 'INVALID' });

        const parts = id.split(':');
        if (parts.length !== 3) return NextResponse.json({ status: 'INVALID' });

        const [uuid, expiryStr, signature] = parts;

        if (Date.now() > parseInt(expiryStr, 10)) {
            return NextResponse.json({ status: 'INVALID', message: 'Pass Expired' });
        }

        // Use dedicated secret (NEW-01)
        const secret = process.env.QR_HMAC_SECRET!;
        const expectedSignature = createHmac('sha256', secret).update(`${uuid}:${expiryStr}`).digest('hex');

        if (signature !== expectedSignature) return NextResponse.json({ status: 'INVALID' });

        // 2. Proceed with Database Transaction
        const { data, error } = await supabaseAdmin.rpc('process_check_in', { scan_id: uuid });

        if (error) throw error;

        if (data === 'INVALID') return NextResponse.json({ status: 'INVALID' });
        if (data === 'ALREADY_SCANNED') return NextResponse.json({ status: 'ALREADY_SCANNED' });

        if (data && data.startsWith('SUCCESS:')) {
            const parts = data.split(':');
            return NextResponse.json({
                status: 'GRANTED',
                name: parts[1],
                section: parts[2],
                count: parseInt(parts[3], 10)
            });
        }

        return NextResponse.json({ status: 'ERROR' });
    } catch (err) {
        return NextResponse.json({ status: 'ERROR' }, { status: 500 });
    }
}