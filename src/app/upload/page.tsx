import { requireUser } from '@/lib/supabase/server'
import type { Deck } from '@/lib/types'
import UploadForm from './UploadForm'

export default async function Upload() {
  const { supabase } = await requireUser()
  const { data } = await supabase.from('decks').select('*').eq('active', true).order('name').order('version_order', { ascending: false })
  return (
    <>
      <h1>Upload games</h1>
      <p className="muted">
        In TCG Live, open a finished game&apos;s battle log and export it, then drop the files here (several at once is fine)
        or paste the text. A Training Court export (.json) works too. Games already saved are skipped.
      </p>
      <UploadForm decks={(data ?? []) as Deck[]} />
    </>
  )
}
