import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as any).id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '10', 10)));
    const query = (searchParams.get('query') || '').trim();
    const filter = (searchParams.get('filter') || 'all').toLowerCase();
    const sortBy = searchParams.get('sortBy') || 'date_desc';

    const skip = (page - 1) * limit;

    // Base conditions
    const andConditions: any[] = [
      { userId },
      { status: { not: 'DELETED' } }
    ];

    // Search query filter
    if (query) {
      andConditions.push({
        OR: [
          { senderEmail: { contains: query } },
          { subject: { contains: query } },
          { textBody: { contains: query } }
        ]
      });
    }

    // Threat / Verification Status filter
    if (filter === 'pending') {
      andConditions.push({ status: 'PENDING' });
    } else if (filter === 'analyzed') {
      andConditions.push({ status: 'ANALYZED' });
    } else if (filter === 'safe') {
      andConditions.push({
        status: 'ANALYZED',
        OR: [
          { oracleLabel: 'safe' },
          { AND: [{ oracleLabel: null }, { oracleScore: { lte: 0.35 } }] }
        ]
      });
    } else if (filter === 'spam') {
      andConditions.push({
        status: 'ANALYZED',
        oracleLabel: 'spam'
      });
    } else if (filter === 'phishing') {
      andConditions.push({
        status: 'ANALYZED',
        OR: [
          { oracleLabel: 'phishing' },
          { AND: [{ oracleLabel: null }, { oracleScore: { gt: 0.6 } }] }
        ]
      });
    }

    // Sorting
    let orderBy: any = { createdAt: 'desc' };
    if (sortBy === 'date_asc') {
      orderBy = { createdAt: 'asc' };
    } else if (sortBy === 'risk_desc') {
      orderBy = { oracleScore: 'desc' };
    } else if (sortBy === 'risk_asc') {
      orderBy = { oracleScore: 'asc' };
    }

    const whereClause = { AND: andConditions };

    // Common filter for category counts (without threat filters, but including user + search query)
    const baseCountConditions: any[] = [
      { userId },
      { status: { not: 'DELETED' } }
    ];
    if (query) {
      baseCountConditions.push({
        OR: [
          { senderEmail: { contains: query } },
          { subject: { contains: query } },
          { textBody: { contains: query } }
        ]
      });
    }
    const baseWhere = { AND: baseCountConditions };

    // Fetch filtered emails, filtered total, and category counts in parallel
    const [emails, total, countAll, countSafe, countPhishing, countSpam, countPending] = await Promise.all([
      prisma.scannedEmail.findMany({
        where: whereClause,
        orderBy,
        skip,
        take: limit
      }),
      prisma.scannedEmail.count({
        where: whereClause
      }),
      prisma.scannedEmail.count({
        where: baseWhere
      }),
      prisma.scannedEmail.count({
        where: {
          AND: [
            ...baseCountConditions,
            { status: 'ANALYZED' },
            {
              OR: [
                { oracleLabel: 'safe' },
                { AND: [{ oracleLabel: null }, { oracleScore: { lte: 0.35 } }] }
              ]
            }
          ]
        }
      }),
      prisma.scannedEmail.count({
        where: {
          AND: [
            ...baseCountConditions,
            { status: 'ANALYZED' },
            {
              OR: [
                { oracleLabel: 'phishing' },
                { AND: [{ oracleLabel: null }, { oracleScore: { gt: 0.6 } }] }
              ]
            }
          ]
        }
      }),
      prisma.scannedEmail.count({
        where: {
          AND: [
            ...baseCountConditions,
            { status: 'ANALYZED' },
            { oracleLabel: 'spam' }
          ]
        }
      }),
      prisma.scannedEmail.count({
        where: {
          AND: [
            ...baseCountConditions,
            { status: 'PENDING' }
          ]
        }
      })
    ]);

    return NextResponse.json({ 
      success: true, 
      emails,
      systemEmail: process.env.SMTP_USER || process.env.NEXT_PUBLIC_SYSTEM_EMAIL || 'inflayce777@gmail.com',
      pagination: {
        total,
        pages: Math.ceil(total / limit) || 1,
        page,
        limit
      },
      counts: {
        all: countAll,
        safe: countSafe,
        phishing: countPhishing,
        spam: countSpam,
        pending: countPending
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Fetch Inbox Error:', error);
    return NextResponse.json({ error: 'Failed to fetch emails' }, { status: 500 });
  }
}
