function Typography() {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-medium">Typography</h2>
        <p className="text-sm text-muted-foreground">
          Échelle Heading, paragraphe, inline, blockquote, link — sans + mono.
        </p>
      </div>
      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-3 font-sans">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">font-sans</div>
          <h1 className="text-4xl font-semibold tracking-tight">Heading 1</h1>
          <h2 className="text-3xl font-semibold tracking-tight">Heading 2</h2>
          <h3 className="text-2xl font-semibold">Heading 3</h3>
          <h4 className="text-xl font-medium">Heading 4</h4>
          <h5 className="text-lg font-medium">Heading 5</h5>
          <h6 className="text-base font-medium">Heading 6</h6>
          <p className="text-sm leading-relaxed">
            Paragraph. The quick brown fox jumps over the lazy dog. With{" "}
            <a
              href="https://example.com"
              className="text-primary underline-offset-4 hover:underline"
            >
              an inline link
            </a>{" "}
            and some{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">inline code</code>.
          </p>
          <p className="text-xs text-muted-foreground">
            <small>Small / caption text in muted foreground.</small>
          </p>
          <blockquote className="border-l-2 border-border pl-4 text-sm italic text-muted-foreground">
            "Design tokens render the same in every section. If a swatch changes, the whole UI
            follows."
          </blockquote>
        </div>
        <div className="space-y-3 font-mono">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">font-mono</div>
          <pre className="rounded-md bg-muted p-4 text-xs leading-relaxed text-muted-foreground">
            {`function greet(name: string) {
  return \`hello, \${name}\`
}

greet('showcase')`}
          </pre>
          <p className="text-xs">
            Inline mono : <span className="rounded bg-muted px-1 py-0.5">--font-mono</span> via
            Tailwind <span className="rounded bg-muted px-1 py-0.5">font-mono</span>.
          </p>
        </div>
      </div>
    </section>
  )
}

export default Typography
