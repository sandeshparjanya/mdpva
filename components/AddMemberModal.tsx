'use client'

import { useState, useRef, useEffect } from 'react'
import { 
  XMarkIcon, 
  PhotoIcon,
  ExclamationTriangleIcon 
} from '@heroicons/react/24/outline'
import { 
  generateMemberID, 
  validatePincode, 
  checkEmailExists, 
  checkPhoneExists, 
  uploadProfilePhoto,
  Member 
} from '../lib/memberUtils'
import { createClient } from '../lib/supabase'

interface AddMemberModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (member: Member) => void
  mode?: 'add' | 'edit'
  initialMember?: Member
}

export default function AddMemberModal({ isOpen, onClose, onSuccess, mode = 'add', initialMember }: AddMemberModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [memberID, setMemberID] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [availableAreas, setAvailableAreas] = useState<string[]>([])
  const allowedBloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
  const toDateInputValue = (v?: string | null) => {
    if (!v) return ''
    // If already in YYYY-MM-DD, return as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
    const d = new Date(v)
    if (isNaN(d.getTime())) return ''
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  // Form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    profession: 'photographer' as 'photographer' | 'videographer' | 'both',
    businessName: '',
    addressLine1: '',
    addressLine2: '',
    pincode: '',
    city: '',
    state: '',
    area: '',
    notes: '',
    status: 'active',
    dob: '',
    bloodGroup: ''
  })

  // Initialize when modal opens
  useEffect(() => {
    if (!isOpen) return
    if (mode === 'add') {
      if (!memberID) {
        console.log('AddMemberModal(add): opening, generating member ID')
        generateMemberID().then(setMemberID)
      }
      // Reset form for add
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        profession: 'photographer',
        businessName: '',
        addressLine1: '',
        addressLine2: '',
        pincode: '',
        city: '',
        state: '',
        area: '',
        notes: '',
        status: 'active',
        dob: '',
        bloodGroup: ''
      })
      setProfilePhoto(null)
      setPhotoPreview('')
      setErrors({})
      setAvailableAreas([])
    } else if (mode === 'edit' && initialMember) {
      // Prefill form for edit
      setMemberID(initialMember.member_id)
      setFormData({
        firstName: initialMember.first_name || '',
        lastName: initialMember.last_name || '',
        email: initialMember.email || '',
        phone: initialMember.phone || '',
        profession: initialMember.profession || 'photographer',
        businessName: initialMember.business_name || '',
        addressLine1: initialMember.address_line1 || '',
        addressLine2: initialMember.address_line2 || '',
        pincode: initialMember.pincode || '',
        city: initialMember.city || '',
        state: initialMember.state || '',
        area: initialMember.area || '',
        notes: initialMember.notes || '',
        status: initialMember.status || 'active',
        dob: toDateInputValue(initialMember.dob ?? null),
        bloodGroup: initialMember.blood_group || ''
      })
      setProfilePhoto(null)
      setPhotoPreview(initialMember.profile_photo_url || '')
      setErrors({})
      // Preload areas for current pincode
      if (initialMember.pincode) {
        validatePincode(initialMember.pincode).then(res => {
          if (res.isValid) {
            setAvailableAreas(res.areas || [])
          } else {
            setAvailableAreas([])
          }
        }).catch(() => setAvailableAreas([]))
      } else {
        setAvailableAreas([])
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode, initialMember?.member_id])

  // Handle form field changes
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  // Handle pincode validation
  const handlePincodeChange = async (pincode: string) => {
    handleInputChange('pincode', pincode)
    
    if (pincode.length === 6) {
      const result = await validatePincode(pincode)
      if (result.isValid && result.city && result.state) {
        setFormData(prev => ({
          ...prev,
          city: result.city!,
          state: result.state!
        }))
        setErrors(prev => ({ ...prev, pincode: '' }))
        const areas = result.areas || []
        setAvailableAreas(areas)
        setFormData(prev => ({
          ...prev,
          area: (prev.area && areas.includes(prev.area)) ? prev.area : (areas.length === 1 ? areas[0] : '')
        }))
      } else {
        setErrors(prev => ({ ...prev, pincode: result.error || 'Invalid pincode' }))
        setAvailableAreas([])
        setFormData(prev => ({ ...prev, area: '' }))
      }
    } else if (pincode.length < 6) {
      // Reset autofilled fields to avoid stale values
      setFormData(prev => ({
        ...prev,
        city: '',
        state: '',
        area: ''
      }))
      setAvailableAreas([])
      if (pincode.length > 0) {
        setErrors(prev => ({ ...prev, pincode: 'Pincode must be exactly 6 digits' }))
      } else {
        setErrors(prev => ({ ...prev, pincode: '' }))
      }
    }
  }

  // Handle photo selection
  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Validate file
      if (!file.type.startsWith('image/')) {
        setErrors(prev => ({ ...prev, photo: 'Please select an image file' }))
        return
      }
      if (file.size > 2 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, photo: 'Image must be less than 2MB' }))
        return
      }

      setProfilePhoto(file)
      setErrors(prev => ({ ...prev, photo: '' }))
      
      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => setPhotoPreview(e.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  // Validate form
  const validateForm = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {}

    // Required fields
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required'
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required'
    if (!formData.email.trim()) newErrors.email = 'Email is required'
    if (!formData.phone.trim()) newErrors.phone = 'Phone is required'
    if (!formData.addressLine1.trim()) newErrors.addressLine1 = 'Address is required'
    if (!formData.pincode.trim()) newErrors.pincode = 'Pincode is required'
    if (availableAreas.length > 0 && !formData.area) newErrors.area = 'Please select an area'

    // Email validation
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    // Phone validation (basic)
    if (formData.phone && !/^[\d\s\-\+\(\)]{10,15}$/.test(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number'
    }

    // DOB validation (optional, must be valid date and not in the future)
    if (formData.dob) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(formData.dob)) {
        newErrors.dob = 'Please enter DOB in YYYY-MM-DD format'
      } else {
        const d = new Date(formData.dob + 'T00:00:00')
        if (isNaN(d.getTime())) {
          newErrors.dob = 'Invalid date'
        } else {
          const today = new Date()
          today.setHours(0,0,0,0)
          if (d > today) newErrors.dob = 'DOB cannot be in the future'
        }
      }
    }

    // Blood group validation (optional)
    if (formData.bloodGroup) {
      const bg = formData.bloodGroup.toUpperCase()
      if (!allowedBloodGroups.includes(bg)) {
        newErrors.bloodGroup = 'Invalid blood group'
      }
    }

    // Check duplicates (skip if unchanged in edit mode)
    if (formData.email && !newErrors.email) {
      const changed = mode === 'edit' && initialMember ? (formData.email.toLowerCase().trim() !== initialMember.email.toLowerCase()) : true
      if (changed) {
        const emailExists = await checkEmailExists(formData.email)
        if (emailExists) {
          newErrors.email = 'This email is already registered'
        }
      }
    }

    if (formData.phone && !newErrors.phone) {
      const normalized = formData.phone.replace(/[\s\-\(\)]/g, '')
      const changed = mode === 'edit' && initialMember ? (normalized !== initialMember.phone) : true
      if (changed) {
        const phoneExists = await checkPhoneExists(formData.phone)
        if (phoneExists) {
          newErrors.phone = 'This phone number is already registered'
        }
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Validate form
      const isValid = await validateForm()
      if (!isValid) {
        setIsLoading(false)
        return
      }
      const supabase = createClient()

      if (mode === 'add') {
        // Photo optional: upload only if provided
        let photoUrl: string | null = null
        if (profilePhoto) {
          const photoResult = await uploadProfilePhoto(profilePhoto, memberID)
          if (!photoResult.success) {
            setErrors({ photo: photoResult.error || 'Failed to upload photo' })
            setIsLoading(false)
            return
          }
          photoUrl = photoResult.url || null
        }

        // Create member record
        const memberData = {
          member_id: memberID,
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          email: formData.email.toLowerCase().trim(),
          phone: formData.phone.replace(/[\s\-\(\)]/g, ''),
          profession: formData.profession,
          business_name: formData.businessName.trim() || null,
          address_line1: formData.addressLine1.trim(),
          address_line2: formData.addressLine2.trim() || null,
          pincode: formData.pincode.trim(),
          city: formData.city.trim(),
          area: formData.area.trim() || null,
          state: formData.state.trim(),
          profile_photo_url: photoUrl,
          notes: formData.notes.trim() || null,
          dob: formData.dob ? formData.dob : null,
          blood_group: formData.bloodGroup ? formData.bloodGroup.toUpperCase() : null,
          status: (formData.status === 'inactive' ? 'inactive' : 'active')
        }

        const { data, error } = await supabase
          .from('members')
          .insert([memberData])
          .select()
          .single()

        if (error) {
          console.error('Error creating member:', error)
          // Map unique constraint violations to field-level errors when possible
          const newErrors: Record<string, string> = {}
          const msg = (error as any)?.message || ''
          const code = (error as any)?.code || ''
          if (code === '23505' || /duplicate key value/i.test(msg)) {
            if (/email/i.test(msg)) newErrors.email = 'This email is already registered'
            if (/phone/i.test(msg)) newErrors.phone = 'This phone number is already registered'
            if (Object.keys(newErrors).length === 0) newErrors.general = 'Duplicate value detected'
          } else {
            newErrors.general = 'Failed to create member. Please try again.'
          }
          setErrors(newErrors)
          setIsLoading(false)
          return
        }

        // Success
        onSuccess(data)
        onClose()

        // Reset form
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          profession: 'photographer',
          businessName: '',
          addressLine1: '',
          addressLine2: '',
          pincode: '',
          city: '',
          state: '',
          area: '',
          notes: '',
          status: 'active',
          dob: '',
          bloodGroup: ''
        })
        setProfilePhoto(null)
        setPhotoPreview('')
        setMemberID('')
        setErrors({})
      } else if (mode === 'edit' && initialMember) {
        // Upload photo only if changed; otherwise keep existing (null when absent)
        let photoUrl: string | null = initialMember.profile_photo_url ?? null
        if (profilePhoto) {
          const photoResult = await uploadProfilePhoto(profilePhoto, initialMember.member_id)
          if (!photoResult.success) {
            setErrors({ photo: photoResult.error || 'Failed to upload photo' })
            setIsLoading(false)
            return
          }
          photoUrl = photoResult.url || photoUrl
        }

        const updateData = {
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          email: formData.email.toLowerCase().trim(),
          phone: formData.phone.replace(/[\s\-\(\)]/g, ''),
          profession: formData.profession,
          business_name: formData.businessName.trim() || null,
          address_line1: formData.addressLine1.trim(),
          address_line2: formData.addressLine2?.trim() ? formData.addressLine2.trim() : null,
          pincode: formData.pincode.trim(),
          city: formData.city.trim(),
          area: formData.area.trim() || null,
          state: formData.state.trim(),
          profile_photo_url: photoUrl,
          notes: formData.notes.trim() || null,
          status: (formData.status === 'inactive' ? 'inactive' : 'active'),
          dob: formData.dob ? formData.dob : null,
          blood_group: formData.bloodGroup ? formData.bloodGroup.toUpperCase() : null,
          updated_at: new Date().toISOString()
        }

        const { data, error } = await supabase
          .from('members')
          .update(updateData)
          .eq('member_id', initialMember.member_id)
          .is('deleted_at', null)
          .select()
          .single()

        if (error) {
          console.error('Error updating member:', error)
          const newErrors: Record<string, string> = {}
          const msg = (error as any)?.message || ''
          const code = (error as any)?.code || ''
          if (code === '23505' || /duplicate key value/i.test(msg)) {
            if (/email/i.test(msg)) newErrors.email = 'This email is already registered'
            if (/phone/i.test(msg)) newErrors.phone = 'This phone number is already registered'
            if (Object.keys(newErrors).length === 0) newErrors.general = 'Duplicate value detected'
          } else {
            newErrors.general = 'Failed to update member. Please try again.'
          }
          setErrors(newErrors)
          setIsLoading(false)
          return
        }

        onSuccess(data)
        onClose()
      }
    } catch (error) {
      console.error('Error:', error)
      setErrors({ general: 'Something went wrong. Please try again.' })
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[1000]">
      <div className="flex min-h-screen md:items-center md:justify-center md:p-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
        
        <div className="relative bg-white dark:bg-gray-900 w-full h-[100dvh] md:h-auto md:max-w-2xl md:rounded-lg md:shadow-xl md:my-8 flex flex-col">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b dark:border-gray-700 header-safe px-4 py-4 md:static md:px-6 md:py-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{mode === 'edit' ? 'Edit Member' : 'Add New Member'}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                Member ID: <span className="font-mono text-primary-600">{mode === 'edit' && initialMember ? initialMember.member_id : memberID}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>
          </div>

          {/* Form */}
          <form id="addMemberForm" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
            {/* General Error */}
            {errors.general && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-center">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-500 dark:text-red-400 mr-2" />
                <span className="text-sm text-red-700 dark:text-red-300">{errors.general}</span>
              </div>
            )}

            {/* Profile Photo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Profile Photo (optional)
              </label>
              <div className="flex items-center space-x-4">
                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center overflow-hidden">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <PhotoIcon className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                  )}
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-secondary"
                  >
                    {mode === 'edit' ? 'Change Photo' : 'Choose Photo'}
                  </button>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">JPG, PNG up to 2MB</p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
              />
              {errors.photo && <p className="text-sm text-red-600 mt-1">{errors.photo}</p>}
            </div>

            {/* Name Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  className={`input-field dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 ${errors.firstName ? 'border-red-300' : ''}`}
                  placeholder="Enter first name"
                />
                {errors.firstName && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.firstName}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  className={`input-field dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 ${errors.lastName ? 'border-red-300' : ''}`}
                  placeholder="Enter last name"
                />
                {errors.lastName && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.lastName}</p>}
              </div>
            </div>

            {/* Contact Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className={`input-field dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 ${errors.email ? 'border-red-300' : ''}`}
                  placeholder="Enter email address"
                />
                {errors.email && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.email}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Phone *
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className={`input-field dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 ${errors.phone ? 'border-red-300' : ''}`}
                  placeholder="Enter phone number"
                />
                {errors.phone && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.phone}</p>}
              </div>
            </div>

            {/* DOB & Blood Group */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={formData.dob}
                  onChange={(e) => handleInputChange('dob', e.target.value)}
                  className={`input-field dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 ${errors.dob ? 'border-red-300' : ''}`}
                />
                {errors.dob && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.dob}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Blood Group
                </label>
                <select
                  value={formData.bloodGroup}
                  onChange={(e) => handleInputChange('bloodGroup', e.target.value)}
                  className={`input-field dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 ${errors.bloodGroup ? 'border-red-300' : ''}`}
                >
                  <option value="">Select blood group (optional)</option>
                  {allowedBloodGroups.map(bg => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
                {errors.bloodGroup && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.bloodGroup}</p>}
              </div>
            </div>

            {/* Profession & Business Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Profession *
                </label>
                <select
                  value={formData.profession}
                  onChange={(e) => handleInputChange('profession', e.target.value)}
                  className="input-field dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                >
                  <option value="photographer">Photographer</option>
                  <option value="videographer">Videographer</option>
                  <option value="both">Both</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Business Name
                </label>
                <input
                  type="text"
                  value={formData.businessName}
                  onChange={(e) => handleInputChange('businessName', e.target.value)}
                  className="input-field dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                  placeholder="Enter business name (optional)"
                />
              </div>
            </div>

            {/* Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Status *
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  className="input-field dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            {/* Address Fields */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Address Line 1 *
              </label>
              <input
                type="text"
                value={formData.addressLine1}
                onChange={(e) => handleInputChange('addressLine1', e.target.value)}
                className={`input-field dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 ${errors.addressLine1 ? 'border-red-300' : ''}`}
                placeholder="Enter address line 1"
              />
              {errors.addressLine1 && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.addressLine1}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Address Line 2
              </label>
              <input
                type="text"
                value={formData.addressLine2}
                onChange={(e) => handleInputChange('addressLine2', e.target.value)}
                className="input-field dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                placeholder="Enter address line 2 (optional)"
              />
            </div>

            {/* Pincode, Area, City, State */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Pincode *
                </label>
                <input
                  type="text"
                  value={formData.pincode}
                  onChange={(e) => handlePincodeChange(e.target.value)}
                  className={`input-field dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 ${errors.pincode ? 'border-red-300' : ''}`}
                  placeholder="Enter pincode"
                  maxLength={6}
                />
                {errors.pincode && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.pincode}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Area {availableAreas.length > 0 ? '*' : '(not available for this PIN)'}
                </label>
                {availableAreas.length > 0 ? (
                  <>
                    <select
                      value={formData.area}
                      onChange={(e) => handleInputChange('area', e.target.value)}
                      className={`input-field dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 ${errors.area ? 'border-red-300' : ''}`}
                    >
                      <option value="">Select area</option>
                      {availableAreas.map((a) => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                    {errors.area && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.area}</p>}
                  </>
                ) : (
                  <input
                    type="text"
                    value=""
                    readOnly
                    className="input-field bg-gray-50 dark:bg-gray-800 dark:text-gray-200"
                    placeholder="Not available for this PIN"
                  />
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={formData.city}
                  readOnly
                  className="input-field bg-gray-50 dark:bg-gray-800 dark:text-gray-200"
                  placeholder="Auto-filled"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  State
                </label>
                <input
                  type="text"
                  value={formData.state}
                  readOnly
                  className="input-field bg-gray-50 dark:bg-gray-800 dark:text-gray-200"
                  placeholder="Auto-filled"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                className="input-field dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                rows={3}
                placeholder="Add any additional notes (optional)"
              />
            </div>

          </form>

          {/* Actions */}
          <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t dark:border-gray-700 footer-safe px-4 py-3 md:px-6 md:py-4 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="addMemberForm"
              className="btn-primary"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  {mode === 'edit' ? 'Saving Changes...' : 'Creating Member...'}
                </div>
              ) : (
                (mode === 'edit' ? 'Save Changes' : 'Create Member')
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
