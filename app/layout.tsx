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
      <body>{children}</body>
    </html>
  )
}
