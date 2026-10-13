import type { Metadata } from 'next';
import { Manrope, Fira_Code } from 'next/font/google';
import '@/assets/styles/global.scss';

const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin', 'cyrillic'],
});

const firaCode = Fira_Code({
  variable: '--font-fira',
  subsets: ['latin', 'cyrillic'],
});

import { AuthProvider } from '../components/AuthProvider';

export const metadata: Metadata = {
  title: 'Phishing Detector XAI',
  description: 'AI-powered phishing detection and psychological analysis',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="uk"
      className={`${manrope.variable} ${firaCode.variable} font-sans h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
