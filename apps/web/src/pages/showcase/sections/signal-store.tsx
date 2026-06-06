import { Button } from "@/components/ui/button"
import { counter } from "@/stores/counter"

function SignalStore() {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-medium">Signal Store</h2>
        <p className="text-sm text-muted-foreground">
          Démo <code className="font-mono text-sm">@fluch/signal-store</code> — composition{" "}
          <code className="font-mono text-sm">withState</code> +{" "}
          <code className="font-mono text-sm">withComputed</code> +{" "}
          <code className="font-mono text-sm">withMethods</code>. Pas de hook : le Babel transform
          signals rend la subscription automatique sur{" "}
          <code className="font-mono text-sm">.value</code>.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-md border bg-card text-card-foreground p-4 space-y-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">count</div>
          <div className="text-2xl font-mono">count: {counter.count.value}</div>
        </div>
        <div className="rounded-md border bg-card text-card-foreground p-4 space-y-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">double</div>
          <div className="text-2xl font-mono">{counter.double.value}</div>
        </div>
        <div className="rounded-md border bg-card text-card-foreground p-4 space-y-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">isPositive</div>
          <div className="text-2xl font-mono">{counter.isPositive.value ? "yes" : "no"}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => counter.increment()}>Increment</Button>
        <Button variant="secondary" onClick={() => counter.decrement()}>
          Decrement
        </Button>
        <Button variant="outline" onClick={() => counter.reset()}>
          Reset
        </Button>
      </div>
    </section>
  )
}

export default SignalStore
