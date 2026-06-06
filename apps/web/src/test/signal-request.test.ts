import { describe, expect, it, vi } from "vitest"
import { asSignalRequest, type HttpError } from "@/lib/signal-request"

describe("asSignalRequest", () => {
  it("flips loading puis remplit data sur 200", async () => {
    const call = vi.fn().mockResolvedValue({ status: 200, body: { ok: true } })
    const store = asSignalRequest<void, { status: 200; body: { ok: true } }>(call)

    expect(store.loading.value).toBe(false)
    expect(store.data.value).toBeNull()
    expect(store.error.value).toBeNull()

    store.execute()
    expect(store.loading.value).toBe(true)

    await vi.waitFor(() => expect(store.loading.value).toBe(false))
    expect(store.data.value).toEqual({ ok: true })
    expect(store.error.value).toBeNull()
    expect(call).toHaveBeenCalledTimes(1)
  })

  it("stocke une HttpError sur status non-2xx (avec status + body)", async () => {
    const call = vi.fn().mockResolvedValue({ status: 500, body: { message: "oops" } })
    const store = asSignalRequest<
      void,
      { status: 200; body: unknown } | { status: 500; body: { message: string } }
    >(call)

    store.execute()
    await vi.waitFor(() => expect(store.loading.value).toBe(false))

    expect(store.data.value).toBeNull()
    const err = store.error.value as HttpError
    expect(err).toBeInstanceOf(Error)
    expect(err.status).toBe(500)
    expect(err.body).toEqual({ message: "oops" })
  })

  it("capture l'erreur si la promesse rejette", async () => {
    const call = vi.fn().mockRejectedValue(new Error("network down"))
    const store = asSignalRequest<void, { status: 200; body: unknown }>(call)

    store.execute()
    await vi.waitFor(() => expect(store.loading.value).toBe(false))

    expect(store.data.value).toBeNull()
    expect(store.error.value).toBeInstanceOf(Error)
    expect((store.error.value as Error).message).toBe("network down")
  })

  it("reset() remet l'état initial", async () => {
    const call = vi.fn().mockResolvedValue({ status: 200, body: "x" })
    const store = asSignalRequest<void, { status: 200; body: string }>(call)

    store.execute()
    await vi.waitFor(() => expect(store.data.value).toBe("x"))

    store.reset()
    expect(store.data.value).toBeNull()
    expect(store.error.value).toBeNull()
    expect(store.loading.value).toBe(false)
  })
})
