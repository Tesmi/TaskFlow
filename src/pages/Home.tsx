import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export default function Home() {
  const { user } = useAuth()

  return (
    <div className="mx-auto max-w-2xl text-center">
      <h1 className="mb-4 text-4xl font-semibold tracking-tight text-ink">
        Projects, tasks, and progress — together
      </h1>
      <p className="mb-8 text-lg text-ink-muted">
        Create teams, assign work, and stay on top of deadlines with role-based access for
        admins and members.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {user ? (
          <Link to="/dashboard" className="btn-primary px-6 py-3">
            Go to dashboard
          </Link>
        ) : (
          <>
            <Link to="/signup" className="btn-primary px-6 py-3">
              Get started
            </Link>
            <Link to="/login" className="btn-secondary px-6 py-3">
              Sign in
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
