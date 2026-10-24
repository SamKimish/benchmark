import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import SubmitButton from '@/components/SubmitButton'

async function sendLink(form: FormData) {
  'use server'
  const email = String(form.get('email') ?? '').trim().toLowerCase()
  const allowed = (process.env.ALLOWED_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  // Say the same thing either way, so the form doesn't reveal who has an account
  const password = String(form.get('password') ?? '')
  if (password) {
    if (allowed.length && !allowed.includes(email)) redirect('/login?error=Wrong+email+or+password')
    const { error } = await (await supabaseServer()).auth.signInWithPassword({ email, password })
    redirect(error ? '/login?error=Wrong+email+or+password' : '/')
  }
  if (email && (!allowed.length || allowed.includes(email))) {
    const h = await headers()
    const origin = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`
    const supabase = await supabaseServer()
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/auth/callback` } })
    if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }
  redirect('/login?sent=1')
}

export default async function Login({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const q = await searchParams
  return (
    <div className="panel form" style={{ margin: '40px auto' }}>
      <h1>Sign in</h1>
      {q.sent ? (
        <p>If that address has access, a sign-in link is on its way. Open it on this device.</p>
      ) : (
        <form action={sendLink} className="form">
          <label>Email<input name="email" type="email" required autoComplete="email" /></label>
          <label>Password <span className="small">(leave empty to get a sign-in link by email)</span>
            <input name="password" type="password" autoComplete="current-password" /></label>
          <SubmitButton pending="Signing in…">Sign in</SubmitButton>
        </form>
      )}
      {q.error && <p className="error">{q.error}</p>}
    </div>
  )
}
