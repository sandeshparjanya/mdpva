'use client'

import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../../../components/Sidebar'
import AddMemberModal from '../../../components/AddMemberModal'
import { 
  PlusIcon,
  UsersIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { Member } from '../../../lib/memberUtils'
import { createClient } from '../../../lib/supabase'

export default function MembersPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  // Pagination
  const [page, setPage] = useState(1)
  const pageSize = 20
  const [total, setTotal] = useState(0)

  // Stats
  const [totalMembers, setTotalMembers] = useState(0)
  const [activeMembers, setActiveMembers] = useState(0)
  const [inactiveMembers, setInactiveMembers] = useState(0)
  const [newThisMonth, setNewThisMonth] = useState(0)

  // Quick Peek state
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [isPeekOpen, setIsPeekOpen] = useState(false)

  const handleAddMember = (newMember: Member) => {
    setMembers(prev => [newMember, ...prev])
    console.log('Member added successfully:', newMember)
    // Refresh list and stats to reflect authoritative data
    setPage(1)
    void fetchMembers(1, searchQuery)
    void fetchStats()
  }

  function openPeek(member: Member) {
    setSelectedMember(member)
    setIsPeekOpen(true)
  }

  function closePeek() {
    setIsPeekOpen(false)
    // don't clear selected to allow closing animation; clear after short delay if needed
    setTimeout(() => setSelectedMember(null), 200)
  }

  // Close peek on Escape key
  useEffect(() => {
    if (!isPeekOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closePeek()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isPeekOpen])

  async function handleDelete(member: Member) {
    const who = `${member.first_name} ${member.last_name} (${member.member_id})`
    const confirmed = window.confirm(`Delete member ${who}? This action cannot be undone.`)
    if (!confirmed) return

    try {
      setLoading(true)
      const { error: delError } = await supabase
        .from('members')
        .delete()
        .eq('member_id', member.member_id)

      if (delError) throw delError

      // Refresh list and stats
      await fetchMembers(page, searchQuery)
      await fetchStats()
      closePeek()
    } catch (err) {
      console.error('Failed to delete member', err)
      setError('Failed to delete member. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Debug modal state
  console.log('Modal state:', { isAddModalOpen })

  const supabase = useMemo(() => createClient(), [])

  async function fetchMembers(targetPage: number, query: string) {
    try {
      setLoading(true)
      setError('')
      const from = (targetPage - 1) * pageSize
      const to = from + pageSize - 1

      let request = supabase
        .from('members')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

      const q = query.trim()
      if (q) {
        // Search across name, email, phone
        // Using PostgREST or() filter
        request = request.or(
          `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`
        )
      }

      const { data, error: qError, count } = await request
      if (qError) throw qError
      setMembers((data || []) as Member[])
      setTotal(count || 0)
    } catch (err: any) {
      console.error('Failed to load members', err)
      setError('Failed to load members. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function fetchStats() {
    try {
      // Total members
      const totalReq = supabase
        .from('members')
        .select('id', { count: 'exact', head: true })

      // Active
      const activeReq = supabase
        .from('members')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')

      // Inactive
      const inactiveReq = supabase
        .from('members')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'inactive')

      // New this month
      const now = new Date()
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const newReq = supabase
        .from('members')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', firstOfMonth)

      const [totalRes, activeRes, inactiveRes, newRes] = await Promise.all([
        totalReq,
        activeReq,
        inactiveReq,
        newReq,
      ])

      setTotalMembers(totalRes.count || 0)
      setActiveMembers(activeRes.count || 0)
      setInactiveMembers(inactiveRes.count || 0)
      setNewThisMonth(newRes.count || 0)
    } catch (err) {
      console.error('Failed to load stats', err)
    }
  }

  // Debounce search and refetch on page/search changes
  useEffect(() => {
    const t = setTimeout(() => {
      void fetchMembers(page, searchQuery)
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchQuery])

  // Initial stats
  useEffect(() => {
    void fetchStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
              onChange={(e) => {
                setPage(1)
                setSearchQuery(e.target.value)
              }}
              className="input-field pl-10 w-full"
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        {/* Error Alert */}
        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Total Members</p>
                <p className="text-2xl font-bold text-gray-900">{totalMembers.toLocaleString()}</p>
              </div>
              <UsersIcon className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-2xl font-bold text-green-600">{activeMembers.toLocaleString()}</p>
              </div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">New This Month</p>
                <p className="text-2xl font-bold text-blue-600">{newThisMonth.toLocaleString()}</p>
              </div>
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Inactive</p>
                <p className="text-2xl font-bold text-gray-500">{inactiveMembers.toLocaleString()}</p>
              </div>
              <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Members List / Empty State */}
        {loading ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-600">
            Loading members...
          </div>
        ) : members.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12">
            <div className="text-center">
              <UsersIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">No members found</h3>
              <p className="mt-2 text-sm text-gray-500">
                {searchQuery ? 'Try a different search.' : 'Get started by adding your first member to the MDPVA database.'}
              </p>
              {!searchQuery && (
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
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Member</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {members.map((m) => (
                    <tr
                      key={m.id || m.member_id}
                      className="group hover:bg-gray-50 cursor-pointer"
                      onClick={() => openPeek(m)}
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') openPeek(m) }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-gray-100 overflow-hidden mr-3 flex items-center justify-center">
                            {m.profile_photo_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={m.profile_photo_url} alt={`${m.first_name} ${m.last_name}`} className="h-10 w-10 object-cover" />
                            ) : (
                              <div className="text-sm text-gray-500">{m.first_name.charAt(0)}{m.last_name.charAt(0)}</div>
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{m.first_name} {m.last_name}</div>
                            <div className="text-xs text-gray-500 font-mono">{m.member_id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{m.email}</div>
                        <div className="text-sm text-gray-500">{m.phone}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{m.city}</div>
                        <div className="text-sm text-gray-500">{m.state}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          m.status === 'active' ? 'bg-green-100 text-green-800' :
                          m.status === 'inactive' ? 'bg-gray-100 text-gray-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {m.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {m.created_at ? new Date(m.created_at).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="inline-flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            className="text-blue-600 hover:text-blue-800 inline-flex items-center text-sm"
                            onClick={(e) => { e.stopPropagation(); /* TODO: implement edit */ alert('Edit member: Coming soon') }}
                            title="Edit"
                          >
                            <PencilSquareIcon className="w-5 h-5 mr-1" /> Edit
                          </button>
                          <button
                            className="text-red-600 hover:text-red-800 inline-flex items-center text-sm"
                            onClick={(e) => { e.stopPropagation(); handleDelete(m) }}
                            title="Delete"
                          >
                            <TrashIcon className="w-5 h-5 mr-1" /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-3 flex items-center justify-between border-t bg-gray-50">
              <div className="text-sm text-gray-600">Total: {total.toLocaleString()}</div>
              <div className="flex items-center space-x-3">
                <button
                  className="btn-secondary"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </button>
                <div className="text-sm text-gray-700">Page {page} of {Math.max(1, Math.ceil(total / pageSize))}</div>
                <button
                  className="btn-secondary"
                  onClick={() => setPage(p => (p < Math.ceil(total / pageSize) ? p + 1 : p))}
                  disabled={page >= Math.ceil(total / pageSize)}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Member Modal */}
        <AddMemberModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={handleAddMember}
        />

        {/* Quick Side Peek Panel */}
        {selectedMember && (
          <div className={`fixed inset-0 z-[900] ${isPeekOpen ? '' : 'pointer-events-none'}`} aria-hidden={!isPeekOpen}>
            {/* Overlay */}
            <div
              className={`absolute inset-0 bg-black transition-opacity ${isPeekOpen ? 'bg-opacity-30' : 'bg-opacity-0'}`}
              onClick={closePeek}
            />
            {/* Panel */}
            <div
              className={`absolute right-0 top-0 h-full w-full sm:w-[420px] bg-white shadow-xl border-l transition-transform duration-300 ${isPeekOpen ? 'translate-x-0' : 'translate-x-full'}`}
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <div className="text-sm text-gray-500">Member</div>
                  <div className="text-lg font-semibold text-gray-900">{selectedMember.first_name} {selectedMember.last_name}</div>
                  <div className="text-xs text-gray-500 font-mono">{selectedMember.member_id}</div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    className="btn-secondary !py-1 !px-2 inline-flex items-center"
                    onClick={() => alert('Edit member: Coming soon')}
                  >
                    <PencilSquareIcon className="w-4 h-4 mr-1" /> Edit
                  </button>
                  <button
                    className="btn-danger !py-1 !px-2 inline-flex items-center"
                    onClick={() => handleDelete(selectedMember)}
                  >
                    <TrashIcon className="w-4 h-4 mr-1" /> Delete
                  </button>
                  <button className="p-2 hover:bg-gray-100 rounded" onClick={closePeek} aria-label="Close">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-4 overflow-y-auto h-[calc(100%-56px)]">
                {/* Avatar */}
                <div className="flex items-center space-x-3">
                  <div className="h-14 w-14 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center">
                    {selectedMember.profile_photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={selectedMember.profile_photo_url} alt={`${selectedMember.first_name} ${selectedMember.last_name}`} className="h-14 w-14 object-cover" />
                    ) : (
                      <div className="text-base text-gray-500">
                        {selectedMember.first_name.charAt(0)}{selectedMember.last_name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Status</div>
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      selectedMember.status === 'active' ? 'bg-green-100 text-green-800' :
                      selectedMember.status === 'inactive' ? 'bg-gray-100 text-gray-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {selectedMember.status}
                    </span>
                  </div>
                </div>

                {/* Contact */}
                <div className="grid grid-cols-1 gap-2">
                  <div>
                    <div className="text-xs text-gray-500">Email</div>
                    <div className="text-sm text-gray-900 break-all">{selectedMember.email}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Phone</div>
                    <div className="text-sm text-gray-900">{selectedMember.phone}</div>
                  </div>
                </div>

                {/* Profession */}
                <div>
                  <div className="text-xs text-gray-500">Profession</div>
                  <div className="text-sm text-gray-900 capitalize">{selectedMember.profession}</div>
                </div>

                {/* Business */}
                {selectedMember.business_name && (
                  <div>
                    <div className="text-xs text-gray-500">Business</div>
                    <div className="text-sm text-gray-900">{selectedMember.business_name}</div>
                  </div>
                )}

                {/* Address */}
                <div>
                  <div className="text-xs text-gray-500">Address</div>
                  <div className="text-sm text-gray-900">
                    {selectedMember.address_line1}
                    {selectedMember.address_line2 ? (<><br />{selectedMember.address_line2}</>) : null}
                    <br />{selectedMember.city}, {selectedMember.state} {selectedMember.pincode}
                  </div>
                </div>

                {/* Notes */}
                {selectedMember.notes && (
                  <div>
                    <div className="text-xs text-gray-500">Notes</div>
                    <div className="text-sm text-gray-900 whitespace-pre-wrap">{selectedMember.notes}</div>
                  </div>
                )}

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-500">Created</div>
                    <div className="text-sm text-gray-900">{selectedMember.created_at ? new Date(selectedMember.created_at).toLocaleString() : '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Updated</div>
                    <div className="text-sm text-gray-900">{selectedMember.updated_at ? new Date(selectedMember.updated_at).toLocaleString() : '-'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Sidebar>
  )
}
