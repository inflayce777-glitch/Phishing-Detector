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
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const query = searchParams.get('query') || '';

    const skip = (page - 1) * limit;

    const whereClause: any = {
      userId,
      status: { not: 'DELETED' }
    };

    if (query) {
      whereClause.OR = [
        { sender: { contains: query, mode: 'insensitive' } },
        { subject: { contains: query, mode: 'insensitive' } }
      ];
    }

    const [emails, total] = await Promise.all([
      prisma.scannedEmail.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.scannedEmail.count({
        where: whereClause
      })
    ]);

    return NextResponse.json({ 
      success: true, 
      emails,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        page,
        limit
      }
    });
  } catch (error) {
    console.error('Fetch Inbox Error:', error);
    return NextResponse.json({ error: 'Failed to fetch emails' }, { status: 500 });
  }
}
