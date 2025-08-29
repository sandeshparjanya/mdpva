'use client'

import { usePathname } from 'next/navigation'

export default function Footer() {
  const pathname = usePathname()
  // Hide global footer on the login page ('/')
  if (pathname === '/') return null

  return (
    <footer className="py-4 footer-safe text-center text-gray-500 dark:text-gray-400 text-sm">
      <div>© MDPVA</div>
      <div>Developed by - Mindsfire Pvt Ltd.</div>
    </footer>
  )
}
