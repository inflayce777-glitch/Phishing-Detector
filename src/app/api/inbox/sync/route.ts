import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';

export async function POST() {
  let connection: any = null;
  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as any).id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = session.user?.email;
    const userId = (session.user as any).id;
    if (!userEmail) return NextResponse.json({ error: 'No email found' }, { status: 400 });

    const config = {
      imap: {
        user: process.env.SMTP_USER as string,
        password: process.env.SMTP_PASS as string,
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 10000
      }
    };

    connection = await imaps.connect(config);
    await connection.openBox('INBOX');

    // Визначаємо точний час реєстрації акаунта користувача (декодуємо з CUID ID користувача)
    let userRegistrationDate: Date | null = null;
    if (userId && typeof userId === 'string' && userId.startsWith('c') && userId.length >= 9) {
      try {
        const ts = parseInt(userId.slice(1, 9), 36);
        if (!isNaN(ts) && ts > 1600000000000) {
          userRegistrationDate = new Date(ts);
        }
      } catch (e) {
        console.error('Error decoding user registration timestamp:', e);
      }
    }

    // Search for emails sent FROM the currently logged-in user
    // (This means the user forwarded an email to our platform)
    const searchCriteria: any[] = [['FROM', userEmail]];
    if (userRegistrationDate) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const imapDate = `${userRegistrationDate.getDate()}-${months[userRegistrationDate.getMonth()]}-${userRegistrationDate.getFullYear()}`;
      searchCriteria.push(['SINCE', imapDate]);
    }

    const fetchOptions = {
      bodies: ['HEADER', 'TEXT', ''],
      markSeen: false,
      struct: true
    };

    const results = await connection.search(searchCriteria, fetchOptions);

    let syncedCount = 0;

    for (const item of results) {
      const all = item.parts.find((p: any) => p.which === '');
      if (!all) continue;

      const mail = await simpleParser(all.body);

      // Ігноруємо листи, які були надіслані до моменту створення облікового запису на нашому сайті
      if (userRegistrationDate && mail.date && new Date(mail.date) < userRegistrationDate) {
        continue;
      }
      
      const messageId = mail.messageId || String(item.attributes.uid);
      const subject = mail.subject || 'Без теми';
      const textBody = mail.text || mail.html || '';
      
      let originalSender = userEmail; // fallback
      let cleanTextBody = textBody;

      // 1. Generic structural split for forwarded messages (e.g. ---------- Forwarded message ---------)
      // Some clients use 10 dashes, some 9, some 5. We check for at least 5 dashes.
      const forwardSplit = textBody.split(/[-]{5,}.*?[-]{5,}\r?\n/);
      
      if (forwardSplit.length > 1) {
        // The forwarded content is the second part
        const forwardedContent = forwardSplit.slice(1).join('\n'); // join in case of multiple splits
        
        // 2. Generic email extraction: the original sender is usually the first email address found
        const emailRegex = /<([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>/;
        const plainEmailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
        
        const emailMatch = forwardedContent.match(emailRegex) || forwardedContent.match(plainEmailRegex);
        if (emailMatch && emailMatch[1]) {
          // If we matched the fallback userEmail again (e.g. in To: field), try to find another one
          if (emailMatch[1] !== userEmail) {
            originalSender = emailMatch[1];
          } else {
            // Find all emails and pick the first one that is not the user's email
            const allEmails = Array.from(forwardedContent.matchAll(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g)).map(m => m[1]);
            const firstForeign = allEmails.find(e => e !== userEmail);
            if (firstForeign) originalSender = firstForeign;
          }
        }

        // Ми не обрізаємо жодних заголовків
      }
      
      // Завжди зберігаємо повний сирий код повідомлення (MIME/RFC822) 
      // замість відредагованого `mail.text`. Це дозволить нашому парсеру
      // отримувати оригінальні IP та Base64.
      cleanTextBody = all.body;

      // Check if this messageId is already in the DB
      const existing = await prisma.scannedEmail.findUnique({
        where: { messageId }
      });

      if (!existing) {
        await prisma.scannedEmail.create({
          data: {
            messageId,
            userId,
            senderEmail: originalSender,
            subject,
            textBody: cleanTextBody,
            status: 'PENDING'
          }
        });
        syncedCount++;
      }
    }

    return NextResponse.json({ success: true, synced: syncedCount });
  } catch (error) {
    console.error('IMAP Sync Error:', error);
    return NextResponse.json({ error: 'Failed to sync emails' }, { status: 500 });
  } finally {
    if (connection) {
      try {
        connection.end();
      } catch (endErr) {
        console.error('Error closing IMAP connection:', endErr);
      }
    }
  }
}
