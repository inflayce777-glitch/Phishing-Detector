import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as any).id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await req.json();
    const { emailId, oracleScore, oracleLabel, triggers } = body;

    if (!emailId) return NextResponse.json({ error: 'Missing emailId' }, { status: 400 });

    const updated = await prisma.scannedEmail.updateMany({
      where: { id: emailId, userId },
      data: {
        status: 'ANALYZED',
        oracleScore,
        oracleLabel,
        triggers: triggers ? (typeof triggers === 'string' ? triggers : JSON.stringify(triggers)) : null
      }
    });

    return NextResponse.json({ success: true, updated });
  } catch (error) {
    console.error('Update Email Error:', error);
    return NextResponse.json({ error: 'Failed to update email' }, { status: 500 });
  }
}
