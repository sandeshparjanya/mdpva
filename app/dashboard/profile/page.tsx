'use client'

import Sidebar from '../../../components/Sidebar'
import ProfileMenu from '../../../components/ProfileMenu'

export default function ProfilePage() {
  return (
    <Sidebar>
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex justify-between items-start">
          <div>
            <nav className="flex text-sm text-gray-500 dark:text-gray-400 mb-2">
              <span>Dashboard</span>
              <span className="mx-2">/</span>
              <span className="text-gray-900 dark:text-gray-100 font-medium">Profile</span>
            </nav>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Profile</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Coming soon</p>
          </div>
          <div className="flex items-center">
            <ProfileMenu className="hidden lg:inline-block" />
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-600 dark:text-gray-300">
          This section is under construction. Please check back later.
        </div>
      </div>
    </Sidebar>
  )
}
