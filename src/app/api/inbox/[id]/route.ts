import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as any).id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const userId = (session.user as any).id;

    const email = await prisma.scannedEmail.findFirst({
      where: { id, userId }
    });

    if (!email) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ success: true, email });
  } catch (error) {
    console.error('Fetch Email Error:', error);
    return NextResponse.json({ error: 'Failed to fetch email' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as any).id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const userId = (session.user as any).id;

    // "Soft delete" to prevent IMAP re-syncing while saving DB space
    await prisma.scannedEmail.updateMany({
      where: { id, userId },
      data: {
        status: 'DELETED',
        textBody: '',
        subject: '',
        triggers: null,
        oracleScore: null,
        oracleLabel: null
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete Email Error:', error);
    return NextResponse.json({ error: 'Failed to delete email' }, { status: 500 });
  }
}
