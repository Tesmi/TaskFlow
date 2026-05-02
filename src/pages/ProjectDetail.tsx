import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { inviteMemberByEmail } from '@/lib/inviteMember'
import { useAuth } from '@/contexts/AuthContext'
import type { ProjectRole, TaskStatus } from '@/types/database'

type Project = {
  id: string
  name: string
  description: string | null
  created_by: string
  created_at: string
}

type MemberRow = {
  user_id: string
  role: ProjectRole
  profiles: { display_name: string | null } | null
}

type TaskRow = {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  assignee_id: string | null
  due_date: string | null
  created_by: string
}

const statusLabels: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
}

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [project, setProject] = useState<Project | null>(null)
  const [myRole, setMyRole] = useState<ProjectRole | null>(null)
  const [members, setMembers] = useState<MemberRow[]>([])
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)

  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all')

  const [taskTitle, setTaskTitle] = useState('')
  const [taskDesc, setTaskDesc] = useState('')
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('todo')
  const [taskAssignee, setTaskAssignee] = useState<string>('')
  const [taskDue, setTaskDue] = useState('')
  const [taskSaving, setTaskSaving] = useState(false)

  const load = useCallback(async () => {
    if (!projectId || !user) return
    setError(null)
    setLoading(true)

    const { data: proj, error: pErr } = await supabase
      .from('projects')
      .select('id, name, description, created_by, created_at')
      .eq('id', projectId)
      .maybeSingle()

    if (pErr || !proj) {
      setError(pErr?.message ?? 'Project not found.')
      setLoading(false)
      return
    }

    setProject(proj as Project)

    const { data: memData, error: mErr } = await supabase
      .from('project_members')
      .select('user_id, role, profiles ( display_name )')
      .eq('project_id', projectId)

    if (mErr) {
      setError(mErr.message)
      setLoading(false)
      return
    }

    const rows = (memData ?? []) as unknown as MemberRow[]
    setMembers(rows)
    const me = rows.find((r) => r.user_id === user.id)
    setMyRole(me?.role ?? null)

    const { data: taskData, error: tErr } = await supabase
      .from('tasks')
      .select(
        'id, title, description, status, assignee_id, due_date, created_by'
      )
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (tErr) {
      setError(tErr.message)
      setLoading(false)
      return
    }

    setTasks((taskData ?? []) as unknown as TaskRow[])
    setLoading(false)
  }, [projectId, user])

  useEffect(() => {
    void load()
  }, [load])

  const memberOptions = useMemo(
    () =>
      members.map((m) => ({
        id: m.user_id,
        label:
          m.profiles?.display_name ??
          `${m.user_id.slice(0, 8)}…`,
      })),
    [members]
  )

  const filteredTasks = useMemo(() => {
    if (filterStatus === 'all') return tasks
    return tasks.filter((t) => t.status === filterStatus)
  }, [tasks, filterStatus])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!projectId || !inviteEmail.trim()) return
    setInviteBusy(true)
    const result = await inviteMemberByEmail(projectId, inviteEmail, 'member')
    setInviteBusy(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setInviteEmail('')
    void load()
  }

  async function createTask(e: React.FormEvent) {
    e.preventDefault()
    if (!projectId || !user || !taskTitle.trim()) return
    setTaskSaving(true)
    const { error: err } = await supabase.from('tasks').insert({
      project_id: projectId,
      title: taskTitle.trim(),
      description: taskDesc.trim() || null,
      status: taskStatus,
      assignee_id: taskAssignee || null,
      due_date: taskDue || null,
      created_by: user.id,
    })
    setTaskSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    setTaskTitle('')
    setTaskDesc('')
    setTaskStatus('todo')
    setTaskAssignee('')
    setTaskDue('')
    void load()
  }

  async function updateTask(
    taskId: string,
    patch: Partial<{ status: TaskStatus; assignee_id: string | null; due_date: string | null }>
  ) {
    const { error: err } = await supabase.from('tasks').update(patch).eq('id', taskId)
    if (err) {
      setError(err.message)
      return
    }
    void load()
  }

  async function deleteTask(taskId: string) {
    const { error: err } = await supabase.from('tasks').delete().eq('id', taskId)
    if (err) {
      setError(err.message)
      return
    }
    void load()
  }

  async function deleteProject() {
    if (!projectId || !project) return
    if (
      !confirm(
        `Delete project “${project.name}”? This removes all tasks and members. This cannot be undone.`
      )
    ) {
      return
    }
    const { error: err } = await supabase.from('projects').delete().eq('id', projectId)
    if (err) {
      setError(err.message)
      return
    }
    navigate('/dashboard', { replace: true })
  }

  const today = new Date().toISOString().slice(0, 10)

  if (loading && !project) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    )
  }

  if (!project || !projectId) {
    return (
      <div>
        <p className="text-ink-muted">{error ?? 'Project not found.'}</p>
        <Link to="/dashboard" className="mt-4 inline-block text-accent hover:underline">
          ← Back to dashboard
        </Link>
      </div>
    )
  }

  const isAdmin = myRole === 'admin'

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/dashboard" className="text-sm text-accent hover:underline">
            ← Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-ink">{project.name}</h1>
          {project.description && (
            <p className="mt-2 max-w-2xl text-ink-muted">{project.description}</p>
          )}
          <p className="mt-2 text-xs text-ink-muted">
            Your role:{' '}
            <span className="font-medium text-ink">
              {myRole === 'admin' ? 'Admin' : myRole === 'member' ? 'Member' : 'Unknown'}
            </span>
          </p>
        </div>
        {isAdmin && (
          <button type="button" className="btn-secondary text-red-700 hover:bg-red-50 dark:text-red-300" onClick={() => void deleteProject()}>
            Delete project
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      <section className="grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-semibold text-ink">Team</h2>
          <ul className="mb-6 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-surface-muted">
            {members.map((m) => (
              <li
                key={m.user_id}
                className="flex items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <span>
                  {m.profiles?.display_name ?? m.user_id.slice(0, 8)}
                  {m.user_id === user?.id ? (
                    <span className="ml-2 text-ink-muted">(you)</span>
                  ) : null}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    m.role === 'admin'
                      ? 'bg-violet-100 text-violet-900 dark:bg-violet-900/50 dark:text-violet-100'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                  }`}
                >
                  {m.role === 'admin' ? 'Admin' : 'Member'}
                </span>
              </li>
            ))}
          </ul>

          {isAdmin && (
            <form onSubmit={(e) => void handleInvite(e)} className="card space-y-3">
              <p className="text-sm text-ink-muted">
                Add someone who already has an account (matched by email).
              </p>
              <div>
                <label htmlFor="inviteEmail" className="label">
                  Email
                </label>
                <input
                  id="inviteEmail"
                  type="email"
                  className="input"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                />
              </div>
              <button type="submit" className="btn-primary" disabled={inviteBusy}>
                {inviteBusy ? 'Adding…' : 'Add member'}
              </button>
            </form>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-lg font-semibold text-ink">New task</h2>
          <form onSubmit={(e) => void createTask(e)} className="card space-y-4">
            <div>
              <label htmlFor="taskTitle" className="label">
                Title
              </label>
              <input
                id="taskTitle"
                className="input"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="taskDesc" className="label">
                Description
              </label>
              <textarea
                id="taskDesc"
                className="input min-h-[72px]"
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="taskStatus" className="label">
                  Status
                </label>
                <select
                  id="taskStatus"
                  className="input"
                  value={taskStatus}
                  onChange={(e) => setTaskStatus(e.target.value as TaskStatus)}
                >
                  {(Object.keys(statusLabels) as TaskStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {statusLabels[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="taskDue" className="label">
                  Due date
                </label>
                <input
                  id="taskDue"
                  type="date"
                  className="input"
                  value={taskDue}
                  onChange={(e) => setTaskDue(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label htmlFor="taskAssignee" className="label">
                Assignee
              </label>
              <select
                id="taskAssignee"
                className="input"
                value={taskAssignee}
                onChange={(e) => setTaskAssignee(e.target.value)}
              >
                <option value="">Unassigned</option>
                {memberOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-primary w-full sm:w-auto" disabled={taskSaving}>
              {taskSaving ? 'Saving…' : 'Add task'}
            </button>
          </form>
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">Tasks</h2>
          <div className="flex items-center gap-2">
            <label htmlFor="filterStatus" className="text-sm text-ink-muted">
              Filter
            </label>
            <select
              id="filterStatus"
              className="input max-w-[180px] py-1.5"
              value={filterStatus}
              onChange={(e) =>
                setFilterStatus(e.target.value as TaskStatus | 'all')
              }
            >
              <option value="all">All</option>
              {(Object.keys(statusLabels) as TaskStatus[]).map((s) => (
                <option key={s} value={s}>
                  {statusLabels[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredTasks.length === 0 ? (
          <p className="text-sm text-ink-muted">No tasks match this filter.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-ink-muted dark:border-slate-700 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3 font-medium">Task</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Assignee</th>
                  <th className="px-4 py-3 font-medium">Due</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filteredTasks.map((t) => {
                  const assigneeName =
                    memberOptions.find((o) => o.id === t.assignee_id)?.label ?? '—'
                  const overdue =
                    t.due_date && t.due_date < today && t.status !== 'done'
                  return (
                    <tr key={t.id} className="bg-white dark:bg-surface-muted">
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink">{t.title}</div>
                        {t.description && (
                          <div className="mt-0.5 text-ink-muted line-clamp-2">
                            {t.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="input py-1.5"
                          value={t.status}
                          onChange={(e) =>
                            void updateTask(t.id, {
                              status: e.target.value as TaskStatus,
                            })
                          }
                        >
                          {(Object.keys(statusLabels) as TaskStatus[]).map((s) => (
                            <option key={s} value={s}>
                              {statusLabels[s]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-ink-muted">{assigneeName}</td>
                      <td className="px-4 py-3">
                        <input
                          type="date"
                          className="input py-1.5"
                          value={t.due_date ?? ''}
                          onChange={(e) =>
                            void updateTask(t.id, {
                              due_date: e.target.value || null,
                            })
                          }
                        />
                        {overdue && (
                          <span className="ml-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                            Overdue
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="btn-ghost text-red-600 dark:text-red-400"
                          onClick={() => void deleteTask(t.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
