import { createApiClient } from "@fluch/api-contracts/client"

export const api = createApiClient(import.meta.env.VITE_API_BASE_URL ?? "/api")
