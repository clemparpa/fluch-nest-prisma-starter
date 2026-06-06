import { Link, NavLink, Outlet } from "react-router"
import { Toaster } from "@/components/ui/sonner"
import { themeMode } from "@/lib/signals"

function RootLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <header className="border-b border-border">
        <div className="mx-auto max-w-5xl flex items-center justify-between gap-4 p-4">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            fluch-react-signals-starter
          </Link>
          <nav className="flex items-center gap-2">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`
              }
            >
              Home
            </NavLink>
            <NavLink
              to="/showcase"
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`
              }
            >
              Showcase
            </NavLink>
            <NavLink
              to="/auth"
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`
              }
            >
              Auth
            </NavLink>
            <button
              type="button"
              onClick={() => {
                themeMode.value = themeMode.value === "dark" ? "light" : "dark"
              }}
              className="ml-2 rounded-md border border-border bg-card text-card-foreground px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              theme: {themeMode.value}
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-8">
        <Outlet />
      </main>
      <Toaster theme={themeMode.value} />
    </div>
  )
}

export default RootLayout
