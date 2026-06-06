---
name: fluch-signal-store
description: NgRx SignalStore-inspired state management for React, built on Preact signals. Composable features (withState/withComputed/withMethods), normalized entities, rxMethod for async side-effects, Redux DevTools bridge. Sync-only v1, fully type-inferred, ~3kb gzip.
---

# @fluch/signal-store

A small, fully typed state-management library for React (and any environment running Preact signals). State is composed from features, exposed as fine-grained signals, mutated via `patchState`. No selectors, no memoization, no reducers — readers subscribe to exactly the signals they read.

This SKILL covers the core API. See `references/` for per-package cheat-sheets (entities collections, React Provider, Redux DevTools, RxJS side-effects).

## Install

```sh
# Core (always required)
pnpm add @fluch/signal-store @preact/signals-core rxjs

# Optional: normalized entity collections
pnpm add @fluch/signal-store-entities

# Optional: scoped stores per React subtree
pnpm add @fluch/signal-store-react @preact/signals-react react

# Optional dev-only: Redux DevTools bridge
pnpm add -D @fluch/signal-store-devtools
```

All four `@fluch/signal-store-*` packages share a single version line (changeset `fixed` mode) — install any combination on `^1.0.0`.

## Core API

The five primitives you use 90% of the time.

### `signalStore(...features)`

Compose features into a plain object store. Each feature receives the accumulator (keys declared so far) and returns the keys it adds.

```ts
import { signalStore, withState } from '@fluch/signal-store';

const store = signalStore(withState({ count: 0 }));
store.count.value; // 0
```

Cap: **10 features per call** (TypeScript inference limit). Beyond that, factor into composed sub-features.

### `withState(initial)`

Declare initial state. Each top-level key becomes its own `Signal`.

```ts
import { signalStore, withState } from '@fluch/signal-store';

const store = signalStore(withState({ count: 0, name: 'foo' }));
store.count.value; // 0      → Signal<number>
store.name.value;  // 'foo'  → Signal<string>
```

Nested objects are **atomic** — mutating `store.user.name` directly does not trigger re-renders. Use `patchState` instead.

In dev (`NODE_ENV !== 'production'`), state objects are deep-frozen.

### `withComputed(fn)`

Add derived signals. `fn` receives the state + computed signals declared so far (no methods yet).

```ts
import { signalStore, withState, withComputed } from '@fluch/signal-store';
import { computed } from '@preact/signals-core';

const store = signalStore(
  withState({ count: 0 }),
  withComputed(({ count }) => ({
    double: computed(() => count.value * 2),
    isPositive: computed(() => count.value > 0),
  })),
);
```

### `withMethods(fn)`

Add methods. `fn` receives the store (state + computed, no methods) and returns an object of synchronous methods. Methods call `patchState(store, ...)` to mutate.

```ts
import { signalStore, withState, withMethods, patchState } from '@fluch/signal-store';

const store = signalStore(
  withState({ count: 0 }),
  withMethods((s) => ({
    increment: () => patchState(s, { count: s.count.value + 1 }),
    reset: () => patchState(s, { count: 0 }),
  })),
);

store.increment();
store.count.value; // 1
```

For async / cancellable side-effects, use `rxMethod` inside `withMethods` — see `references/core.md`.

### `patchState(store, partial | updater | ...updates)`

Mutate state. Accepts a partial object, a function `current → partial`, or multiple updates in one call (composes with entity updaters).

```ts
import { patchState } from '@fluch/signal-store';

patchState(store, { count: 5 });
patchState(store, (s) => ({ count: s.count + 1 }));
patchState(store, addEntity(todo, todosCfg), { filter: 'all' }); // variadic
```

- Only keys declared via `withState` / `withEntities` are written. Unknown keys are silently ignored.
- After `destroyStore`, further `patchState` calls are silent no-ops.

## Complete example

A counter with state, derived values, and methods — composed in one place.

```ts
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@fluch/signal-store';
import { computed } from '@preact/signals-core';

export const counter = signalStore(
  withState({ count: 0 }),

  withComputed(({ count }) => ({
    double: computed(() => count.value * 2),
    isPositive: computed(() => count.value > 0),
  })),

  withMethods((s) => ({
    increment: () => patchState(s, { count: s.count.value + 1 }),
    decrement: () => patchState(s, { count: s.count.value - 1 }),
    reset: () => patchState(s, { count: 0 }),
  })),
);

counter.count.value;      // 0
counter.double.value;     // 0
counter.isPositive.value; // false

counter.increment();
counter.count.value;      // 1
counter.double.value;     // 2
counter.isPositive.value; // true
```

In a React component (with `@preact/signals-react` installed), reading `counter.count.value` subscribes that component to changes — no `useState`, no selectors, no memoization. Each `counter.increment()` re-renders only the components that read `count` or any computed derived from it.

## Going further

Each cheat-sheet condenses the surface of one package or topic. Read the matching `references/*.md` when you need it.

- **Normalized collections** (`addEntity`, `updateEntity`, `removeEntity`, multi-collection, sort comparator) → `references/entities.md`
- **React integration** (`createStoreContext` Provider + `useStore` hook, lifecycle, factory props) → `references/react.md`
- **Async side-effects** (`rxMethod` for debounced/cancellable pipelines, `toObservable`, `withHooks` for init/destroy callbacks, `destroyStore`) → `references/core.md`
- **Redux DevTools** (`connectDevtools`, action naming, dev-only guard) → `references/devtools.md`

## Constraints & gotchas

- **Sync-only v1.** No built-in async middleware. For cancellable async work (debounce, switchMap, error recovery), use `rxMethod` — it manages subscription lifetimes for you. One-shot fire-and-forget async fits inside an explicit IIFE in `withMethods` or `withHooks.onInit`.
- **React 18+ / 19 only.** `@preact/signals-react` is the binding that makes JSX reads reactive.
- **10-feature cap per `signalStore(...)`.** Beyond that, TS loses inference. Factor into composed sub-features.
- **`patchState` writes only declared keys.** Unknown keys are silently dropped. Use `withState` / `withEntities` to declare every key you intend to mutate.
- **Methods are synchronous by type.** `withMethods` accepts any return shape, but `withHooks` strictly rejects `async () => ...`. Wrap async work in an explicit `void (async () => { ... })()`.
- **Multi-collection entities = one `entityConfig` per collection.** The `collection` string literal prefixes every signal (`usersIds`, `usersEntities`, ...) and `withEntities(cfg)` is called once per collection — see `references/entities.md`.
- **No DI / no `inject()`.** Every helper that needs the store (`patchState`, `destroyStore`, `rxMethod`, `connectDevtools`) takes it explicitly.
