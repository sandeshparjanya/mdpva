import { createClient } from './supabase'

// Generate next Member ID in format MDPVA{YY}{00001}
export async function generateMemberID(): Promise<string> {
  const supabase = createClient()
  const currentYear = new Date().getFullYear()
  const yearSuffix = currentYear.toString().slice(-2) // Get last 2 digits (25 for 2025)
  
  try {
    // Get the latest member ID for current year
    const { data, error } = await supabase
      .from('members')
      .select('member_id')
      .like('member_id', `MDPVA${yearSuffix}%`)
      .order('member_id', { ascending: false })
      .limit(1)

    if (error) {
      console.error('Error fetching latest member ID:', error)
      // If error, start with 00001 for the year
      return `MDPVA${yearSuffix}00001`
    }

    if (!data || data.length === 0) {
      // No members for this year yet, start with 00001
      return `MDPVA${yearSuffix}00001`
    }

    // Extract the number part and increment
    const latestMemberID = data[0].member_id
    const numberPart = latestMemberID.slice(-5) // Get last 5 digits
    const nextNumber = parseInt(numberPart) + 1
    const paddedNumber = nextNumber.toString().padStart(5, '0')
    
    return `MDPVA${yearSuffix}${paddedNumber}`
  } catch (error) {
    console.error('Error generating member ID:', error)
    return `MDPVA${yearSuffix}00001`
  }
}

// Validate Indian pincode and get city/state
export async function validatePincode(pincode: string): Promise<{
  isValid: boolean
  city?: string
  state?: string
  error?: string
}> {
  // Basic validation - 6 digits
  if (!/^[0-9]{6}$/.test(pincode)) {
    return {
      isValid: false,
      error: 'Pincode must be exactly 6 digits'
    }
  }

  try {
    // Using India Post API for pincode validation
    const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`)
    const data = await response.json()

    if (!response.ok || !data || data.length === 0) {
      return {
        isValid: false,
        error: 'Failed to validate pincode'
      }
    }

    const result = data[0]
    
    if (result.Status === 'Error') {
      return {
        isValid: false,
        error: 'Invalid Indian pincode'
      }
    }

    if (result.Status === 'Success' && result.PostOffice && result.PostOffice.length > 0) {
      const postOffice = result.PostOffice[0]
      return {
        isValid: true,
        city: postOffice.District,
        state: postOffice.State
      }
    }

    return {
      isValid: false,
      error: 'Invalid pincode'
    }
  } catch (error) {
    console.error('Error validating pincode:', error)
    return {
      isValid: false,
      error: 'Failed to validate pincode. Please try again.'
    }
  }
}

// Check if email already exists
export async function checkEmailExists(email: string): Promise<boolean> {
  const supabase = createClient()
  
  try {
    const { data, error } = await supabase
      .from('members')
      .select('id')
      .eq('email', email.toLowerCase())
      .limit(1)

    if (error) {
      console.error('Error checking email:', error)
      return false
    }

    return data && data.length > 0
  } catch (error) {
    console.error('Error checking email:', error)
    return false
  }
}

// Check if phone already exists
export async function checkPhoneExists(phone: string): Promise<boolean> {
  const supabase = createClient()
  
  try {
    // Normalize phone number (remove spaces, dashes, etc.)
    const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '')
    
    const { data, error } = await supabase
      .from('members')
      .select('id')
      .eq('phone', normalizedPhone)
      .limit(1)

    if (error) {
      console.error('Error checking phone:', error)
      return false
    }

    return data && data.length > 0
  } catch (error) {
    console.error('Error checking phone:', error)
    return false
  }
}

// Upload profile photo to Supabase Storage
export async function uploadProfilePhoto(file: File, memberID: string): Promise<{
  success: boolean
  url?: string
  error?: string
}> {
  const supabase = createClient()
  
  try {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      return {
        success: false,
        error: 'Please upload an image file (JPG, PNG, etc.)'
      }
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return {
        success: false,
        error: 'Image size must be less than 2MB'
      }
    }

    // Create unique filename
    const fileExt = file.name.split('.').pop()
    const fileName = `${memberID}.${fileExt}`
    const filePath = `profiles/${fileName}`

    // Upload file
    const { data, error } = await supabase.storage
      .from('member-photos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true // Replace if exists
      })

    if (error) {
      console.error('Error uploading photo:', error)
      return {
        success: false,
        error: 'Failed to upload photo. Please try again.'
      }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('member-photos')
      .getPublicUrl(filePath)

    return {
      success: true,
      url: urlData.publicUrl
    }
  } catch (error) {
    console.error('Error uploading photo:', error)
    return {
      success: false,
      error: 'Failed to upload photo. Please try again.'
    }
  }
}

// Member type definition
export interface Member {
  id?: string
  member_id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  profession: 'photographer' | 'videographer' | 'both'
  business_name?: string
  address_line1: string
  address_line2?: string
  pincode: string
  city: string
  state: string
  status: 'active' | 'inactive' | 'suspended'
  profile_photo_url?: string
  notes?: string
  created_at?: string
  updated_at?: string
}
