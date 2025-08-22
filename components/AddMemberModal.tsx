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
}

export default function AddMemberModal({ isOpen, onClose, onSuccess }: AddMemberModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [memberID, setMemberID] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    notes: ''
  })

  // Generate Member ID when modal opens
  useEffect(() => {
    if (isOpen && !memberID) {
      console.log('AddMemberModal: opening, generating member ID')
      generateMemberID().then(setMemberID)
    }
  }, [isOpen, memberID])

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
      } else {
        setErrors(prev => ({ ...prev, pincode: result.error || 'Invalid pincode' }))
      }
    } else if (pincode.length < 6) {
      // Reset autofilled fields to avoid stale values
      setFormData(prev => ({
        ...prev,
        city: '',
        state: ''
      }))
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
    if (!profilePhoto) newErrors.photo = 'Profile photo is required'

    // Email validation
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    // Phone validation (basic)
    if (formData.phone && !/^[\d\s\-\+\(\)]{10,15}$/.test(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number'
    }

    // Check duplicates
    if (formData.email && !newErrors.email) {
      const emailExists = await checkEmailExists(formData.email)
      if (emailExists) {
        newErrors.email = 'This email is already registered'
      }
    }

    if (formData.phone && !newErrors.phone) {
      const phoneExists = await checkPhoneExists(formData.phone)
      if (phoneExists) {
        newErrors.phone = 'This phone number is already registered'
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

      // Upload photo first
      const photoResult = await uploadProfilePhoto(profilePhoto!, memberID)
      if (!photoResult.success) {
        setErrors({ photo: photoResult.error || 'Failed to upload photo' })
        setIsLoading(false)
        return
      }

      // Create member record
      const supabase = createClient()
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
        state: formData.state.trim(),
        profile_photo_url: photoResult.url,
        notes: formData.notes.trim() || null,
        status: 'active'
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
        notes: ''
      })
      setProfilePhoto(null)
      setPhotoPreview('')
      setMemberID('')
      setErrors({})
    } catch (error) {
      console.error('Error:', error)
      setErrors({ general: 'Something went wrong. Please try again.' })
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[1000] overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
        
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Add New Member</h2>
              <p className="text-sm text-gray-600 mt-1">
                Member ID: <span className="font-mono text-primary-600">{memberID}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* General Error */}
            {errors.general && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-500 mr-2" />
                <span className="text-sm text-red-700">{errors.general}</span>
              </div>
            )}

            {/* Profile Photo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Profile Photo *
              </label>
              <div className="flex items-center space-x-4">
                <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <PhotoIcon className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-secondary"
                  >
                    Choose Photo
                  </button>
                  <p className="text-xs text-gray-500 mt-1">JPG, PNG up to 2MB</p>
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  className={`input-field ${errors.firstName ? 'border-red-300' : ''}`}
                  placeholder="Enter first name"
                />
                {errors.firstName && <p className="text-sm text-red-600 mt-1">{errors.firstName}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  className={`input-field ${errors.lastName ? 'border-red-300' : ''}`}
                  placeholder="Enter last name"
                />
                {errors.lastName && <p className="text-sm text-red-600 mt-1">{errors.lastName}</p>}
              </div>
            </div>

            {/* Contact Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className={`input-field ${errors.email ? 'border-red-300' : ''}`}
                  placeholder="Enter email address"
                />
                {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone *
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className={`input-field ${errors.phone ? 'border-red-300' : ''}`}
                  placeholder="Enter phone number"
                />
                {errors.phone && <p className="text-sm text-red-600 mt-1">{errors.phone}</p>}
              </div>
            </div>

            {/* Profession & Business Name */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Profession *
                </label>
                <select
                  value={formData.profession}
                  onChange={(e) => handleInputChange('profession', e.target.value)}
                  className="input-field"
                >
                  <option value="photographer">Photographer</option>
                  <option value="videographer">Videographer</option>
                  <option value="both">Both</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Business Name
                </label>
                <input
                  type="text"
                  value={formData.businessName}
                  onChange={(e) => handleInputChange('businessName', e.target.value)}
                  className="input-field"
                  placeholder="Enter business name (optional)"
                />
              </div>
            </div>

            {/* Address Fields */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address Line 1 *
              </label>
              <input
                type="text"
                value={formData.addressLine1}
                onChange={(e) => handleInputChange('addressLine1', e.target.value)}
                className={`input-field ${errors.addressLine1 ? 'border-red-300' : ''}`}
                placeholder="Enter address line 1"
              />
              {errors.addressLine1 && <p className="text-sm text-red-600 mt-1">{errors.addressLine1}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address Line 2
              </label>
              <input
                type="text"
                value={formData.addressLine2}
                onChange={(e) => handleInputChange('addressLine2', e.target.value)}
                className="input-field"
                placeholder="Enter address line 2 (optional)"
              />
            </div>

            {/* Pincode, City, State */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pincode *
                </label>
                <input
                  type="text"
                  value={formData.pincode}
                  onChange={(e) => handlePincodeChange(e.target.value)}
                  className={`input-field ${errors.pincode ? 'border-red-300' : ''}`}
                  placeholder="Enter pincode"
                  maxLength={6}
                />
                {errors.pincode && <p className="text-sm text-red-600 mt-1">{errors.pincode}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={formData.city}
                  readOnly
                  className="input-field bg-gray-50"
                  placeholder="Auto-filled"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  State
                </label>
                <input
                  type="text"
                  value={formData.state}
                  readOnly
                  className="input-field bg-gray-50"
                  placeholder="Auto-filled"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                className="input-field"
                rows={3}
                placeholder="Add any additional notes (optional)"
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end space-x-3 pt-6 border-t">
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
                className="btn-primary"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Creating Member...
                  </div>
                ) : (
                  'Create Member'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
