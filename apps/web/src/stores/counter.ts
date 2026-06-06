import { patchState, signalStore, withComputed, withMethods, withState } from "@fluch/signal-store"
import { computed } from "@preact/signals-core"

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
)
