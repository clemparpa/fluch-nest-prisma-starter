import { effect, signal } from "@preact/signals-react"

export const themeMode = signal<"light" | "dark">("light")

if (typeof window !== "undefined") {
  effect(() => {
    document.documentElement.classList.toggle("dark", themeMode.value === "dark")
  })
}
