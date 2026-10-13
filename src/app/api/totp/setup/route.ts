import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as any).id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = session.user?.email || 'unknown';
    
    const secretInfo = speakeasy.generateSecret({
      name: `PhishingDetector (${userEmail})`
    });
    const secret = secretInfo.base32;
    const otpauth = secretInfo.otpauth_url as string;
    
    // Generate QR Code image data URL
    const qrCodeUrl = await QRCode.toDataURL(otpauth);

    // Temporarily save the secret to DB (without enabling it yet)
    await prisma.user.update({
      where: { id: (session.user as any).id },
      data: { totpSecret: secret },
    });

    return NextResponse.json({ qrCodeUrl, secret });
  } catch (error) {
    console.error('TOTP Setup Error:', error);
    return NextResponse.json({ error: 'Failed to generate TOTP' }, { status: 500 });
  }
}
