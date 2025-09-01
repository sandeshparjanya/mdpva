import type { Metadata } from 'next'
import './globals.css'
import Footer from '../components/Footer'

export const metadata: Metadata = {
  title: 'MDPVA - Mysore District Photographer and Videographers Association',
  description: 'Admin portal for MDPVA member management',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => { try {
  const k = 'mdpva:theme';
  // Keep the root sign-in page always light and ignore theme preference
  if (window.location && window.location.pathname === '/') {
    document.documentElement.classList.remove('dark');
    return;
  }
  const saved = localStorage.getItem(k) || 'system';
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = saved === 'system' ? prefersDark : saved === 'dark';
  document.documentElement.classList.toggle('dark', isDark);
} catch (_) {} })();`,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col">
        <main className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
