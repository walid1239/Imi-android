import type { Metadata, Viewport } from 'next';
import { PwaRegister } from '@/components/pwa-register';
import './globals.css';

export const metadata: Metadata = {
  title: 'IMI — تواصل وتعلّم',
  description: 'IMI منصة اجتماعية وتعليمية عربية للمحادثات والحالات ومقاطع الفيديو والتعلّم.',
  openGraph: { title: 'IMI — تواصل وتعلّم', description: 'مساحة عربية تجمع التواصل والتعلّم.', siteName: 'IMI', locale: 'ar_MA', type: 'website' },
  twitter: { card: 'summary', title: 'IMI — تواصل وتعلّم', description: 'منصة اجتماعية وتعليمية عربية.' },
  applicationName: 'IMI',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icons/imi.svg' },
};

export const viewport: Viewport = {
  themeColor: '#080b14',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
