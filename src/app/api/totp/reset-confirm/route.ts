import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    const { token, email } = await req.json();

    if (!token || !email) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Find token
    const dbToken = await prisma.verificationToken.findFirst({
      where: {
        identifier: email,
        token: token,
      }
    });

    if (!dbToken) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    if (dbToken.expires < new Date()) {
      return NextResponse.json({ error: 'Token expired' }, { status: 400 });
    }

    // Token is valid! Reset the user's TOTP.
    await prisma.user.update({
      where: { email: email },
      data: {
        totpEnabled: false,
        totpSecret: null
      }
    });

    // Delete the token so it can't be used again
    await prisma.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: email,
          token: token
        }
      }
    });

    // We can also set the cookie just in case they are still logged in
    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: 'totp-verified',
      value: 'true',
      httpOnly: true,
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24
    });

    return response;
  } catch (error) {
    console.error('Reset Confirm Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
