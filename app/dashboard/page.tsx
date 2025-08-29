'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { User } from '@supabase/supabase-js'
import Sidebar from '../../components/Sidebar'
import ProfileMenu from '../../components/ProfileMenu'

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [totalMembers, setTotalMembers] = useState<number | null>(null)

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

  // Load total members (excluding soft-deleted)
  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    const load = async () => {
      const { count, error } = await supabase
        .from('members')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null)
      if (error) {
        console.error('Failed to load total members', error)
        return
      }
      setTotalMembers(count ?? 0)
    }
    void load()
  }, [user])

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
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300">Overview of MDPVA member management</p>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-700 dark:text-gray-200">
              Welcome, {user?.email}
            </span>
            <ProfileMenu className="hidden lg:inline-block" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Welcome to MDPVA Admin Dashboard
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            You are successfully logged in as an administrator. This is a basic dashboard that will be expanded with member management features.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Total Members */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-1">Total Members</h3>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-300">{totalMembers === null ? '—' : totalMembers.toLocaleString()}</p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">Active photographers & videographers</p>
              </div>
            </div>
          </div>

          {/* Pending Requests */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-1">Pending Requests</h3>
                <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-300">0</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">New member applications</p>
              </div>
            </div>
          </div>

          {/* System Status */}
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-1">System Status</h3>
                <p className="text-2xl font-bold text-green-600 dark:text-green-300">✓ Online</p>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">All systems operational</p>
              </div>
            </div>
          </div>
        </div>

        {/* Coming Soon Section */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Coming Soon</h3>
          <ul className="space-y-2 text-gray-600 dark:text-gray-300">
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
