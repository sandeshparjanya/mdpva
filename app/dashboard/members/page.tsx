'use client'

import { useState } from 'react'
import Sidebar from '../../../components/Sidebar'
import AddMemberModal from '../../../components/AddMemberModal'
import { 
  PlusIcon,
  UsersIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline'
import { Member } from '../../../lib/memberUtils'

export default function MembersPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [members, setMembers] = useState<Member[]>([])

  const handleAddMember = (newMember: Member) => {
    setMembers(prev => [newMember, ...prev])
    console.log('Member added successfully:', newMember)
    // TODO: Refresh member list or update stats
  }

  // Debug modal state
  console.log('Modal state:', { isAddModalOpen })

  return (
    <Sidebar>
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex justify-between items-start">
          <div>
            {/* Breadcrumb */}
            <nav className="flex text-sm text-gray-500 mb-2">
              <span>Dashboard</span>
              <span className="mx-2">/</span>
              <span className="text-gray-900 font-medium">Members</span>
            </nav>
            
            {/* Page Title */}
            <h1 className="text-2xl font-bold text-gray-900">Members</h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage MDPVA photographer and videographer members
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
            <button className="btn-secondary">
              Export
            </button>
            <button 
              onClick={() => {
                console.log('Add Member button clicked')
                setIsAddModalOpen(true)
              }}
              className="btn-primary flex items-center"
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Member
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mt-6">
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search members by name, email, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-10 w-full"
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Total Members</p>
                <p className="text-2xl font-bold text-gray-900">1,300+</p>
              </div>
              <UsersIcon className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-2xl font-bold text-green-600">1,250</p>
              </div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">New This Month</p>
                <p className="text-2xl font-bold text-blue-600">15</p>
              </div>
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Inactive</p>
                <p className="text-2xl font-bold text-gray-500">50</p>
              </div>
              <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Empty State */}
        <div className="bg-white rounded-lg border border-gray-200 p-12">
          <div className="text-center">
            <UsersIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No members found</h3>
            <p className="mt-2 text-sm text-gray-500">
              Get started by adding your first member to the MDPVA database.
            </p>
            <div className="mt-6">
              <button 
                onClick={() => {
                  console.log('Add Your First Member button clicked')
                  setIsAddModalOpen(true)
                }}
                className="btn-primary flex items-center mx-auto"
              >
                <PlusIcon className="w-4 h-4 mr-2" />
                Add Your First Member
              </button>
            </div>
          </div>
        </div>

        {/* Add Member Modal */}
        <AddMemberModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={handleAddMember}
        />
      </div>
    </Sidebar>
  )
}
