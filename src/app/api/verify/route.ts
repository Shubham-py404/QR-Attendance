import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '../../../lib/supabase';
import { createHmac, timingSafeEqual } from 'crypto';
import { jwtVerify } from 'jose';

export async function POST(request: Request) {
    try {
        // 1. Authenticate the Volunteer
        const cookieStore = await cookies();
        const token = cookieStore.get('volunteer_token')?.value;
        if (!token) return NextResponse.json({ status: 'ERROR', message: 'Unauthorized' }, { status: 401 });

        try {
            const jwtSecret = new TextEncoder().encode(process.env.JWT_SECRET!);
            await jwtVerify(token, jwtSecret);
        } catch {
            return NextResponse.json({ status: 'ERROR', message: 'Unauthorized' }, { status: 401 });
        }

        const { qrData } = await request.json();

        if (!qrData || typeof qrData !== 'string') return NextResponse.json({ status: 'INVALID' });

        const parts = qrData.split(':');
        if (parts.length !== 2) return NextResponse.json({ status: 'INVALID' });

        const [uuid, signature] = parts;

        // 2. Environment Variable Guard
        if (!process.env.QR_HMAC_SECRET) {
            throw new Error("Missing QR_HMAC_SECRET");
        }

        // 3. Verify cryptographic signature in Constant Time
        const secret = process.env.QR_HMAC_SECRET;
        const expectedSignature = createHmac('sha256', secret).update(uuid).digest('hex');

        // Prevent length mismatch errors in timingSafeEqual
        if (signature.length !== expectedSignature.length) {
            return NextResponse.json({ status: 'INVALID' });
        }

        const isValid = timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );

        if (!isValid) return NextResponse.json({ status: 'INVALID' });

        // Run database check-in transaction
        const { data, error } = await supabaseAdmin.rpc('process_check_in', { scan_id: uuid });

        if (error) throw error;
        if (data === 'INVALID') return NextResponse.json({ status: 'INVALID' });

        // Handle ALREADY_SCANNED with student metadata
        if (data === 'ALREADY_SCANNED' || (typeof data === 'string' && data.startsWith('ALREADY_SCANNED'))) {
            let name = "Delegate";
            let section = "";
            let count = parseInt(process.env.NEXT_PUBLIC_MAX_ENTRIES || "3", 10);

            if (data.includes(':')) {
                const p = data.split(':');
                name = p[1] || name;
                section = p[2] || section;
                count = parseInt(p[3], 10) || count;
            } else {
                const { data: student } = await supabaseAdmin
                    .from('attendees')
                    .select('name, section, entry_count')
                    .eq('id', uuid)
                    .maybeSingle();

                if (student) {
                    name = student.name;
                    section = student.section;
                    count = student.entry_count;
                }
            }

            return NextResponse.json({
                status: 'ALREADY_SCANNED',
                name,
                section,
                count
            });
        }

        if (data && data.startsWith('SUCCESS:')) {
            const resultParts = data.split(':');
            return NextResponse.json({
                status: 'GRANTED',
                name: resultParts[1],
                section: resultParts[2],
                count: parseInt(resultParts[3], 10)
            });
        }

        return NextResponse.json({ status: 'ERROR' });
    } catch (err) {
        // 4. Log the error for visibility
        console.error('[Verify Route Error]:', err);
        return NextResponse.json({ status: 'ERROR' }, { status: 500 });
    }
}