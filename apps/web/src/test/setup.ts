import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"
import { themeMode } from "@/lib/signals"

afterEach(() => {
  cleanup()
  themeMode.value = "light"
})
