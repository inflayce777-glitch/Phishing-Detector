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
  title: 'Семантичний аналіз загроз',
  description: 'Автоматизована експертиза кіберзагроз та соціальної інженерії',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' }
    ],
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="uk"
      className={`${manrope.variable} ${firaCode.variable} font-sans h-full antialiased`}
    >
      <body className="h-full flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
