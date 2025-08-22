import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { createServerClientSupabase } from '../../lib/supabaseServer'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = createServerClientSupabase()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/?redirectedFrom=/dashboard')
  }

  return (
    <>{children}</>
  )
}
