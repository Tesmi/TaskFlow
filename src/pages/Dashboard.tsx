import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { ProjectRole, TaskStatus } from '@/types/database'

type ProjectRow = {
  id: string
  name: string
  description: string | null
  created_at: string
}

type Membership = {
  role: ProjectRole
  projects: ProjectRow | null
}

type TaskRow = {
  id: string
  project_id: string
  title: string
  status: TaskStatus
  due_date: string | null
  assignee_id: string | null
  projects: { name: string } | null
}

export default function Dashboard() {
  const { user } = useAuth()
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setError(null)
    setLoading(true)

    const { data: memData, error: memErr } = await supabase
      .from('project_members')
      .select('role, projects ( id, name, description, created_at )')
      .eq('user_id', user.id)

    if (memErr) {
      setError(memErr.message)
      setLoading(false)
      return
    }

    const list = (memData ?? []) as unknown as Membership[]
    setMemberships(list)

    const projectIds = list
      .map((m) => m.projects?.id)
      .filter((id): id is string => Boolean(id))

    if (projectIds.length === 0) {
      setTasks([])
      setLoading(false)
      return
    }

    const { data: taskData, error: taskErr } = await supabase
      .from('tasks')
      .select('id, project_id, title, status, due_date, assignee_id, projects ( name )')
      .in('project_id', projectIds)
      .order('due_date', { ascending: true, nullsFirst: false })

    if (taskErr) {
      setError(taskErr.message)
      setLoading(false)
      return
    }

    setTasks((taskData ?? []) as unknown as TaskRow[])
    setLoading(false)
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const stats = useMemo(() => {
    const byStatus: Record<TaskStatus, number> = {
      todo: 0,
      in_progress: 0,
      done: 0,
    }
    for (const t of tasks) {
      byStatus[t.status]++
    }
    return byStatus
  }, [tasks])

  const overdue = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.due_date &&
          t.due_date < today &&
          t.status !== 'done'
      ),
    [tasks, today]
  )

  async function createProject(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !newName.trim()) return
    setCreating(true)
    const { error: err } = await supabase.from('projects').insert({
      name: newName.trim(),
      description: newDesc.trim() || null,
      created_by: user.id,
    })
    setCreating(false)
    if (err) {
      setError(err.message)
      return
    }
    setNewName('')
    setNewDesc('')
    void load()
  }

  if (loading && memberships.length === 0 && !error) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Dashboard</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Your projects and a snapshot of tasks across them.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-xs font-medium uppercase text-ink-muted">To do</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{stats.todo}</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase text-ink-muted">In progress</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{stats.in_progress}</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase text-ink-muted">Done</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{stats.done}</p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">Overdue</h2>
        {overdue.length === 0 ? (
          <p className="text-sm text-ink-muted">No overdue tasks. Nice work.</p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-surface-muted">
            {overdue.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <Link
                    to={`/projects/${t.project_id}`}
                    className="font-medium text-accent hover:underline"
                  >
                    {t.title}
                  </Link>
                  <p className="text-xs text-ink-muted">
                    {t.projects?.name ?? 'Project'} · due {t.due_date}
                  </p>
                </div>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                  Overdue
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-semibold text-ink">Your projects</h2>
          {memberships.length === 0 ? (
            <p className="text-sm text-ink-muted">
              No projects yet. Create one using the form →
            </p>
          ) : (
            <ul className="space-y-2">
              {memberships.map((m) => {
                const p = m.projects
                if (!p) return null
                return (
                  <li key={p.id}>
                    <Link
                      to={`/projects/${p.id}`}
                      className="card block transition-shadow hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-medium text-ink">{p.name}</span>
                          {p.description && (
                            <p className="mt-1 line-clamp-2 text-sm text-ink-muted">
                              {p.description}
                            </p>
                          )}
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                            m.role === 'admin'
                              ? 'bg-violet-100 text-violet-900 dark:bg-violet-900/50 dark:text-violet-100'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {m.role === 'admin' ? 'Admin' : 'Member'}
                        </span>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-lg font-semibold text-ink">New project</h2>
          <form onSubmit={(e) => void createProject(e)} className="card space-y-4">
            <div>
              <label htmlFor="pname" className="label">
                Name
              </label>
              <input
                id="pname"
                className="input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                placeholder="e.g. Website launch"
              />
            </div>
            <div>
              <label htmlFor="pdesc" className="label">
                Description
              </label>
              <textarea
                id="pdesc"
                className="input min-h-[88px] resize-y"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <button type="submit" className="btn-primary w-full sm:w-auto" disabled={creating}>
              {creating ? 'Creating…' : 'Create project'}
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}
