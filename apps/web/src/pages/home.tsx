function Home() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Home</h1>
        <p className="text-muted-foreground">
          Template React + Vite + Tailwind v4 + shadcn (Base UI) + signals.
        </p>
      </div>

      <section className="rounded-lg border border-border bg-card text-card-foreground p-6 space-y-3">
        <h2 className="text-xl font-medium">Tokens sanity check</h2>
        <p className="text-sm text-muted-foreground">
          Le bouton <code className="font-mono">theme</code> dans le header flip le signal{" "}
          <code className="font-mono">themeMode</code> et l'effect synchronise la classe{" "}
          <code className="font-mono">dark</code> sur{" "}
          <code className="font-mono">&lt;html&gt;</code>. Aucun{" "}
          <code className="font-mono">useSignals()</code> écrit à la main — tout est injecté par le
          Babel transform.
        </p>
        <div className="flex flex-wrap gap-2">
          <div className="rounded-sm bg-primary text-primary-foreground px-3 py-1 text-sm">
            primary
          </div>
          <div className="rounded-sm bg-secondary text-secondary-foreground px-3 py-1 text-sm">
            secondary
          </div>
          <div className="rounded-sm bg-accent text-accent-foreground px-3 py-1 text-sm">
            accent
          </div>
          <div className="rounded-sm bg-destructive text-destructive-foreground px-3 py-1 text-sm">
            destructive
          </div>
        </div>
      </section>
    </div>
  )
}

export default Home
