# `@fluch/signal-store-entities` — entity collections reference

Normalized entity collections (`ids` + `entityMap` + derived `entities` signal) with NgRx-style updaters that compose with `patchState`.

Peer deps: `@fluch/signal-store`, `@preact/signals-core`.

## `entityConfig<E, C extends string = ''>(opts?)`

```ts
entityConfig<E, C extends string = ''>(opts?: {
  collection?: C;                          // default: '' (mono-collection)
  selectId?: (entity: E) => string | number; // default: e => e.id
  sortComparer?: (a: E, b: E) => number;   // optional, opt-in sort
}): EntityConfig<E, C>
```

Capture once in a `const`. Pass it to `withEntities` **and** every updater — the config is the single source of truth for the collection prefix, id selector, and sort order.

```ts
type Todo = { id: string; title: string; done: boolean };
const todosCfg = entityConfig<Todo>();
// → mono-collection: store.ids, store.entityMap, store.entities

type User = { uuid: string; name: string };
const usersCfg = entityConfig<User, 'users'>({
  collection: 'users',
  selectId: (u) => u.uuid,
});
// → multi-collection: store.usersIds, store.usersEntityMap, store.usersEntities
```

## `withEntities(cfg)`

```ts
withEntities<E, C extends string>(
  cfg: EntityConfig<E, C>,
): SignalStoreFeature<{}, EntityFeatureOutput<E, C>>
```

Adds to the store, keys derived from the prefix `C`:

- `<C>Ids: ReadonlySignal<EntityId[]>` (or `ids` if `C = ''`) — insertion order.
- `<C>EntityMap: ReadonlySignal<Record<EntityId, E>>` (or `entityMap`) — O(1) lookup.
- `<C>Entities: ReadonlySignal<E[]>` (or `entities`) — `ids.map(id => map[id])`, sorted by `cfg.sortComparer` if defined.

Multiple `withEntities` in one store: OK as long as collection names differ.

```ts
const store = signalStore(
  withEntities(todosCfg),
  withEntities(usersCfg),
);

store.ids.value;            // todos ids
store.entities.value;       // todos
store.usersIds.value;       // users ids
store.usersEntities.value;  // users
```

## Updaters

All updaters return a `CollectionUpdater<E, C>` — a closure to hand to `patchState`. The `cfg` argument is **always required**.

### add — append, no-op on duplicates

```ts
addEntity<E, C>(entity: E, cfg): CollectionUpdater<E, C>
addEntities<E, C>(entities: readonly E[], cfg): CollectionUpdater<E, C>
```

`addEntity` is a no-op if `selectId(e)` is already present. Use `setEntity` for upsert.

```ts
patchState(store, addEntity({ id: 't1', title: 'first', done: false }, todosCfg));
patchState(store, addEntities([t1, t2, t3], todosCfg));
```

### set — upsert

```ts
setEntity<E, C>(entity: E, cfg): CollectionUpdater<E, C>           // upsert one
setEntities<E, C>(entities: readonly E[], cfg): CollectionUpdater<E, C>  // upsert many
setAllEntities<E, C>(entities: readonly E[], cfg): CollectionUpdater<E, C>  // replace ALL
```

```ts
patchState(store, setEntity(todo, todosCfg));
patchState(store, setAllEntities(loadedTodos, todosCfg)); // wipe + reload
```

### update — patch existing

```ts
updateEntity<E, C>(
  update: { id: EntityId; changes: Partial<E> | ((e: E) => Partial<E>) },
  cfg,
): CollectionUpdater<E, C>

updateEntities<E, C>(
  updates: ReadonlyArray<{ id: EntityId; changes: Partial<E> | ((e: E) => Partial<E>) }>,
  cfg,
): CollectionUpdater<E, C>

updateAllEntities<E, C>(
  changes: Partial<E> | ((e: E) => Partial<E>),
  cfg,
): CollectionUpdater<E, C>
```

`updateEntity` is a **silent no-op** when the id is unknown — no throw, no log.

```ts
patchState(store, updateEntity({ id: 't1', changes: { done: true } }, todosCfg));
patchState(store, updateEntity({ id: 't1', changes: (t) => ({ done: !t.done }) }, todosCfg));
patchState(store, updateEntities([
  { id: 'a', changes: { done: true } },
  { id: 'b', changes: { title: 'B!' } },
], todosCfg));
patchState(store, updateAllEntities({ done: true }, todosCfg));
```

### remove

```ts
removeEntity<E, C>(id: EntityId, cfg): CollectionUpdater<E, C>
removeEntities<E, C>(ids: readonly EntityId[], cfg): CollectionUpdater<E, C>  // unknown ids ignored
removeAllEntities<E, C>(cfg): CollectionUpdater<E, C>
```

No predicate form — compute the id list upstream:

```ts
const doneIds = store.entities.value.filter((t) => t.done).map((t) => t.id);
patchState(store, removeEntities(doneIds, todosCfg));
```

## `add` vs `set` — the subtle difference

Both add an entity if its id is new. They diverge when the id already exists:

- `addEntity` → no-op (existing entity unchanged).
- `setEntity` → replaces (overwrites with the new entity).

Use `setEntity` / `setEntities` when loading from a server (idempotent upsert). Use `addEntity` when you must guarantee no overwrite of local state.

## Sort comparator

```ts
const todosCfg = entityConfig<Todo>({
  sortComparer: (a, b) => a.dueDate - b.dueDate,
});

store.entities.value; // sorted by dueDate ascending
```

- The comparator runs at read time on the derived `<C>Entities` signal, memoized by the underlying `computed`. Internal `<C>Ids` order is unchanged.
- The comparator must depend only on `a` and `b` — capturing an external reactive value (`Signal`) won't re-sort when that value changes.
- For dynamic sort, build it yourself in `withComputed`.
- `Array.prototype.sort` is stable since ES2019, so equal items keep insertion order.

## Complete example — todos + users in one store

```ts
import { signalStore, withComputed, withMethods, patchState } from '@fluch/signal-store';
import {
  entityConfig,
  withEntities,
  addEntity,
  updateEntity,
  removeEntity,
  setAllEntities,
} from '@fluch/signal-store-entities';
import { computed } from '@preact/signals-core';

type Todo = { id: string; title: string; done: boolean };
type User = { uuid: string; name: string };

const todosCfg = entityConfig<Todo>();
const usersCfg = entityConfig<User, 'users'>({
  collection: 'users',
  selectId: (u) => u.uuid,
});

export const appStore = signalStore(
  withEntities(todosCfg),
  withEntities(usersCfg),

  withComputed(({ entities }) => ({
    pendingTodos: computed(() => entities.value.filter((t) => !t.done)),
  })),

  withMethods((s) => ({
    addTodo: (t: Todo) => patchState(s, addEntity(t, todosCfg)),
    toggle: (id: string) =>
      patchState(s, updateEntity({ id, changes: (t) => ({ done: !t.done }) }, todosCfg)),
    remove: (id: string) => patchState(s, removeEntity(id, todosCfg)),
    loadAll: (todos: Todo[]) => patchState(s, setAllEntities(todos, todosCfg)),
    addUser: (u: User) => patchState(s, addEntity(u, usersCfg)),
  })),
);
```

## Filtering & derived views

`sortComparer` is the only built-in derivation. For filtering, grouping, or any non-total ordering, derive from `entities` in `withComputed`:

```ts
withComputed(({ entities }) => ({
  pending: computed(() => entities.value.filter((t) => !t.done)),
  byTitle: computed(() => [...entities.value].sort((a, b) => a.title.localeCompare(b.title))),
}))
```

## Bundle size

~1.3kb gzip. Tree-shakeable — unused updaters drop out.
