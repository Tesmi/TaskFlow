import { getFunctionsUrl, supabase } from '@/lib/supabase'

export type InviteMemberResult =
  | { ok: true }
  | { ok: false; message: string }

/**
 * Adds an existing Supabase user to the project by email (admin-only; enforced by Edge Function + RLS).
 */
export async function inviteMemberByEmail(
  projectId: string,
  email: string,
  role: 'admin' | 'member' = 'member'
): Promise<InviteMemberResult> {
  const base = getFunctionsUrl()
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!base || !anonKey) {
    return { ok: false, message: 'Supabase is not configured.' }
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (sessionError || !token) {
    return { ok: false, message: 'You must be signed in.' }
  }

  const res = await fetch(`${base}/add-project-member`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
    },
    body: JSON.stringify({ project_id: projectId, email: email.trim(), role }),
  })

  const raw = await res.text()
  let body: { ok?: boolean; error?: string } = {}
  try {
    body = raw ? (JSON.parse(raw) as { ok?: boolean; error?: string }) : {}
  } catch {
    return { ok: false, message: `Request failed (${res.status})` }
  }

  if (!res.ok) {
    return { ok: false, message: body.error ?? `Request failed (${res.status})` }
  }

  return { ok: true }
}
