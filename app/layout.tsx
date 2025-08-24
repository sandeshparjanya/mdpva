import type { Metadata } from 'next'
import './globals.css'

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
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <main className="flex-1">
          {children}
        </main>
        <footer className="py-4 text-center text-gray-500 text-sm">
          <div>© MDPVA</div>
          <div>Developed by - Mindsfire Pvt Ltd.</div>
        </footer>
      </body>
    </html>
  )
}
