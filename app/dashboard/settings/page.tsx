'use client'

import Sidebar from '../../../components/Sidebar'
import ProfileMenu from '../../../components/ProfileMenu'

export default function SettingsPage() {
  return (
    <Sidebar>
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex justify-between items-start">
          <div>
            <nav className="flex text-sm text-gray-500 mb-2">
              <span>Dashboard</span>
              <span className="mx-2">/</span>
              <span className="text-gray-900 font-medium">Settings</span>
            </nav>
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="text-sm text-gray-600 mt-1">Coming soon</p>
          </div>
          <div className="flex items-center">
            <ProfileMenu className="hidden lg:inline-block" />
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-600">
          This section is under construction. Please check back later.
        </div>
      </div>
    </Sidebar>
  )
}
