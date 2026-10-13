import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import speakeasy from 'speakeasy';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
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
      select: { totpSecret: true, totpEnabled: true },
    });

    if (!dbUser || !dbUser.totpEnabled || !dbUser.totpSecret) {
      return NextResponse.json({ error: 'TOTP not enabled' }, { status: 400 });
    }

    const isValid = speakeasy.totp.verify({
      secret: dbUser.totpSecret,
      encoding: 'base32',
      token: token,
      window: 1 // allow 30 second leeway
    });

    if (isValid) {
      // Set an HTTP-only secure cookie that proves 2FA is passed for this session
      const response = NextResponse.json({ success: true });
      response.cookies.set({
        name: 'totp-verified',
        value: 'true',
        httpOnly: true,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 // 24 hours
      });
      return response;
    } else {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
