# `@fluch/signal-store-react` — React Provider reference

Scope a signal-store instance to a React subtree via a `<Provider>` + `useStore()` pair. **Mode B** (per-Provider instance) vs Mode A (module singleton).

Peer deps: `@fluch/signal-store`, `@preact/signals-react`, `react`.

## When to use

- Multiple independent instances of the same store (per-route, per-feature, per-tenant).
- A store seeded from React props, route params, or fetched data.
- Test / Storybook isolation between renders.

For a global singleton (e.g. auth, theme), use Mode A — `signalStore(...)` at module scope, imported directly.

## `createStoreContext(factory)`

```ts
createStoreContext<Store, Props = void>(
  factory: (props: Props) => Store,
): {
  Provider: React.FC<React.PropsWithChildren<Props>>;
  useStore: () => Store;
}
```

Returns a typed `Provider` + `useStore` pair. `useStore()` returns exactly the store the factory returns — no generic, no annotation.

### Basic (no props)

```tsx
import { signalStore, withState, withMethods, patchState } from '@fluch/signal-store';
import { createStoreContext } from '@fluch/signal-store-react';

const { Provider, useStore } = createStoreContext(() =>
  signalStore(
    withState({ count: 0 }),
    withMethods((s) => ({
      increment: () => patchState(s, { count: s.count.value + 1 }),
    })),
  ),
);

function Counter() {
  const store = useStore();
  return <button onClick={store.increment}>count: {store.count.value}</button>;
}

export function App() {
  return (
    <Provider>
      <Counter />
    </Provider>
  );
}
```

### Factory with props

The factory can take props that the Provider forwards. TypeScript requires the props at the Provider call site.

```tsx
type CounterProps = { initial: number };

const { Provider, useStore } = createStoreContext((props: CounterProps) =>
  signalStore(
    withState({ count: props.initial }),
    withMethods((s) => ({
      increment: () => patchState(s, { count: s.count.value + 1 }),
    })),
  ),
);

<Provider initial={42}>
  <Counter />
</Provider>;
```

## Props are read **once**, at mount

The factory runs exactly one time per Provider mount. Changing a prop **does not** rebuild the store.

```tsx
// userId changes from "alice" to "bob" — store stays unchanged.
<Provider userId={userId}>...</Provider>
```

To force a fresh store on prop change, use React's `key` prop:

```tsx
<Provider key={userId} userId={userId}>...</Provider>
```

The old store is destroyed on remount; a new one is built with the new props.

## Lifecycle

The Provider manages the store's lifecycle automatically:

- **mount** → builds the store via the factory. `withHooks.onInit` fires.
- **unmount** → calls `destroyStore(store)`. `withHooks.onDestroy` fires, the RxJS pipeline tears down, all `rxMethod` subscriptions are released.

**You never call `destroyStore` yourself when using the Provider.**

## Multiple stores

Each `createStoreContext` call returns its own React Context — compose freely:

```tsx
const { Provider: AuthProvider, useStore: useAuthStore } =
  createStoreContext(() => signalStore(withState({ user: null })));

const { Provider: TodosProvider, useStore: useTodosStore } =
  createStoreContext(() => signalStore(withState({ todos: [] })));

<AuthProvider>
  <TodosProvider>
    <App />
  </TodosProvider>
</AuthProvider>;
```

## `useStore` outside its Provider

Calling `useStore()` outside the matching `<Provider>` throws a descriptive error at runtime. There is no fallback / default store.

## Reactivity — how reads become subscriptions

With `@preact/signals-react` set up in your app, reading `store.x.value` **inside JSX** subscribes that component to that signal — fine-grained re-renders, no `useState`, no selectors, no memoization.

```tsx
function Counter() {
  const store = useStore();
  return <p>{store.count.value}</p>; // re-renders only when count changes
}
```

No selector API on `useStore` — and on purpose. You read signals directly; the Preact runtime tracks each read.

## Mode A vs Mode B

| | Mode A (singleton) | Mode B (Provider) |
|---|---|---|
| Where | `signalStore(...)` at module scope | `createStoreContext(factory)` |
| Instances | One per process | One per Provider mount |
| Boilerplate | Zero React | `<Provider>` wrapper + `useStore()` |
| Use for | Global singletons (auth, theme) | Scoped, per-subtree, prop-seeded stores |

The two modes coexist — choose per store, not per app.

## FAQ

**Does `useStore` accept a selector?**
No. Read signals directly inside JSX; with `@preact/signals-react` each read is a fine-grained subscription.

**How does `withHooks` interact with the Provider?**
`onInit` fires when the factory returns (during mount). `onDestroy` fires when the Provider unmounts (automatically, via the internal `destroyStore` call). You never call `destroyStore` yourself.

**SSR-safe?**
The Provider uses `useState` lazy init, theoretically SSR-compatible but **not yet tested**. SSR is on the v2 roadmap.

**Debounced / cancellable async in a method?**
Use `rxMethod` inside `withMethods` — pipelines tear down automatically on Provider unmount.

## API

```ts
createStoreContext<Store, Props = void>(
  factory: (props: Props) => Store,
): {
  Provider: React.FC<React.PropsWithChildren<Props>>;
  useStore: () => Store;
}
```

That's the entire surface.
