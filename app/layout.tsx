import type { Metadata, Viewport } from 'next';
import './v1.css';
import './extra.css';
import { ToastProvider } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Zetheta Daily Muster',
  description: 'Attendance, daily work and HR records for the Zetheta team.',
  icons: { icon: '/logo.png' },
  manifest: '/manifest.webmanifest',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#175F7F' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600;700&display=swap" />
      </head>
      <body>
        <div className="bgfx" aria-hidden="true"><i /><i /><i /></div>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
