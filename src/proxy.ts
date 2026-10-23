import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC = ['/login', '/auth']

export async function proxy(request: NextRequest) {
  // Supabase sends sign-in links to the Site URL when the callback isn't an allowed redirect
  const q = request.nextUrl.searchParams
  if (!request.nextUrl.pathname.startsWith('/auth') && (q.get('code') || q.get('error_description'))) {
    const url = request.nextUrl.clone()
    url.search = ''
    if (q.get('code')) {
      url.pathname = '/auth/callback'
      url.searchParams.set('code', q.get('code')!)
    } else {
      url.pathname = '/login'
      url.searchParams.set('error', q.get('error_description')!)
    }
    return NextResponse.redirect(url)
  }
  let response = NextResponse.next({ request })
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })
  const { data } = await supabase.auth.getUser()
  if (!data.user && !PUBLIC.some((p) => request.nextUrl.pathname.startsWith(p))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
  return response
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'] }
