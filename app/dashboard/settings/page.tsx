'use client'

import Sidebar from '../../../components/Sidebar'
import ProfileMenu from '../../../components/ProfileMenu'
import ThemeSwitcher from '../../../components/ThemeSwitcher'

export default function SettingsPage() {
  return (
    <Sidebar>
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex justify-between items-start">
          <div>
            <nav className="flex text-sm text-gray-500 dark:text-gray-400 mb-2">
              <span>Dashboard</span>
              <span className="mx-2">/</span>
              <span className="text-gray-900 dark:text-gray-100 font-medium">Settings</span>
            </nav>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Manage your preferences</p>
          </div>
          <div className="flex items-center">
            <ProfileMenu className="hidden lg:inline-block" />
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid gap-6 max-w-3xl">
          <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Appearance</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Choose your theme preference.</p>
            <div className="mt-4">
              <ThemeSwitcher variant="minimal" />
            </div>
          </section>
        </div>
      </div>
    </Sidebar>
  )
}
