'use client'

import Link from 'next/link'
import { Menu } from '@headlessui/react'
import { UserIcon, CogIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'
import { createClient } from '../lib/supabase'

interface ProfileMenuProps {
  className?: string
}

export default function ProfileMenu({ className = '' }: ProfileMenuProps) {
  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <Menu as="div" className={`relative inline-block text-left ${className}`}>
      <Menu.Button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 dark:focus-visible:ring-blue-400/60 transition-colors" aria-label="Account menu">
        <UserIcon className="w-6 h-6 text-gray-700 dark:text-gray-200" />
      </Menu.Button>
      <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg focus:outline-none z-50">
        <div className="py-1">
          <Menu.Item>
            {({ active }) => (
              <Link
                href="/dashboard/profile"
                className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${active ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-200'}`}
              >
                <UserIcon className="w-4 h-4" /> Profile
              </Link>
            )}
          </Menu.Item>
          <Menu.Item>
            {({ active }) => (
              <Link
                href="/dashboard/settings"
                className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${active ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-200'}`}
              >
                <CogIcon className="w-4 h-4" /> Settings
              </Link>
            )}
          </Menu.Item>
          <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
          <Menu.Item>
            {({ active }) => (
              <button
                onClick={handleLogout}
                className={`w-full text-left flex items-center gap-2 px-4 py-2 text-sm transition-colors ${active ? 'bg-gray-100 dark:bg-gray-700 text-red-500' : 'text-red-600 dark:text-red-400'}`}
              >
                <ArrowRightOnRectangleIcon className="w-4 h-4" /> Logout
              </button>
            )}
          </Menu.Item>
        </div>
      </Menu.Items>
    </Menu>
  )
}
