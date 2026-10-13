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
      if (session.user && token.sub) {
        (session.user as any).id = token.sub;
        
        // Fetch custom user data (like TOTP)
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { totpEnabled: true }
        });
        
        if (dbUser) {
           (session.user as any).totpEnabled = dbUser.totpEnabled;
        }
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      // We must fetch totpEnabled for the token on every request or login
      // Because middleware only sees the token, not the session
      if (token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { totpEnabled: true }
        });
        if (dbUser) {
          token.totpEnabled = dbUser.totpEnabled;
        }
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
