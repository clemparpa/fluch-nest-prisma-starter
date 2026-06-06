import { render, screen } from "@testing-library/react"
import { createMemoryRouter, RouterProvider } from "react-router"
import { describe, expect, it } from "vitest"
import { routes } from "@/router"

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(<RouterProvider router={router} />)
}

describe("Auth page", () => {
  it("rend le bandeau d'alerte rouge quand VITE_AUTH_BASE_URL est absent", () => {
    renderAt("/auth")
    expect(screen.getByText("No auth backend configured")).toBeInTheDocument()
  })

  it("expose les boutons Sign in et Sign up", () => {
    renderAt("/auth")
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Sign up" })).toBeInTheDocument()
  })
})
