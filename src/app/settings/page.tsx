import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/supabase/server'
import SubmitButton from '@/components/SubmitButton'

async function changePassword(form: FormData) {
  'use server'
  const password = String(form.get('password') ?? '')
  if (password.length < 8) redirect('/settings?error=Use+at+least+8+characters')
  if (password !== String(form.get('confirm') ?? '')) redirect('/settings?error=The+passwords+don%27t+match')
  const { supabase } = await requireUser()
  const { error } = await supabase.auth.updateUser({ password })
  redirect(error ? `/settings?error=${encodeURIComponent(error.message)}` : '/settings?saved=1')
}

export default async function Settings({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const q = await searchParams
  const { supabase, user } = await requireUser()
  const [{ count: games }, { count: decks }] = await Promise.all([
    supabase.from('games').select('id', { count: 'exact', head: true }),
    supabase.from('decks').select('id', { count: 'exact', head: true }).eq('active', true),
  ])
  return (
    <>
      <h1>Settings</h1>
      <div className="panel form">
        <h2 style={{ marginTop: 0 }}>Account</h2>
        <p>Signed in as <strong>{user.email}</strong></p>
        <p className="muted small">{games ?? 0} games and {decks ?? 0} decks saved.</p>
      </div>
      <div className="panel form" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Change password</h2>
        <form action={changePassword} className="form">
          <label>New password<input name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
          <label>Confirm<input name="confirm" type="password" required minLength={8} autoComplete="new-password" /></label>
          <SubmitButton pending="Saving…">Save password</SubmitButton>
        </form>
        {q.saved && <p>Password changed.</p>}
        {q.error && <p className="error">{q.error}</p>}
      </div>
      <div className="panel form" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Import</h2>
        <p className="small">To bring games over from Training Court, drop its JSON export on the <Link href="/upload">Upload</Link> page.</p>
      </div>
    </>
  )
}
