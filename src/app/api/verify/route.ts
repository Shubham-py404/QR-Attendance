// src/app/api/verify/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase';
import { createHmac } from 'crypto';

export async function POST(request: Request) {
    try {
        const { qrData } = await request.json();

        if (!qrData || typeof qrData !== 'string') return NextResponse.json({ status: 'INVALID' });

        const parts = qrData.split(':');
        if (parts.length !== 2) return NextResponse.json({ status: 'INVALID' });

        const [uuid, signature] = parts;

        // Verify cryptographic signature
        const secret = process.env.QR_HMAC_SECRET!;
        const expectedSignature = createHmac('sha256', secret).update(uuid).digest('hex');

        if (signature !== expectedSignature) return NextResponse.json({ status: 'INVALID' });

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
                // Fetch student details from the database so the scanner UI can display who it belongs to
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
        return NextResponse.json({ status: 'ERROR' }, { status: 500 });
    }
}