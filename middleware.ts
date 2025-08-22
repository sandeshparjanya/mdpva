import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          // In middleware, set on the response to persist
          res.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          res.cookies.set({ name, value: '', ...options, maxAge: 0 })
        }
      }
    }
  )

  // Run only for dashboard paths via matcher below, but keep safeguard
  if (req.nextUrl.pathname.startsWith('/dashboard')) {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      const url = req.nextUrl.clone()
      url.pathname = '/'
      url.searchParams.set('redirectedFrom', req.nextUrl.pathname)
      return NextResponse.redirect(url)
    }
  }

  return res
}

export const config = {
  matcher: ['/dashboard/:path*']
}
