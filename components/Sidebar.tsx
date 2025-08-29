'use client'

import { useEffect, useRef, useState } from 'react'
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
  ChevronDownIcon,
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
  const [adminOpen, setAdminOpen] = useState(true)
  const [commOpen, setCommOpen] = useState(true)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // Persist collapsed state across sessions
  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = localStorage.getItem('mdpva:sidebarCollapsed')
    if (saved === 'true') {
      setIsCollapsed(true)
    }
    const adminSaved = localStorage.getItem('mdpva:sidebar:section:admin')
    if (adminSaved === 'false') setAdminOpen(false)
    const commSaved = localStorage.getItem('mdpva:sidebar:section:comm')
    if (commSaved === 'false') setCommOpen(false)
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const toggleCollapsed = () => {
    setIsCollapsed(prev => {
      const next = !prev
      if (typeof window !== 'undefined') {
        localStorage.setItem('mdpva:sidebarCollapsed', String(next))
      }
      return next
    })
  }

  const toggleAdminOpen = () => {
    setAdminOpen(prev => {
      const next = !prev
      if (typeof window !== 'undefined') {
        localStorage.setItem('mdpva:sidebar:section:admin', String(next))
      }
      return next
    })
  }

  const toggleCommOpen = () => {
    setCommOpen(prev => {
      const next = !prev
      if (typeof window !== 'undefined') {
        localStorage.setItem('mdpva:sidebar:section:comm', String(next))
      }
      return next
    })
  }

  // Mobile drawer a11y: ESC to close and focus management
  useEffect(() => {
    if (!isMobileOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileOpen(false)
        setTimeout(() => menuButtonRef.current?.focus(), 0)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    const t = setTimeout(() => closeButtonRef.current?.focus(), 0)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      clearTimeout(t)
    }
  }, [isMobileOpen])

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

  const SidebarContent = ({ showHeader = true }: { showHeader?: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Logo/Header */}
      {showHeader && (
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          {!isCollapsed && (
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">MDPVA Admin</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Member Management</p>
            </div>
          )}
          <div className="hidden lg:flex items-center gap-2">
            <button
              onClick={toggleCollapsed}
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {isCollapsed ? (
                <ChevronRightIcon className="w-5 h-5" />
              ) : (
                <ChevronLeftIcon className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-6" aria-label="Sidebar">
        {/* Administration Section */}
        <div>
          {!isCollapsed && (
            <button onClick={toggleAdminOpen} className="w-full flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              <span>Administration</span>
              <ChevronDownIcon className={`w-4 h-4 transition-transform ${adminOpen ? '' : '-rotate-90'}`} />
            </button>
          )}
          <ul className={`space-y-1 ${adminOpen ? '' : 'hidden'}`}>
            {administrationItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <li key={item.name} className="relative">
                  <Link
                    href={item.href}
                    title={isCollapsed ? item.name : undefined}
                    aria-current={isActive ? 'page' : undefined}
                    className={`group relative flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors border-l-2 ${
                      isActive
                        ? 'bg-primary-50 text-primary-700 border-primary-600 dark:bg-primary-900/30 dark:text-primary-200'
                        : 'text-gray-700 hover:bg-gray-100 border-transparent dark:text-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    {!isCollapsed && <span className="ml-3">{item.name}</span>}
                    {isCollapsed && (
                      <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded-md bg-gray-900 text-white text-xs py-1 px-2 shadow-lg opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 z-40 dark:bg-gray-700">
                        {item.name}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Communication Section */}
        <div>
          {!isCollapsed && (
            <button onClick={toggleCommOpen} className="w-full flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              <span>Communication</span>
              <ChevronDownIcon className={`w-4 h-4 transition-transform ${commOpen ? '' : '-rotate-90'}`} />
            </button>
          )}
          <ul className={`space-y-1 ${commOpen ? '' : 'hidden'}`}>
            {communicationItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <li key={item.name} className="relative">
                  <Link
                    href={item.href}
                    title={isCollapsed ? item.name : undefined}
                    aria-current={isActive ? 'page' : undefined}
                    className={`group relative flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors border-l-2 ${
                      isActive
                        ? 'bg-primary-50 text-primary-700 border-primary-600 dark:bg-primary-900/30 dark:text-primary-200'
                        : 'text-gray-700 hover:bg-gray-100 border-transparent dark:text-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    {!isCollapsed && <span className="ml-3">{item.name}</span>}
                    {isCollapsed && (
                      <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded-md bg-gray-900 text-white text-xs py-1 px-2 shadow-lg opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 z-40 dark:bg-gray-700">
                        {item.name}
                      </span>
                    )}
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
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile sidebar overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => { setIsMobileOpen(false); setTimeout(() => menuButtonRef.current?.focus(), 0) }} />
          <div className="fixed left-0 top-0 bottom-0 w-64 bg-white dark:bg-gray-800 shadow-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">MDPVA Admin</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">Member Management</p>
              </div>
              <button
                ref={closeButtonRef}
                onClick={() => { setIsMobileOpen(false); setTimeout(() => menuButtonRef.current?.focus(), 0) }}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto">
              <SidebarContent showHeader={false} />
            </div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className={`hidden lg:flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}>
        <SidebarContent />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Top bar for mobile */}
        <div className="lg:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              ref={menuButtonRef}
              onClick={() => setIsMobileOpen(true)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Bars3Icon className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">MDPVA Admin</h1>
            </div>
            <div className="flex items-center gap-2">
              <Menu as="div" className="relative inline-block text-left">
                <Menu.Button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Account menu">
                  <UserIcon className="w-6 h-6 text-gray-700 dark:text-gray-200" />
                </Menu.Button>
                <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg focus:outline-none z-50">
                  <div className="py-1">
                    <Menu.Item>
                      {({ active }) => (
                        <Link
                          href="/dashboard/profile"
                          className={`flex items-center gap-2 px-4 py-2 text-sm ${active ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-200'}`}
                        >
                          <UserIcon className="w-4 h-4" /> Profile
                        </Link>
                      )}
                    </Menu.Item>
                    <Menu.Item>
                      {({ active }) => (
                        <Link
                          href="/dashboard/settings"
                          className={`flex items-center gap-2 px-4 py-2 text-sm ${active ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-200'}`}
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
                          className={`w-full text-left flex items-center gap-2 px-4 py-2 text-sm ${active ? 'bg-gray-100 dark:bg-gray-700 text-red-500' : 'text-red-600 dark:text-red-400'}`}
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
