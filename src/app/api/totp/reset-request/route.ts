import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as any).id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = session.user?.email;
    if (!userEmail) return NextResponse.json({ error: 'Email not found' }, { status: 400 });

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    // Store in DB
    await prisma.verificationToken.create({
      data: {
        identifier: userEmail,
        token: token,
        expires: expires
      }
    });

    // Create Reset URL
    const resetUrl = `${process.env.NEXTAUTH_URL}/auth/reset-totp?token=${token}&email=${encodeURIComponent(userEmail)}`;

    // Send Email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    await transporter.sendMail({
      from: `"Phishing Detector Security" <${process.env.SMTP_USER}>`,
      to: userEmail,
      subject: 'Запит на скидання 2FA (TOTP)',
      html: `
        <div style="font-family: monospace; background: #000; color: #fff; padding: 20px; text-align: center;">
          <h2 style="color: #06b6d4;">СКИДАННЯ 2FA</h2>
          <p>Ми отримали запит на скидання двофакторної автентифікації для вашого акаунту.</p>
          <p>Якщо це були ви, натисніть кнопку нижче. Посилання дійсне 15 хвилин.</p>
          <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; margin-top: 20px; background: #dc2626; color: #fff; text-decoration: none; border-radius: 4px; font-weight: bold;">
            ВІДНОВИТИ ДОСТУП
          </a>
          <p style="margin-top: 30px; font-size: 12px; color: #666;">Якщо ви не робили цього запиту, проігноруйте цей лист.</p>
        </div>
      `
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reset TOTP Error:', error);
    return NextResponse.json({ error: 'Failed to request reset' }, { status: 500 });
  }
}
