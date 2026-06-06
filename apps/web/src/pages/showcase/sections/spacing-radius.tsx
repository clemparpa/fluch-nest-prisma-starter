const RADII = [
  { label: "sm", className: "rounded-sm" },
  { label: "md", className: "rounded-md" },
  { label: "lg", className: "rounded-lg" },
  { label: "xl", className: "rounded-xl" },
  { label: "2xl", className: "rounded-2xl" },
] as const

function SpacingRadius() {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-medium">Spacing & Radius</h2>
        <p className="text-sm text-muted-foreground">
          Échelle <code className="font-mono text-xs">--radius-*</code> dérivée de{" "}
          <code className="font-mono text-xs">--radius</code> dans{" "}
          <code className="font-mono text-xs">globals.css</code>.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        {RADII.map(({ label, className }) => (
          <div key={label} className="flex flex-col items-center gap-2">
            <div
              className={`size-20 bg-primary text-primary-foreground ${className} flex items-center justify-center text-xs font-medium`}
            >
              {label}
            </div>
            <div className="font-mono text-xs text-muted-foreground">{className}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default SpacingRadius
