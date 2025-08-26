'use client'

import { useState } from 'react'
import { EyeIcon, EyeSlashIcon, CameraIcon } from '@heroicons/react/24/outline'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('') // Clear previous errors
    
    try {
      const { createClient } = await import('../lib/supabase')
      const supabase = createClient()
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        // Handle different error types with user-friendly messages
        if (error.message.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please check your credentials.')
        } else if (error.message.includes('Email not confirmed')) {
          setError('Please verify your email address before signing in.')
        } else if (error.message.includes('Too many requests')) {
          setError('Too many login attempts. Please try again in a few minutes.')
        } else {
          setError('Login failed. Please try again.')
        }
      } else {
        // Redirect to dashboard on successful login
        window.location.href = '/dashboard'
      }
    } catch (error) {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Side - MDPVA Information */}
      <div className="order-2 lg:order-1 w-full lg:flex-1 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 flex items-center justify-center p-8">
        <div className="max-w-lg text-center text-white">
          {/* Logo and Header */}
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full mb-6">
              <CameraIcon className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">MDPVA</h1>
            <p className="text-lg md:text-xl text-primary-100 mb-8">
              Mysore District Photographer and<br />
              Videographers Association
            </p>
          </div>

          {/* Association Description */}
          <div className="space-y-6 text-primary-100">
            <p className="text-base md:text-lg leading-relaxed">
              Connecting creative professionals across Mysore district. Join our community of talented photographers and videographers.
            </p>
            
            <div className="grid grid-cols-1 gap-4 mt-8">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2">1300+ Members</h3>
                <p className="text-sm">Active community of professionals</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2">Professional Network</h3>
                <p className="text-sm">Connect, collaborate, and grow together</p>
              </div>
            </div>

            {/* Become Member Button */}
            <div className="mt-8">
              <button className="bg-white text-primary-700 font-semibold py-3 px-8 rounded-lg hover:bg-primary-50 transition-all duration-200 transform hover:scale-105">
                Become a Member
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Admin Login */}
      <div className="order-1 lg:order-2 w-full lg:flex-1 bg-gray-50 flex items-center justify-center p-8">
        <div className="max-w-md w-full mx-auto">
          {/* Login Card */}
          <div className="card">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Admin Login</h2>
              <p className="text-gray-600">Sign in to manage member applications</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="admin@mdpva.in"
                  required
                />
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field pr-12"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="w-5 h-5" />
                    ) : (
                      <EyeIcon className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Signing in...
                  </div>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <div className="text-center mt-8">
            <p className="text-xs text-gray-500">
              For technical support, contact{' '}
              <a href="mailto:support@mdpva.in" className="text-primary-600 hover:text-primary-700">
                support@mdpva.in
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
