import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import speakeasy from 'speakeasy';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as any).id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token } = await req.json();

    const dbUser = await prisma.user.findUnique({
      where: { id: (session.user as any).id },
      select: { totpSecret: true },
    });

    if (!dbUser || !dbUser.totpSecret) {
      return NextResponse.json({ error: 'TOTP secret not found' }, { status: 400 });
    }

    // Verify the code
    const isValid = speakeasy.totp.verify({
      secret: dbUser.totpSecret,
      encoding: 'base32',
      token: token,
    });

    if (isValid) {
      // Mark as fully enabled
      await prisma.user.update({
        where: { id: (session.user as any).id },
        data: { totpEnabled: true },
      });
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
