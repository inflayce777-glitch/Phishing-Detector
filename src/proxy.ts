import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    
    // If the user has TOTP enabled in DB (we passed it to JWT token), check for the cookie
    if (token?.totpEnabled) {
      const hasVerifiedCookie = req.cookies.has("totp-verified");
      
      // If no cookie and they aren't already on the verify page OR an api route, redirect them
      if (!hasVerifiedCookie && !req.nextUrl.pathname.startsWith('/auth/verify') && !req.nextUrl.pathname.startsWith('/auth/reset-totp') && !req.nextUrl.pathname.startsWith('/api/totp')) {
        return NextResponse.redirect(new URL("/auth/verify", req.url));
      }
    }
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/auth/signin",
    },
  }
);

export const config = {
  matcher: [
    "/((?!auth/signin|api/health|api/auth|api/rdap|api/safebrowsing|api/python-ml|_next/static|_next/image|favicon.ico).*)",
  ],
};
