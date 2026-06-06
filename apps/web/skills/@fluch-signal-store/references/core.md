# `@fluch/signal-store` — core API reference

Full surface of the core package: feature composers, state mutation, lifecycle hooks, async side-effects, signal/observable interop.

Peer deps: `@preact/signals-core`, `rxjs`.

## Feature composers

### `signalStore(...features) → Store`

Compose features into a plain object store. Max **10 features per call** (TS inference limit). Beyond, factor into composed sub-features.

```ts
import { signalStore, withState, withComputed, withMethods } from '@fluch/signal-store';

const store = signalStore(
  withState({ ... }),
  withComputed(...),
  withMethods(...),
);
```

Collision of keys (state vs computed vs method) throws at runtime.

### `withState(initial)`

```ts
withState<S extends Record<string, unknown>>(initial: S): SignalStoreFeature
```

One signal per top-level key. Nested objects are **atomic** — use `patchState` to update them.

```ts
withState({ count: 0, user: { name: 'foo' } })
// store.count : Signal<number>
// store.user  : Signal<{ name: string }>  ← whole object, not deep signals
```

Dev-only: state is deep-frozen via `Object.freeze`.

### `withComputed(fn)`

```ts
withComputed<C extends Record<string, ReadonlySignal<unknown>>>(
  fn: (store: ReadonlyStore) => C,
): SignalStoreFeature
```

`fn` receives state + earlier computed signals (no methods). Returns `{ key: computed(...) }`.

```ts
withComputed(({ count }) => ({
  double: computed(() => count.value * 2),
}))
```

### `withMethods(fn)`

```ts
withMethods<M extends Record<string, (...args: any[]) => any>>(
  fn: (store: StoreWithSignals) => M,
): SignalStoreFeature
```

`fn` receives state + computed (no methods yet). Returns plain methods.

```ts
withMethods((s) => ({
  increment: () => patchState(s, { count: s.count.value + 1 }),
}))
```

Methods are synchronous by convention. For async, wrap in IIFE or use `rxMethod`.

## State mutation

### `patchState(store, ...updates)`

```ts
type StateUpdater<S> = (current: S) => Partial<S>;

patchState<S>(store, update: Partial<S> | StateUpdater<S>): void
patchState<S>(store, ...updates: (Partial<S> | StateUpdater<S>)[]): void
```

- Partial object, function `current → partial`, or variadic list of updates.
- Only keys declared via `withState` / `withEntities` are written. Unknown keys are silently dropped.
- After `destroyStore(store)`: silent no-op.

```ts
patchState(store, { count: 5 });
patchState(store, (s) => ({ count: s.count + 1 }));
patchState(store, addEntity(todo, cfg), { filter: 'all' }); // composes entity updaters
```

## Lifecycle

### `withHooks({ onInit?, onDestroy? })`

```ts
interface HooksConfig<In extends object> {
  onInit?: (store: In) => void;
  onDestroy?: (store: In) => void;
}

withHooks<In extends object>(hooks: HooksConfig<In>): SignalStoreFeature<In, {}>
```

- `onInit` fires **after** all features are composed. The `store` passed is the full final object — can `patchState`, can read computed, can call methods.
- `onDestroy` fires when `destroyStore(store)` runs (also automatically on React `<Provider>` unmount). The store is still live when `onDestroy` runs.
- Multiple `withHooks` in one store: `onInit` in composition order, `onDestroy` in **reverse** (LIFO).
- **Synchronous only**: `async () => ...` is a TS error. For fire-and-forget, wrap explicitly.

```ts
withHooks({
  onInit(s) {
    patchState(s, { count: 1 });
    // fire-and-forget async:
    void (async () => {
      const data = await fetchInitial();
      patchState(s, { data });
    })();
  },
  onDestroy(s) {
    console.log('final:', s.count.value);
  },
})
```

For cancellable async pipelines, use `rxMethod` (below) instead of IIFE.

### `destroyStore(store)`

```ts
destroyStore(store: object): void
```

Tear down internal RxJS subscriptions and `mutations$` / `state$`. Idempotent. Post-destroy: signals keep their last value, `patchState` is silent no-op.

You **rarely** call this in app code:
- React `<Provider>`: automatic on unmount.
- Module-scoped singleton store: lives as long as the app, never destroyed.

Manual call is mostly for test isolation.

## Async side-effects

### `rxMethod(store, generator)`

```ts
type RxMethod<Input> = (
  input: Input | Signal<Input> | ReadonlySignal<Input> | Observable<Input>,
) => Subscription;

rxMethod<Input>(
  store: object,
  generator: (source$: Observable<Input>) => Observable<unknown>,
): RxMethod<Input>
```

Wires an RxJS pipeline into a method. The pipeline subscribes **once**, every invocation pushes into a shared `Subject<Input>` — stateful operators (`debounceTime`, `switchMap`, etc.) behave correctly between calls.

**Used inside `withMethods`**, not at the top level of `signalStore`. The first arg is the store the callback receives.

```ts
import { rxMethod, signalStore, withState, withMethods, patchState } from '@fluch/signal-store';
import { debounceTime, switchMap, tap } from 'rxjs/operators';
import { from } from 'rxjs';

const store = signalStore(
  withState({ user: null as User | null, loading: false }),
  withMethods((s) => ({
    loadUser: rxMethod<string>(s, (id$) =>
      id$.pipe(
        tap(() => patchState(s, { loading: true })),
        debounceTime(200),
        switchMap((id) => from(api.loadUser(id))),
        tap((user) => patchState(s, { user, loading: false })),
      ),
    ),
  })),
);

store.loadUser('id-123');         // scalar
store.loadUser(searchSignal);     // signal — re-fires on every change
store.loadUser(idObservable$);    // observable — forwards each emission
```

**Three input shapes** (all feed the same pipeline):
- **Scalar**: pushed once. Returns `Subscription.EMPTY`.
- **Signal / ReadonlySignal**: current value pushed immediately, then on every change. Returned `Subscription` controls the binding (`unsubscribe()` to stop without destroying the store).
- **Observable**: every emission forwarded. Source completion does **not** complete the pipeline.

**Cleanup**: pipeline subscription + every per-invocation binding registered on `meta.cleanup`. Tear down on `destroyStore` (or React unmount). Post-destroy invocations: silent no-op returning `Subscription.EMPTY`.

**Error handling**: an unhandled pipeline error terminates the subscription (standard RxJS). Use `catchError` **inside** the inner Observable (the one returned by `switchMap`/`mergeMap`), not at top level — otherwise one error kills the method for the whole session.

```ts
search: rxMethod<string>(s, (q$) =>
  q$.pipe(
    debounceTime(200),
    switchMap((q) =>
      from(api.search(q)).pipe(
        catchError((err) => {
          patchState(s, { error: String(err) });
          return EMPTY; // swallow — pipeline stays alive
        }),
      ),
    ),
    tap((results) => patchState(s, { results, error: null })),
  ),
)
```

### `toObservable(signal)`

```ts
toObservable<T>(sig: Signal<T> | ReadonlySignal<T>): Observable<T>
```

Wraps a Preact signal as cold `Observable<T>`. On subscribe: emits current value synchronously, then every change. Unsubscribe releases the underlying signal subscription.

Used by `rxMethod` internally. Exposed for composing signals in wider RxJS chains:

```ts
import { toObservable } from '@fluch/signal-store';
import { combineLatest, map } from 'rxjs';

const sum$ = combineLatest([toObservable(a), toObservable(b)]).pipe(
  map(([x, y]) => x + y),
);
```

### `toSignal(source, initial)` — Observable → Signal

Inverse of `toObservable`. Two overloads:

```ts
// Standalone — [sig, dispose] tuple, caller owns the lifetime
toSignal<T>(source: Observable<T>, initial: T): readonly [ReadonlySignal<T>, () => void]

// Store-aware — subscription auto-cleaned up on destroyStore
toSignal<T>(store: object, source: Observable<T>, initial: T): ReadonlySignal<T>
```

```ts
import { interval, take } from 'rxjs';
import { toSignal } from '@fluch/signal-store';

// Standalone — useState-style tuple
const [counter, disposeCounter] = toSignal(interval(100).pipe(take(3)), -1);
counter.value;     // -1, then 0, 1, 2
disposeCounter();  // release inner sub; idempotent

// Store-aware (inside withMethods, store-bound cleanup)
const width = toSignal(store, fromEvent(window, 'resize').pipe(map(() => window.innerWidth)), window.innerWidth);
// no dispose returned — destroyStore (or React unmount) tears it down
```

- `signal.value = initial` synchronously at call time.
- `next` → updates the signal.
- `error` → `console.error`, signal keeps last value (never throws).
- `complete` → signal keeps last value, inner sub released.
- Store-aware on a destroyed store: returns signal at `initial` without subscribing.

## Internal subpath

`@fluch/signal-store/internal` exposes `getMeta` for tooling that needs the internal pipeline (used by `@fluch/signal-store-devtools`). Not part of the public surface — convention follows Vue/Vite.

## Bundle size

Core ~1.3kb gzip. Tree-shakeable — unused features (e.g. `rxMethod`) drop out.
