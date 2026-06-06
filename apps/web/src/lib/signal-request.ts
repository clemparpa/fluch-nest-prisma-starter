import { patchState, rxMethod, signalStore, withMethods, withState } from "@fluch/signal-store"
import { catchError, EMPTY, from, switchMap, tap } from "rxjs"

type TsRestSuccess<R> = R extends { status: infer S; body: infer B }
  ? S extends 200 | 201 | 204
    ? B
    : never
  : never

export type HttpError = Error & { status: number; body: unknown }

export function asSignalRequest<TArgs, R extends { status: number; body: unknown }>(
  call: (args: TArgs) => Promise<R>,
) {
  return signalStore(
    withState<{
      data: TsRestSuccess<R> | null
      loading: boolean
      error: Error | null
    }>({
      data: null,
      loading: false,
      error: null,
    }),
    withMethods((store) => ({
      execute: rxMethod<TArgs>(store, (args$) =>
        args$.pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap((args) =>
            from(call(args)).pipe(
              tap((res) => {
                if (res.status >= 200 && res.status < 300) {
                  patchState(store, {
                    data: res.body as TsRestSuccess<R>,
                    loading: false,
                  })
                } else {
                  const err = Object.assign(new Error(`HTTP ${res.status}`), {
                    status: res.status,
                    body: res.body,
                  }) as HttpError
                  patchState(store, { error: err, loading: false })
                }
              }),
              catchError((err: unknown) => {
                const error = err instanceof Error ? err : new Error(String(err))
                patchState(store, { error, loading: false })
                return EMPTY
              }),
            ),
          ),
        ),
      ),
      reset: () => patchState(store, { data: null, error: null, loading: false }),
    })),
  )
}
