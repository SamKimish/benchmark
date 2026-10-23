import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function supabaseServer() {
  const store = await cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options))
        } catch {
          // called from a Server Component; middleware refreshes the session instead
        }
      },
    },
  })
}

/** The signed-in user and a client acting as them; sends anyone else to /login. */
export async function requireUser() {
  const supabase = await supabaseServer()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')
  return { supabase, user: data.user }
}
