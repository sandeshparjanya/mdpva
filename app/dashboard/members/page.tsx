'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Sidebar from '../../../components/Sidebar'
import AddMemberModal from '../../../components/AddMemberModal'
import { 
  PlusIcon,
  UsersIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  DocumentDuplicateIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'
import { ChevronRightIcon } from '@heroicons/react/20/solid'
import Image from 'next/image'
import { Member } from '../../../lib/memberUtils'
import { createClient } from '../../../lib/supabase'

export default function MembersPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Member | null>(null)

  // Pagination
  const [page, setPage] = useState(1)
  const pageSize = 20
  const [total, setTotal] = useState(0)

  // Stats
  const [totalMembers, setTotalMembers] = useState(0)
  const [activeMembers, setActiveMembers] = useState(0)
  const [inactiveMembers, setInactiveMembers] = useState(0)
  const [newThisMonth, setNewThisMonth] = useState(0)

  // Quick filter (applied by clicking stat cards)
  const [quickFilter, setQuickFilter] = useState<'all' | 'active' | 'inactive' | 'newThisMonth'>('all')
  // Transient highlight for stat cards
  const [flashCard, setFlashCard] = useState<'all' | 'active' | 'inactive' | 'newThisMonth' | null>(null)

  // Sort state (global, applies to current list)
  type SortKey = 'created_desc' | 'created_asc' | 'name_asc' | 'name_desc' | 'updated_desc' | 'id_desc' | 'id_asc'
  const [sortBy, setSortBy] = useState<SortKey>('created_desc')

  // Quick Peek state
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [isPeekOpen, setIsPeekOpen] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<Member | null>(null)
  // Copy feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const copyTimeoutRef = useRef<number | null>(null)
  const flashTimerRef = useRef<number | null>(null)
  // Export UI state
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [exportBanner, setExportBanner] = useState<string>('')
  const exportBannerRef = useRef<number | null>(null)
  const [hoveredExportType, setHoveredExportType] = useState<'csv' | 'pdf' | null>(null)

  // Cleanup copy timeout on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current)
      }
      if (flashTimerRef.current) {
        window.clearTimeout(flashTimerRef.current)
      }
      if (exportBannerRef.current) {
        window.clearTimeout(exportBannerRef.current)
      }
    }
  }, [])

  // Load saved sort from localStorage (if any)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('membersSortBy') as SortKey | null
      if (saved) setSortBy(saved)
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist sort choice
  useEffect(() => {
    try { localStorage.setItem('membersSortBy', sortBy) } catch {}
  }, [sortBy])

  const handleAddMember = (newMember: Member) => {
    setMembers(prev => [newMember, ...prev])
    console.log('Member added successfully:', newMember)
    // Refresh list and stats to reflect authoritative data
    setPage(1)
    void fetchMembers(1, searchQuery)
    void fetchStats()
  }

  const handleEditSuccess = (updated: Member) => {
    // Optimistically update list
    setMembers(prev => prev.map(m => (m.member_id === updated.member_id ? updated : m)))
    // Update peek panel if it is showing the same member
    setSelectedMember(prev => (prev && prev.member_id === updated.member_id ? updated : prev))
    // Refresh authoritative data
    void fetchMembers(page, searchQuery)
    void fetchStats()
  }

  function openEdit(member: Member) {
    setEditTarget(member)
    setIsEditModalOpen(true)
  }

  // Hover actions overlay rendered within the hovered cell (no sticky actions column)
  function RowActions({ member }: { member: Member }) {
    return (
      <div className="absolute top-1/2 -translate-y-1/2 right-3 flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
        <button
          className="text-blue-600 hover:text-blue-800 inline-flex items-center text-sm bg-white/90 rounded px-2 py-1 pointer-events-auto"
          onClick={(e) => { e.stopPropagation(); openEdit(member) }}
          title="Edit"
        >
          <PencilSquareIcon className="w-4 h-4 mr-1" /> Edit
        </button>
        <button
          type="button"
          className="text-red-600 hover:text-red-800 inline-flex items-center text-sm bg-white/90 rounded px-2 py-1 disabled:opacity-50 pointer-events-auto"
          onClick={(e) => { e.stopPropagation(); setConfirmTarget(member) }}
          disabled={loading}
          title="Delete"
        >
          <TrashIcon className="w-4 h-4 mr-1" /> Delete
        </button>
      </div>
    )
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
    
    try {
      console.log('Delete attempt for:', who)
      // Close confirm modal if open and proceed
      setConfirmTarget(null)
      setLoading(true)
      console.log('Starting soft delete for member_id:', member.member_id)
      
      // Soft delete: set deleted_at timestamp
      const { data, error: delError } = await supabase
        .from('members')
        .update({ deleted_at: new Date().toISOString() })
        .eq('member_id', member.member_id)
        .select()

      console.log('Delete result:', { data, error: delError })

      if (delError) throw delError

      console.log('Delete successful, refreshing data...')
      // Refresh list and stats
      await fetchMembers(page, searchQuery)
      await fetchStats()
      closePeek()
      console.log('Data refresh complete')
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

  // Handle stat card click: set filter and show a brief highlight
  function handleStatClick(type: 'all' | 'active' | 'inactive' | 'newThisMonth') {
    setQuickFilter(type)
    setPage(1)
    setFlashCard(type)
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current)
    flashTimerRef.current = window.setTimeout(() => setFlashCard(null), 800)
  }

  function handleSortChange(next: SortKey) {
    setSortBy(next)
    setPage(1)
  }

  function notifyExport(message: string) {
    setExportBanner(message)
    if (exportBannerRef.current) window.clearTimeout(exportBannerRef.current)
    exportBannerRef.current = window.setTimeout(() => setExportBanner(''), 2000)
  }

  function handleExport(scope: 'current' | 'all', format: 'csv' | 'pdf') {
    try {
      setExportMenuOpen(false)
      const params = new URLSearchParams()
      params.set('scope', scope)
      params.set('format', format)
      params.set('columns', 'default')
      if (scope === 'current') {
        params.set('q', searchQuery)
        params.set('filter', quickFilter)
        params.set('sort', sortBy)
      }
      const url = `/api/members/export?${params.toString()}`
      // Prefer opening in new tab to not block UI
      const w = window.open(url, '_blank')
      if (!w) {
        // Fallback if popup blocked
        window.location.href = url
      }
      notifyExport('Export started…')
    } catch (e) {
      console.error('Export failed to start', e)
      notifyExport('Failed to start export')
    }
  }

  async function fetchMembers(targetPage: number, query: string) {
    try {
      setLoading(true)
      setError('')
      const from = (targetPage - 1) * pageSize
      const to = from + pageSize - 1

      let request = supabase
        .from('members')
        .select('*', { count: 'exact' })
        .is('deleted_at', null)  // Only get non-deleted members
        .range(from, to)

      const q = query.trim()
      if (q) {
        const upper = q.toUpperCase()
        if (/^MDPVA/i.test(q)) {
          // Treat any 'MDPVA' query as a prefix search on member_id
          request = request.ilike('member_id', `${upper}%`)
        } else {
          // General fuzzy search across fields including member_id
          request = request.or(
            `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,member_id.ilike.%${q}%`
          )
        }
      }

      // Apply quick filter from stat cards
      if (quickFilter === 'active') {
        request = request.eq('status', 'active')
      } else if (quickFilter === 'inactive') {
        request = request.eq('status', 'inactive')
      } else if (quickFilter === 'newThisMonth') {
        const now = new Date()
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        request = request.gte('created_at', firstOfMonth)
      }

      // Apply sort
      switch (sortBy) {
        case 'created_asc':
          request = request.order('created_at', { ascending: true }).order('member_id', { ascending: true })
          break
        case 'name_asc':
          request = request
            .order('last_name', { ascending: true, nullsFirst: true })
            .order('first_name', { ascending: true, nullsFirst: true })
          break
        case 'name_desc':
          request = request
            .order('last_name', { ascending: false, nullsFirst: false })
            .order('first_name', { ascending: false, nullsFirst: false })
          break
        case 'updated_desc':
          request = request.order('updated_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })
          break
        case 'id_asc':
          request = request.order('member_id', { ascending: true })
          break
        case 'id_desc':
          request = request.order('member_id', { ascending: false })
          break
        case 'created_desc':
        default:
          request = request.order('created_at', { ascending: false }).order('member_id', { ascending: false })
          break
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
      // Total members (non-deleted)
      const totalReq = supabase
        .from('members')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null)

      // Active
      const activeReq = supabase
        .from('members')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .is('deleted_at', null)

      // Inactive
      const inactiveReq = supabase
        .from('members')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'inactive')
        .is('deleted_at', null)

      // New this month
      const now = new Date()
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const newReq = supabase
        .from('members')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', firstOfMonth)
        .is('deleted_at', null)

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
  }, [page, searchQuery, quickFilter, sortBy])

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
            <div className="relative">
              <button 
                className="btn-secondary"
                onClick={() => setExportMenuOpen(o => !o)}
                aria-haspopup="menu"
                aria-expanded={exportMenuOpen}
              >
                Export
              </button>
              {exportMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-30 py-1"
                  onMouseLeave={() => setHoveredExportType(null)}
                >
                  {/* CSV submenu trigger */}
                  <div className="relative group">
                    <button
                      className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50"
                      onMouseEnter={() => setHoveredExportType('csv')}
                      onFocus={() => setHoveredExportType('csv')}
                      aria-haspopup="menu"
                      aria-expanded={hoveredExportType === 'csv'}
                    >
                      <span>Export as CSV</span>
                      <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                    </button>
                    {hoveredExportType === 'csv' && (
                      <div className="absolute top-0 right-full mr-1 w-64 max-h-[70vh] overflow-auto bg-white border border-gray-200 rounded-md shadow-lg z-40 py-1">
                        <button
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                          onClick={() => handleExport('current', 'csv')}
                        >
                          Export current view (CSV)
                        </button>
                        <button
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                          onClick={() => handleExport('all', 'csv')}
                        >
                          Export all members (CSV)
                        </button>
                      </div>
                    )}
                  </div>

                  {/* PDF submenu trigger */}
                  <div className="relative group">
                    <button
                      className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50"
                      onMouseEnter={() => setHoveredExportType('pdf')}
                      onFocus={() => setHoveredExportType('pdf')}
                      aria-haspopup="menu"
                      aria-expanded={hoveredExportType === 'pdf'}
                    >
                      <span>Export as PDF</span>
                      <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                    </button>
                    {hoveredExportType === 'pdf' && (
                      <div className="absolute top-0 right-full mr-1 w-72 max-h-[70vh] overflow-auto bg-white border border-gray-200 rounded-md shadow-lg z-40 py-1">
                        <button
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                          onClick={() => handleExport('current', 'pdf')}
                        >
                          Export current view (PDF with photos)
                        </button>
                        <button
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                          onClick={() => handleExport('all', 'pdf')}
                        >
                          Export all members (PDF with photos)
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
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

        {/* Search + Sort Bar */}
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative sm:max-w-md w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search members by name, email, phone, or ID..."
              value={searchQuery}
              onChange={(e) => {
                setPage(1)
                setSearchQuery(e.target.value)
              }}
              className="input-field pl-10 w-full"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="sortBy" className="text-sm text-gray-600 whitespace-nowrap">Sort by</label>
            <select
              id="sortBy"
              className="input-field pr-10 min-w-[220px]"
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value as SortKey)}
            >
              <option value="created_desc">Newest first</option>
              <option value="created_asc">Oldest first</option>
              <option value="name_asc">Name A–Z</option>
              <option value="name_desc">Name Z–A</option>
              <option value="updated_desc">Recently updated</option>
              <option value="id_desc">Member ID high → low</option>
              <option value="id_asc">Member ID low → high</option>
            </select>
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

        {/* Export banner */}
        {exportBanner && (
          <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
            {exportBanner}
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div
            className={`bg-white rounded-lg border p-4 ${flashCard === 'all' ? 'ring-2 ring-blue-500 border-blue-300' : 'border-gray-200 hover:shadow-md cursor-pointer'}`}
            onClick={() => handleStatClick('all')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') { handleStatClick('all') } }}
          >
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Total Members</p>
                <p className="text-2xl font-bold text-gray-900">{totalMembers.toLocaleString()}</p>
              </div>
              <UsersIcon className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          
          <div
            className={`bg-white rounded-lg border p-4 ${flashCard === 'active' ? 'ring-2 ring-blue-500 border-blue-300' : 'border-gray-200 hover:shadow-md cursor-pointer'}`}
            onClick={() => handleStatClick('active')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') { handleStatClick('active') } }}
          >
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-2xl font-bold text-green-600">{activeMembers.toLocaleString()}</p>
              </div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
          </div>
          
          <div
            className={`bg-white rounded-lg border p-4 ${flashCard === 'newThisMonth' ? 'ring-2 ring-blue-500 border-blue-300' : 'border-gray-200 hover:shadow-md cursor-pointer'}`}
            onClick={() => handleStatClick('newThisMonth')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') { handleStatClick('newThisMonth') } }}
          >
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">New This Month</p>
                <p className="text-2xl font-bold text-blue-600">{newThisMonth.toLocaleString()}</p>
              </div>
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            </div>
          </div>
          
          <div
            className={`bg-white rounded-lg border p-4 ${flashCard === 'inactive' ? 'ring-2 ring-blue-500 border-blue-300' : 'border-gray-200 hover:shadow-md cursor-pointer'}`}
            onClick={() => handleStatClick('inactive')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') { handleStatClick('inactive') } }}
          >
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Inactive</p>
                <p className="text-2xl font-bold text-gray-500">{inactiveMembers.toLocaleString()}</p>
              </div>
              <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Active Quick Filter Indicator */}
        {quickFilter !== 'all' && (
          <div className="mb-4">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 mr-2">
              Filter: {quickFilter === 'newThisMonth' ? 'New This Month' : quickFilter.charAt(0).toUpperCase() + quickFilter.slice(1)}
            </span>
            <button
              className="text-sm text-blue-600 hover:underline"
              onClick={() => { setQuickFilter('all'); setPage(1) }}
            >
              Clear
            </button>
          </div>
        )}

        {/* Sort indicator (only when not default) */}
        {sortBy !== 'created_desc' && (
          <div className="mb-4 -mt-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200 mr-2">
              Sort: {
                sortBy === 'created_asc' ? 'Oldest first' :
                sortBy === 'name_asc' ? 'Name A–Z' :
                sortBy === 'name_desc' ? 'Name Z–A' :
                sortBy === 'updated_desc' ? 'Recently updated' :
                sortBy === 'id_asc' ? 'Member ID low → high' :
                'Member ID high → low'
              }
            </span>
          </div>
        )}

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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Profession</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {members.map((m) => (
                    <tr
                      key={m.id || m.member_id}
                      className="relative group hover:bg-gray-50 cursor-pointer"
                      onClick={() => openPeek(m)}
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') openPeek(m) }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-md bg-gray-100 overflow-hidden mr-3 flex items-center justify-center">
                            {m.profile_photo_url ? (
                              <Image
                                src={m.profile_photo_url}
                                alt={`${m.first_name} ${m.last_name}`}
                                width={40}
                                height={40}
                                className="h-10 w-10 object-cover"
                              />
                            ) : (
                              <div className="text-sm text-gray-500">{m.first_name.charAt(0)}{m.last_name.charAt(0)}</div>
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{m.first_name} {m.last_name}</div>
                            <div className="text-xs text-gray-500 font-mono flex items-center gap-1">
                              <span>{m.member_id}</span>
                              <button
                                type="button"
                                className={`transition-opacity hover:text-gray-700 ${copiedId === m.member_id ? 'opacity-100 text-green-600' : 'opacity-0 group-hover:opacity-100'}`}
                                title={copiedId === m.member_id ? 'Copied!' : 'Copy member ID'}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const id = m.member_id
                                  const doCopy = async () => {
                                    try {
                                      await navigator.clipboard?.writeText(id)
                                    } catch (_) {
                                      // Fallback copy method
                                      const ta = document.createElement('textarea')
                                      ta.value = id
                                      document.body.appendChild(ta)
                                      ta.select()
                                      try { document.execCommand('copy') } finally { document.body.removeChild(ta) }
                                    }
                                    setCopiedId(id)
                                    if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current)
                                    copyTimeoutRef.current = window.setTimeout(() => setCopiedId(null), 1500)
                                  }
                                  void doCopy()
                                }}
                              >
                                {copiedId === m.member_id ? (
                                  <CheckCircleIcon className="w-4 h-4" aria-hidden="true" />
                                ) : (
                                  <DocumentDuplicateIcon className="w-4 h-4" aria-hidden="true" />
                                )}
                                <span className="sr-only">{copiedId === m.member_id ? 'Copied' : 'Copy member ID'}</span>
                              </button>
                            </div>
                          </div>

                          <RowActions member={m} />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="relative">
                          <div className="text-sm text-gray-900 capitalize">{m.profession}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="relative">
                          <div className="text-sm text-gray-900">{m.email}</div>
                          <div className="text-sm text-gray-500">{m.phone}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="relative">
                          <div className="text-sm text-gray-900">{m.area || m.city}</div>
                          <div className="text-sm text-gray-500">{m.area ? `${m.city}, ${m.state}` : m.state}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="relative">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            m.status === 'active' ? 'bg-green-100 text-green-800' :
                            m.status === 'inactive' ? 'bg-gray-100 text-gray-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {m.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="relative">
                          {m.created_at ? new Date(m.created_at).toLocaleDateString() : '-'}
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

        {/* Edit Member Modal */}
        <AddMemberModal
          isOpen={isEditModalOpen}
          onClose={() => { setIsEditModalOpen(false); setEditTarget(null) }}
          onSuccess={handleEditSuccess}
          mode="edit"
          initialMember={editTarget || undefined}
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
                    onClick={() => selectedMember && openEdit(selectedMember)}
                  >
                    <PencilSquareIcon className="w-4 h-4 mr-1" /> Edit
                  </button>
                  <button
                    type="button"
                    className="btn-danger !py-1 !px-2 inline-flex items-center disabled:opacity-50"
                    onClick={() => selectedMember && setConfirmTarget(selectedMember)}
                    disabled={loading}
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
                  <div className="h-14 w-14 rounded-md bg-gray-100 overflow-hidden flex items-center justify-center">
                    {selectedMember.profile_photo_url ? (
                      <Image
                        src={selectedMember.profile_photo_url}
                        alt={`${selectedMember.first_name} ${selectedMember.last_name}`}
                        width={56}
                        height={56}
                        className="h-14 w-14 object-contain"
                      />
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
                    {selectedMember.area ? (<><br />{selectedMember.area}</>) : null}
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

        {/* Confirm Delete Modal */}
        {confirmTarget && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center">
            <div className="absolute inset-0 bg-black bg-opacity-30" onClick={() => setConfirmTarget(null)} />
            <div
              className="relative bg-white rounded-lg shadow-xl border w-full max-w-md mx-4 p-6"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete member</h3>
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to delete{' '}
                <span className="font-medium text-gray-900">
                  {confirmTarget.first_name} {confirmTarget.last_name} ({confirmTarget.member_id})
                </span>
                ? This is a soft delete and can be undone later.
              </p>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setConfirmTarget(null)}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => handleDelete(confirmTarget)}
                  disabled={loading}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Sidebar>
  )
}
