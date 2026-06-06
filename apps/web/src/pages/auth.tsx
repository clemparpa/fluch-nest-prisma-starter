import { useSignal } from "@preact/signals-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signIn, signOut, signUp, useSession } from "@/lib/auth-client"

const baseURL = import.meta.env.VITE_AUTH_BASE_URL

function BackendBanner() {
  if (!baseURL) {
    return (
      <Alert variant="destructive">
        <AlertTitle>No auth backend configured</AlertTitle>
        <AlertDescription>
          Set <code className="font-mono">VITE_AUTH_BASE_URL</code> in your{" "}
          <code className="font-mono">.env</code> to point at a running better-auth server.
        </AlertDescription>
      </Alert>
    )
  }
  return (
    <Alert>
      <AlertTitle>Auth backend</AlertTitle>
      <AlertDescription>
        <code className="font-mono">{baseURL}</code>
      </AlertDescription>
    </Alert>
  )
}

function SignInCard() {
  const email = useSignal("")
  const password = useSignal("")
  const loading = useSignal(false)

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    loading.value = true
    try {
      const result = await signIn.email({
        email: email.value,
        password: password.value,
      })
      if (result.error) {
        toast.error(result.error.message ?? "Sign-in failed")
      } else {
        toast.success("Signed in")
        password.value = ""
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed")
    } finally {
      loading.value = false
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Use your email and password.</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="signin-email">Email</Label>
            <Input
              id="signin-email"
              type="email"
              autoComplete="email"
              required
              value={email.value}
              onChange={(e) => {
                email.value = e.target.value
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="signin-password">Password</Label>
            <Input
              id="signin-password"
              type="password"
              autoComplete="current-password"
              required
              value={password.value}
              onChange={(e) => {
                password.value = e.target.value
              }}
            />
          </div>
        </CardContent>
        <CardFooter className="mt-6">
          <Button type="submit" disabled={loading.value} className="w-full">
            {loading.value ? "Signing in…" : "Sign in"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function SignUpCard() {
  const name = useSignal("")
  const email = useSignal("")
  const password = useSignal("")
  const loading = useSignal(false)

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    loading.value = true
    try {
      const result = await signUp.email({
        name: name.value,
        email: email.value,
        password: password.value,
      })
      if (result.error) {
        toast.error(result.error.message ?? "Sign-up failed")
      } else {
        toast.success("Account created")
        password.value = ""
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-up failed")
    } finally {
      loading.value = false
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign up</CardTitle>
        <CardDescription>Create a new account.</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="signup-name">Name</Label>
            <Input
              id="signup-name"
              type="text"
              autoComplete="name"
              required
              value={name.value}
              onChange={(e) => {
                name.value = e.target.value
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="signup-email">Email</Label>
            <Input
              id="signup-email"
              type="email"
              autoComplete="email"
              required
              value={email.value}
              onChange={(e) => {
                email.value = e.target.value
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="signup-password">Password</Label>
            <Input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              required
              value={password.value}
              onChange={(e) => {
                password.value = e.target.value
              }}
            />
          </div>
        </CardContent>
        <CardFooter className="mt-6">
          <Button type="submit" disabled={loading.value} className="w-full">
            {loading.value ? "Creating…" : "Sign up"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function SessionBlock() {
  const { data, isPending } = useSession()

  const onSignOut = async () => {
    try {
      await signOut()
      toast.success("Signed out")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-out failed")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Current session</CardTitle>
        <CardDescription>Reflects the live state of useSession().</CardDescription>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <p className="text-sm text-muted-foreground">Loading session…</p>
        ) : data?.user ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{data.user.name}</span>
              <span className="text-muted-foreground">{data.user.email}</span>
            </div>
            <Button type="button" variant="outline" onClick={onSignOut}>
              Sign out
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Not signed in.</p>
        )}
      </CardContent>
    </Card>
  )
}

function AuthPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Authentication</h1>
        <p className="text-muted-foreground">
          better-auth client demo. The server is out of scope — point{" "}
          <code className="font-mono">VITE_AUTH_BASE_URL</code> at a running backend.
        </p>
      </header>
      <BackendBanner />
      <div className="grid gap-6 md:grid-cols-2">
        <SignInCard />
        <SignUpCard />
      </div>
      <SessionBlock />
    </div>
  )
}

export default AuthPage
