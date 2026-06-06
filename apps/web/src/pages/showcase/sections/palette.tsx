import { useLayoutEffect, useState } from "react"
import { themeMode } from "@/lib/signals"

const TOKENS = [
  "background",
  "foreground",
  "primary",
  "secondary",
  "accent",
  "muted",
  "destructive",
  "border",
  "ring",
  "card",
  "popover",
] as const

type Token = (typeof TOKENS)[number]

function Palette() {
  const mode = themeMode.value
  const [values, setValues] = useState<Record<Token, string>>(
    () => Object.fromEntries(TOKENS.map((t) => [t, ""])) as Record<Token, string>,
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: mode is the trigger for re-reading CSS vars on theme toggle
  useLayoutEffect(() => {
    const style = getComputedStyle(document.documentElement)
    setValues(
      Object.fromEntries(TOKENS.map((t) => [t, style.getPropertyValue(`--${t}`).trim()])) as Record<
        Token,
        string
      >,
    )
  }, [mode])

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-medium">Palette</h2>
        <p className="text-sm text-muted-foreground">
          Tokens en lecture live via <code className="font-mono">getComputedStyle</code> — bascule
          via le toggle du header.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {TOKENS.map((token) => (
          <div
            key={token}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground"
          >
            <div
              className="size-10 shrink-0 rounded-md border border-border"
              style={{ background: `var(--${token})` }}
            />
            <div className="min-w-0 space-y-0.5">
              <div className="text-sm font-medium">{token}</div>
              <div className="truncate font-mono text-xs text-muted-foreground">
                {values[token] || "—"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default Palette
