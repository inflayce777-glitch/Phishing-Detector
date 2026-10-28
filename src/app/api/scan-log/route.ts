import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      threatScore,
      verdictLabel,
      scanType = 'email',
      senderEmail,
      targetUrl,
      subject,
      textSnippet,
      triggers,
      detectedDomains,
      threatSources,
      authSummary,
      hasObfuscation = false
    } = body;

    let userId: string | null = null;
    try {
      const session = await getServerSession();
      if (session?.user?.email) {
        const user = await prisma.user.findUnique({
          where: { email: session.user.email }
        });
        if (user) userId = user.id;
      }
    } catch (e) {
      // Anonymous or no session
    }

    const log = await prisma.scanAuditLog.create({
      data: {
        userId,
        threatScore: Number(threatScore) || 0,
        verdictLabel: String(verdictLabel || 'safe'),
        scanType: String(scanType),
        senderEmail: senderEmail ? String(senderEmail) : null,
        targetUrl: targetUrl ? String(targetUrl) : null,
        subject: subject ? String(subject) : null,
        textSnippet: textSnippet ? String(textSnippet).slice(0, 300) : null,
        triggers: triggers ? JSON.stringify(triggers) : null,
        detectedDomains: detectedDomains ? JSON.stringify(detectedDomains) : null,
        threatSources: threatSources ? JSON.stringify(threatSources) : null,
        authSummary: authSummary ? String(authSummary) : 'NONE',
        hasObfuscation: Boolean(hasObfuscation)
      }
    });

    return NextResponse.json({ success: true, logId: log.id });
  } catch (error: any) {
    console.error('Failed to save scan audit log:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Database error' },
      { status: 500 }
    );
  }
}
