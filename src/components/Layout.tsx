import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export function Layout() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/90 backdrop-blur dark:border-slate-700 dark:bg-surface/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="text-lg font-semibold tracking-tight text-ink">
            Taskflow
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 font-medium transition-colors ${
                  isActive
                    ? 'bg-surface-muted text-ink'
                    : 'text-ink-muted hover:bg-slate-100 dark:hover:bg-slate-800'
                }`
              }
            >
              Dashboard
            </NavLink>
            {user && (
              <>
                <span className="hidden text-ink-muted sm:inline">
                  {user.email}
                </span>
                <button type="button" className="btn-ghost" onClick={() => void signOut()}>
                  Sign out
                </button>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
