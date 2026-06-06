# fluch-react-signals-starter

![CI](https://github.com/clemparpa/fluch-react-signals-starter/actions/workflows/ci.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%E2%89%A522-339933?logo=node.js&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-%E2%89%A59-F69220?logo=pnpm&logoColor=white)
[![Use this template](https://img.shields.io/badge/use%20this-template-2EA44F?logo=github)](https://github.com/clemparpa/fluch-react-signals-starter/generate)
![Version](https://img.shields.io/github/v/release/clemparpa/fluch-react-signals-starter?logo=github)

Opinionated React 19 SPA template — **Vite + TypeScript + Tailwind v4 + shadcn (Base UI variant) + @preact/signals-react + React Router 7**.

Built as a fork-friendly starting point for AI-driven UI work: signals replace most `useState` boilerplate, shadcn components are vendored under `src/components/ui`, and CI blocks merges on lint / typecheck / test / audit / build.

## Quickstart

```sh
pnpm install
pnpm dev          # http://localhost:5173 — opens on /showcase
```

Requires **Node ≥ 22** and **pnpm ≥ 9** (versions pinned via [.nvmrc](.nvmrc) and `packageManager` in [package.json](package.json)).

## Stack

| Layer        | Choice                                           |
| ------------ | ------------------------------------------------ |
| Build        | Vite 8                                           |
| Language     | TypeScript 6                                     |
| UI           | React 19                                         |
| Styling      | Tailwind CSS v4 (oklch tokens, `@theme` block)   |
| Components   | shadcn — Base UI variant (`@base-ui/react`)      |
| State        | `@preact/signals-react` + Babel auto-transform   |
| Routing      | React Router 7 (data router, SPA mode)           |
| Lint/Format  | Biome 2                                          |
| Tests        | Vitest 4 + Testing Library + happy-dom           |
| Git hooks    | Husky + lint-staged                              |
| CI           | GitHub Actions — 5 parallel jobs                 |

## Scripts

| Command            | What it does                                      |
| ------------------ | ------------------------------------------------- |
| `pnpm dev`         | Vite dev server with HMR                          |
| `pnpm build`       | `tsc -b && vite build` — production bundle        |
| `pnpm preview`     | Serve the production build locally                |
| `pnpm test`        | Run Vitest once                                   |
| `pnpm test:watch`  | Vitest in watch mode                              |
| `pnpm test:ui`     | Vitest with the browser UI                        |
| `pnpm typecheck`   | `tsc -b --noEmit`                                 |
| `pnpm lint`        | `biome ci` — no auto-fix, used by CI              |
| `pnpm check`       | `biome check --write .` — auto-fix locally        |
| `pnpm format`      | `biome format --write .`                          |

## Project structure

```text
src/
├── components/ui/   # 55 shadcn (Base UI variant) components — vendored
├── hooks/           # custom React hooks
├── layouts/         # shared layout shells (RootLayout, etc.)
├── lib/             # utilities (cn, …)
├── pages/           # route components (showcase/)
├── styles/          # Tailwind entry + design tokens
├── test/            # Vitest setup + test files
├── App.tsx          # app root (wraps the router)
├── main.tsx         # ReactDOM bootstrap + signals runtime
└── router.tsx       # React Router 7 route definitions
```

## Signals

`@preact/signals-react` is wired through a Babel plugin (`@preact/signals-react-transform`) so components react to signal reads **without** needing the `useSignals()` hook. See [vite.config.ts](vite.config.ts) for the plugin order — `babel` must run **before** `react`.

```tsx
import { signal } from "@preact/signals-react"

const count = signal(0)

export function Counter() {
  return <button onClick={() => count.value++}>{count}</button>
}
```

## State management

For state that goes beyond a single isolated signal, the template ships [`@fluch/signal-store`](skills/@fluch-signal-store/SKILL.md) — a small (~3 kb gzip), fully typed lib built on Preact signals. Stores are composed from features (`withState` + `withComputed` + `withMethods`) and exposed as fine-grained signals — no Provider, no hook, no selectors.

`@preact/signals-react` gives you raw fine-grained reactivity (above). `@fluch/signal-store` is the **composition layer on top**: it groups related signals, derives computed values, and bundles synchronous mutations behind named methods. Both cohabit — use signals for one-off reactive cells, the store for cohesive state.

```ts
import { computed } from "@preact/signals-core"
import { patchState, signalStore, withComputed, withMethods, withState } from "@fluch/signal-store"

export const counter = signalStore(
  withState({ count: 0 }),
  withComputed(({ count }) => ({ double: computed(() => count.value * 2) })),
  withMethods((s) => ({ increment: () => patchState(s, { count: s.count.value + 1 }) })),
)
```

In-tree example: [src/stores/counter.ts](src/stores/counter.ts) + [src/pages/showcase/sections/signal-store.tsx](src/pages/showcase/sections/signal-store.tsx) (live demo on `/showcase`). Going further → [skills/@fluch-signal-store/SKILL.md](skills/@fluch-signal-store/SKILL.md) for the core API, plus `references/` for normalized entity collections, scoped React Provider, RxJS side-effects (`rxMethod`), and the Redux DevTools bridge.

## Authentication

The template ships the **client** for [better-auth](https://better-auth.com) — sign-in / sign-up / session — but **not the server**. The `/auth` page (see [src/pages/auth.tsx](src/pages/auth.tsx)) is a working demo that points at whatever backend you configure via `VITE_AUTH_BASE_URL`.

```sh
cp .env.example .env
# then edit .env to point at a running better-auth backend, e.g.:
# VITE_AUTH_BASE_URL=http://localhost:8000
```

Without a backend, `/auth` still renders — it just shows a red alert banner ("No auth backend configured") and the network requests fail (expected). See [better-auth.com](https://better-auth.com) for how to stand up a compatible server.

The client lives in [src/lib/auth-client.ts](src/lib/auth-client.ts) and re-exports the hooks (`useSession`) and actions (`signIn`, `signUp`, `signOut`) you'll typically import from your pages.

## CI

`.github/workflows/ci.yml` runs five parallel jobs on every push to `main` and every pull request:

- `lint` — Biome
- `typecheck` — TypeScript
- `test` — Vitest
- `audit` — `pnpm audit --audit-level=high`
- `build` — full production build

Concurrency is set so that a new commit on the same ref cancels the previous run.

## Fork this template

This repo is published as a **GitHub template** — click *Use this template* (or `gh repo create --template …`) to start a new project from it. After cloning your fork:

```sh
pnpm install
pnpm dev
```

…and start replacing the showcase page with your own routes.

## Monorepo integration

When integrating this template as a workspace inside an existing monorepo:

1. **Move the source** into your monorepo path, e.g. `apps/front/`.
2. **Adjust [.github/dependabot.yml](.github/dependabot.yml)**: change `directories: ["/"]` to your package path (e.g. `directories: ["/apps/front"]`). If your monorepo already has a `github-actions` entry from another template, keep only one — Dependabot scans `.github/workflows/` repo-wide.
3. **Merge CI workflows**: this template's `.github/workflows/ci.yml` runs 5 jobs scoped to a single project. In a monorepo you'll likely want to gate jobs on path filters (`paths: ["apps/front/**"]`) or restructure into a matrix.
4. **Lockfile**: pnpm workspaces use a single root `pnpm-lock.yaml` — Dependabot handles this natively. Point `directories` at the package, not the lockfile.

## Contributing

Contributions welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow, commit convention, and local validation command. To report a bug or request a feature, open an issue from one of the [issue templates](.github/ISSUE_TEMPLATE/). For security vulnerabilities, follow [SECURITY.md](SECURITY.md) (do **not** open a public issue).

## Community

- 💬 [Discussions](https://github.com/clemparpa/fluch-react-signals-starter/discussions) — questions, ideas, show-and-tell.
- 📜 [Code of Conduct](CODE_OF_CONDUCT.md) — Contributor Covenant 3.0.
- 👤 Maintainer: [@clemparpa](https://github.com/clemparpa).

## License

MIT.
