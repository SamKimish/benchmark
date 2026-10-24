'use client'
import { useFormStatus } from 'react-dom'
import Pokeball from './Pokeball'

/** A form's submit button that shows the Poké Ball while the form is being sent. */
export default function SubmitButton({ children, pending: pendingLabel, className }: { children: React.ReactNode; pending: string; className?: string }) {
  const { pending } = useFormStatus()
  return <button className={className} disabled={pending}>{pending ? <Pokeball size={18} label={pendingLabel} /> : children}</button>
}
