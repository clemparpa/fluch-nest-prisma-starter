import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createMemoryRouter, RouterProvider } from "react-router"
import { afterEach, describe, expect, it } from "vitest"
import { routes } from "@/router"
import { counter } from "@/stores/counter"

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(<RouterProvider router={router} />)
}

describe("Showcase", () => {
  afterEach(() => {
    counter.reset()
  })

  it("rend le titre 'Showcase'", () => {
    renderAt("/showcase")
    expect(screen.getByRole("heading", { level: 1, name: "Showcase" })).toBeInTheDocument()
  })

  it("toggle theme bascule la classe 'dark' sur <html>", async () => {
    const user = userEvent.setup()
    renderAt("/showcase")

    expect(document.documentElement.classList.contains("dark")).toBe(false)

    await user.click(screen.getByRole("button", { name: /^theme: light$/ }))
    expect(document.documentElement.classList.contains("dark")).toBe(true)

    await user.click(screen.getByRole("button", { name: /^theme: dark$/ }))
    expect(document.documentElement.classList.contains("dark")).toBe(false)
  })

  it("le store counter increment passe count à 1", async () => {
    const user = userEvent.setup()
    renderAt("/showcase")

    expect(screen.getByText("count: 0")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Increment" }))
    expect(screen.getByText("count: 1")).toBeInTheDocument()
  })
})
