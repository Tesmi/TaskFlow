import { supabase } from '@/lib/supabase'

export type InviteMemberResult =
  | { ok: true }
  | { ok: false; message: string }

function deploymentHint(message: string): string {
  const m = message.toLowerCase()
  if (
    m.includes('404') ||
    m.includes('not found') ||
    m.includes('failed to send') ||
    m.includes('failed to fetch')
  ) {
    return `${message} — If this persists, deploy the Edge Function: supabase functions deploy add-project-member`
  }
  return message
}

/**
 * Adds an existing Supabase user to the project by email (admin-only; enforced by Edge Function + RLS).
 */
export async function inviteMemberByEmail(
  projectId: string,
  email: string,
  role: 'admin' | 'member' = 'member'
): Promise<InviteMemberResult> {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    return { ok: false, message: 'Supabase is not configured.' }
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !sessionData.session) {
    return { ok: false, message: 'You must be signed in.' }
  }

  const { data, error } = await supabase.functions.invoke<{
    ok?: boolean
    error?: string
    user_id?: string
  }>('add-project-member', {
    body: { project_id: projectId, email: email.trim(), role },
  })

  if (error) {
    return { ok: false, message: deploymentHint(error.message) }
  }

  if (data && typeof data === 'object' && 'error' in data && data.error) {
    return { ok: false, message: String(data.error) }
  }

  return { ok: true }
}
