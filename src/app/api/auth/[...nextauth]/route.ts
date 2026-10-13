import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }),
  ],
  session: {
    strategy: "jwt", // Use JWT to easily handle session locally
  },
  callbacks: {
    async session({ session, token }) {
      if (!token?.sub) {
        return null as any;
      }

      // Verify that user still exists in the database
      const dbUser = await prisma.user.findUnique({
        where: { id: token.sub },
        select: { id: true, totpEnabled: true }
      });

      // If user was deleted from database (e.g. database was cleared), kill the session
      if (!dbUser) {
        return null as any;
      }

      if (session.user) {
        (session.user as any).id = dbUser.id;
        (session.user as any).totpEnabled = dbUser.totpEnabled;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      if (token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { id: true, totpEnabled: true }
        });

        // If user no longer exists in DB, wipe the token so middleware ejects the user
        if (!dbUser) {
          return {};
        }

        token.totpEnabled = dbUser.totpEnabled;
      }
      return token;
    }
  },
  pages: {
    signIn: '/auth/signin',
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
