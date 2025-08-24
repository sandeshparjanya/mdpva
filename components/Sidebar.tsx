'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu } from '@headlessui/react'
import {
  ChartBarIcon,
  UsersIcon,
  DocumentTextIcon,
  UserIcon,
  CogIcon,
  ChatBubbleLeftRightIcon,
  ChartPieIcon,
  ClipboardDocumentListIcon,
  InformationCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline'
import { createClient } from '../lib/supabase'

interface SidebarProps {
  children: React.ReactNode
}

export default function Sidebar({ children }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const pathname = usePathname()
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? null)
    }).catch(() => setUserEmail(null))
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const administrationItems = [
    { name: 'Dashboard', href: '/dashboard', icon: ChartBarIcon },
    { name: 'Members', href: '/dashboard/members', icon: UsersIcon },
    { name: 'Applications', href: '/dashboard/applications', icon: DocumentTextIcon },
    { name: 'Profile', href: '/dashboard/profile', icon: UserIcon },
    { name: 'Settings', href: '/dashboard/settings', icon: CogIcon },
  ]

  const communicationItems = [
    { name: 'Communications', href: '/dashboard/communications', icon: ChatBubbleLeftRightIcon },
    { name: 'Reports', href: '/dashboard/reports', icon: ChartPieIcon },
    { name: 'Audit Logs', href: '/dashboard/audit-logs', icon: ClipboardDocumentListIcon },
    { name: 'About', href: '/dashboard/about', icon: InformationCircleIcon },
  ]

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo/Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        {!isCollapsed && (
          <div>
            <h1 className="text-lg font-bold text-gray-900">MDPVA Admin</h1>
            <p className="text-xs text-gray-500">Member Management</p>
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 rounded-lg hover:bg-gray-100 transition-colors hidden lg:block"
        >
          {isCollapsed ? (
            <ChevronRightIcon className="w-5 h-5" />
          ) : (
            <ChevronLeftIcon className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-6">
        {/* Administration Section */}
        <div>
          {!isCollapsed && (
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Administration
            </h3>
          )}
          <ul className="space-y-1">
            {administrationItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    {!isCollapsed && <span className="ml-3">{item.name}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Communication Section */}
        <div>
          {!isCollapsed && (
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Communication
            </h3>
          )}
          <ul className="space-y-1">
            {communicationItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    {!isCollapsed && <span className="ml-3">{item.name}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </nav>
    </div>
  )

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setIsMobileOpen(false)} />
          <div className="fixed left-0 top-0 bottom-0 w-64 bg-white shadow-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h1 className="text-lg font-bold text-gray-900">MDPVA Admin</h1>
                <p className="text-xs text-gray-500">Member Management</p>
              </div>
              <button
                onClick={() => setIsMobileOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto">
              <SidebarContent />
            </div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className={`hidden lg:flex flex-col bg-white border-r border-gray-200 transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}>
        <SidebarContent />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar for mobile */}
        <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              <Bars3Icon className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">MDPVA Admin</h1>
            </div>
            <div>
              <Menu as="div" className="relative inline-block text-left">
                <Menu.Button className="p-2 rounded-lg hover:bg-gray-100" aria-label="Account menu">
                  <UserIcon className="w-6 h-6 text-gray-700" />
                </Menu.Button>
                <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right bg-white border border-gray-200 rounded-lg shadow-lg focus:outline-none z-50">
                  <div className="py-1">
                    <Menu.Item>
                      {({ active }) => (
                        <Link
                          href="/dashboard/profile"
                          className={`flex items-center gap-2 px-4 py-2 text-sm ${active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'}`}
                        >
                          <UserIcon className="w-4 h-4" /> Profile
                        </Link>
                      )}
                    </Menu.Item>
                    <Menu.Item>
                      {({ active }) => (
                        <Link
                          href="/dashboard/settings"
                          className={`flex items-center gap-2 px-4 py-2 text-sm ${active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'}`}
                        >
                          <CogIcon className="w-4 h-4" /> Settings
                        </Link>
                      )}
                    </Menu.Item>
                    <div className="my-1 border-t" />
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={handleLogout}
                          className={`w-full text-left flex items-center gap-2 px-4 py-2 text-sm ${active ? 'bg-gray-100 text-red-700' : 'text-red-600'}`}
                        >
                          <ArrowRightOnRectangleIcon className="w-4 h-4" /> Logout
                        </button>
                      )}
                    </Menu.Item>
                  </div>
                </Menu.Items>
              </Menu>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
