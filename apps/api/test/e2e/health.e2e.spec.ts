import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { getHttpServer } from './helpers/app'

describe('Health e2e', () => {
  it('GET /health → 200 + status ok + db up + memory_heap up', async () => {
    const res = await request(getHttpServer()).get('/health').expect(200)

    expect(res.body.status).toBe('ok')
    expect(res.body.info?.db?.status).toBe('up')
    expect(res.body.info?.memory_heap?.status).toBe('up')
    expect(res.body.details?.db?.status).toBe('up')
  })
})
