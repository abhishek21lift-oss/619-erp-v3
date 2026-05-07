import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/lib/auth-context';
import { ToastProvider } from '@/lib/toast';
import CommandPalette from '@/components/CommandPalette';
import ErrorBoundary from '@/components/ErrorBoundary';
import './globals.css';

export const metadata: Metadata = {
  title: '619 FITNESS STUDIO — Operating System',
  description:
    '619 FITNESS STUDIO — Train heavy. Run light. The classy operating system for serious gyms.',
  icons: { icon: '/logo.PNG' },
  // appleWebApp moved out of meta tags so Next can add the right markup.
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent' },
};

// Next 14+ wants viewport / theme-color / color-scheme out of <meta> and into
// this dedicated export. The runtime warning (and the React 19 "viewport
// metadata moved" deprecation) goes away once this is here.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff',
  colorScheme: 'light',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/*
         * ErrorBoundary is outermost so a throw from AuthProvider's
         * effect (e.g. a stale localStorage payload that fails JSON.parse)
         * still renders the fallback instead of a blank page.
         */}
        <ErrorBoundary>
          <AuthProvider>
            <ToastProvider>
              {children}
              <CommandPalette />
            </ToastProvider>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
