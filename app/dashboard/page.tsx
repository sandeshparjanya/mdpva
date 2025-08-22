'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { User } from '@supabase/supabase-js'
import Sidebar from '../../components/Sidebar'

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    
    // Get current user
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
      
      // Redirect to login if not authenticated
      if (!user) {
        window.location.href = '/'
      }
    }

    getUser()
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <Sidebar>
      {/* Top Header Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-600">Overview of MDPVA member management</p>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-700">
              Welcome, {user?.email}
            </span>
            <button
              onClick={handleLogout}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Welcome to MDPVA Admin Dashboard
          </h2>
          <p className="text-gray-600">
            You are successfully logged in as an administrator. This is a basic dashboard that will be expanded with member management features.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Total Members */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-blue-900 mb-1">Total Members</h3>
                <p className="text-3xl font-bold text-blue-600">1,300+</p>
                <p className="text-sm text-blue-700 mt-1">Active photographers & videographers</p>
              </div>
            </div>
          </div>

          {/* Pending Requests */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-yellow-900 mb-1">Pending Requests</h3>
                <p className="text-3xl font-bold text-yellow-600">0</p>
                <p className="text-sm text-yellow-700 mt-1">New member applications</p>
              </div>
            </div>
          </div>

          {/* System Status */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-green-900 mb-1">System Status</h3>
                <p className="text-2xl font-bold text-green-600">✓ Online</p>
                <p className="text-sm text-green-700 mt-1">All systems operational</p>
              </div>
            </div>
          </div>
        </div>

        {/* Coming Soon Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Coming Soon</h3>
          <ul className="space-y-2 text-gray-600">
            <li>• Member management and search</li>
            <li>• Join request approval workflow</li>
            <li>• Email notifications</li>
            <li>• Audit logs and reporting</li>
          </ul>
        </div>
      </div>
    </Sidebar>
  )
}
