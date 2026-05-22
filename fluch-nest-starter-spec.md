# Spec — Template backend `fluch-nest-starter`

Spec implémentable destinée au développeur qui va bootstrapper le repo. Toutes les décisions de stack et de design sont **lockées** sauf mention explicite "ouvert". Le développeur ne doit pas avoir à choisir entre alternatives — la spec tranche partout.

Repo cible : `fluch-nest-starter` (monorepo pnpm). Layout : `apps/api/` + `packages/api-contracts/` + `packages/tsconfig/` + `packages/biome-config/`. Conçu pour accueillir un `apps/web/` ultérieurement sans refactor structurel.

## 1. Objectif

Template backend "tout-terrain" Node.js, prêt à brancher sur n'importe quel projet, production-ready dès le clone :

- API HTTP REST avec NestJS bien structuré (modules, contrats TS-Rest, filters, interceptors, guards)
- API type-safe end-to-end via TS-Rest (contrats partagés `packages/api-contracts/`)
- Persistence Postgres via Prisma 7
- Multi-tenant isolation native via Prisma Client Extension + AsyncLocalStorage
- RBAC complet via better-auth `createAccessControl` + plugins `organization` & `admin`
- Hooks better-auth découplés via `@nestjs/event-emitter`
- Authentification email/password + sessions via better-auth (sans OAuth providers pré-câblés)
- Observabilité minimale : logger structuré JSON, health check
- Tests e2e avec Postgres réel — pas de mocks DB
- Tooling complet : lint, format, typecheck, audit, pre-commit
- Image Docker prête à brancher sur un docker-compose multi-services
- Architecture **monorepo pnpm** : back + futurs front + packages partagés cohabitent nativement

Ce template doit pouvoir cohabiter dans un monorepo avec `fluch-react-signals-starter` (template frontend) sans que les hooks Husky ou les workflows GitHub Actions se collisionnent. Voir §10.

## 2. Stack lockée

| Concern | Tech | Version cible |
|---|---|---|
| Framework | NestJS | ^11.0 |
| Runtime | Node.js | 22 LTS |
| Package manager | pnpm | 9.x |
| Language | TypeScript | ^5.5 (strict mode) |
| ORM | Prisma | ^7.0 |
| DB | Postgres | 16 |
| Auth | better-auth | latest (^1.0+) |
| Auth integration | `@thallesp/nestjs-better-auth` + plugins (`organization`, `admin`) | latest |
| API routing | NestJS + `@ts-rest/nest` (contrats partagés `packages/api-contracts/`) | `@ts-rest/*` ^3.x |
| Multi-tenant | Prisma Client Extension + `node:async_hooks` (ALS) | natif Node 22 / Prisma 7 |
| Events | `@nestjs/event-emitter` | ^2.x |
| Config | `@nestjs/config` + `zod` | NestJS 11 compatible + Zod 3.x |
| Logger | `ConsoleLogger` natif (`@nestjs/common`) | NestJS 11 (`json` + `colors` + `logLevels` natifs depuis v11) |
| Validation | Zod (via `nestjs-zod` + `prisma-zod-generator`) | Zod ^3.x, nestjs-zod ^4.x |
| Sécurité | `helmet`, CORS natif Nest, `csurf` (via better-auth) | latest |
| Compression | `compression` middleware Express | latest |
| OpenAPI doc | `@ts-rest/open-api` (généré depuis les contrats TS-Rest) | ^3.x |
| Throttling | `@nestjs/throttler` | latest (in-memory v1) |
| Health | `@nestjs/terminus` | latest |
| Auto-updates | Dependabot (GitHub natif) | — |
| Testing | Vitest + Supertest (+ Testcontainers en S8.11) | Vitest ^3.0, `unplugin-swc`, `@testcontainers/postgresql` |
| Lint + Format | Biome | ^1.9 (rules `nursery` activées pour `noFloatingPromises`) |
| Pre-commit | Husky + lint-staged | latest |
| CI | GitHub Actions | — |
| Container | Multi-stage Dockerfile, base `node:22-alpine` puis `gcr.io/distroless/nodejs22-debian12` | — |

**Versions épinglées strictement** dans `package.json` (utiliser `^x.y.0` pour permettre patch updates uniquement). Lockfile (`pnpm-lock.yaml`) committé.

## 3. Décisions de design lockées

1. **Layout monorepo pnpm** : `apps/api/` pour le back, `packages/api-contracts/` pour les contrats TS-Rest partagés, `packages/tsconfig/` et `packages/biome-config/` pour la config partagée. Aucun chemin racine `src/*` n'est utilisé pour du code applicatif.
2. **OAuth providers NON câblés en v1** : better-auth les supporte natif, à activer par projet selon besoins.
3. **Tests = Postgres réel via Testcontainers**. Pas de mocks Prisma. Reason : éviter la divergence mock/prod qui a déjà mordu par le passé.
4. **Migrations en CI = job séparé**, pas au boot du container. Plus sûr en prod.
5. **Throttling in-memory** (pas de Redis). Suffisant pour démarrer ; Redis sera ajouté par projet selon scale.
6. **Logger structuré** : `ConsoleLogger` natif Nest 11 avec `json: true` en prod et `colors: true` en dev. Niveau pilotable via `LOG_LEVEL`. Propagation `req.id` gérée par un `RequestIdInterceptor` (cf. §5.12bis), pas par le logger lui-même.
7. **Auth = email + password + sessions cookies**. Pas de JWT. Sessions stockées en DB via better-auth.
8. **Distroless en runtime** : moins de surface d'attaque, image < 200MB, pas de shell embarqué.
9. **TypeScript strict** : `"strict": true`, `"noUncheckedIndexedAccess": true`, `"exactOptionalPropertyTypes": true`.
10. **Biome** comme unique outil lint + format (au lieu d'ESLint + Prettier). Tradeoff connu : lint type-aware moins mature, on active `noFloatingPromises` en nursery pour couvrir le cas critique des controllers async NestJS. Pas de format MD/YAML en pre-commit — l'éditeur s'en charge.
11. **API versioning par URI** : toutes les routes préfixées `/v1/*` via `app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })`. Permet évolution non-breaking.
12. **Pagination = offset/limit** avec DTO réutilisable (`PaginationDto`). Cursor-based laissé en hors-scope v1 — simple à ajouter quand un cas le justifie.
13. **OpenAPI/Swagger actif** : UI exposée sur `/docs` en dev, désactivée en prod. `swagger.json` toujours exporté à `/docs-json` (utile pour générer un client typé côté frontend `fluch-react-signals-starter`).
14. **CSRF protection activée** via better-auth (l'API émet et vérifie un token sur les routes mutantes). Cookies de session marqués `httpOnly`, `secure` en prod, `sameSite: 'lax'`.
15. **Trust proxy** : `app.set('trust proxy', 1)` car on tourne typiquement derrière un reverse proxy (k8s ingress, Render, Fly, etc.). Sans ça, le throttler rate-limite tout le monde sur l'IP du proxy.
16. **Body size limit** : `1mb` par défaut (JSON), `5mb` pour les routes upload (si v2). Au-dessus → 413 explicite.
17. **Container nonroot** : utiliser le tag `gcr.io/distroless/nodejs22-debian12:nonroot` + `USER nonroot:nonroot` dans le Dockerfile. Différence sécu réelle.
18. **Dependabot activé** dès le démarrage (config dans `.github/dependabot.yml`). Auto-PR pour npm + GitHub Actions + Docker base image.
19. **Conventional commits + commitlint** : enforced via hook `commit-msg` Husky. Permet génération automatique du changelog (`@changesets/cli` ou `release-please`, à choisir).
20. **Licence** : MIT par défaut (la plus permissive, neutre pour un template). À swapper si projet privé.
21. **Pre-push hook** : exécute `pnpm typecheck` + `pnpm test` sur fichiers staged. Bloque le push si fail. Garde-fou avant CI distante.
22. **Migration strategy** : `prisma migrate deploy` exécuté en job CI dédié (avant le deploy de l'image), pas dans le container au boot. Plus de détails §13.
23. **Request-id propagé en header de réponse** (`x-request-id`). Si le client en envoie un, on le réutilise ; sinon, on en génère un. Permet le tracing cross-tier.
24. **Sentry placeholder dans `main.ts`** : `if (env.SENTRY_DSN) Sentry.init(...)`. Pas de provider câblé, mais le plumbing est là — activable sans refactor.
25. **API routing via TS-Rest** (`@ts-rest/nest`). Tous les modules métier exposent un contrat dans `packages/api-contracts/`. Les controllers utilisent `@TsRestHandler(contract.xxx)` + `tsRestHandler()`. Préserve REST standard (clients non-TS, OpenAPI, webhooks).
26. **Validation runtime via Zod** (auto-généré depuis Prisma par `prisma-zod-generator`). Pipe global `ZodValidationPipe` de `nestjs-zod`. Plus de `class-validator`/`class-transformer`.
27. **Multi-tenant isolation par défaut** via Prisma Client Extension + `AsyncLocalStorage`. Tout modèle avec colonne `organizationId` (détecté runtime via `Prisma.dmmf`) voit son `where` ou `data` automatiquement augmenté. Bypass possible **uniquement** via `runAsAdmin()` ou injection explicite de `UnsafePrismaService`. Lint rule bloque l'injection accidentelle. Cf. [fluch-nest-starter-tenant-extension.md](fluch-nest-starter-tenant-extension.md).
28. **RBAC via better-auth** : `createAccessControl` définit les statements + roles, branchés sur les plugins `organization` et `admin`. Décorateurs `@Roles`/`@OrgRoles`/`@UserHasPermission`/`@MemberHasPermission` (via `@thallesp/nestjs-better-auth`). **Séparation system/org volontaire** (anti privilege-escalation).
29. **Hooks better-auth découplés** via `@nestjs/event-emitter`. Un seul `@AfterCreate('user')` qui emit `user.created`, N listeners dans `auth/listeners/*.ts`. Pattern pub/sub Nest classique.

## 4. Structure du repo

```text
fluch-nest-starter/
├── .github/
│   ├── workflows/
│   │   ├── ci-api.yml                  # paths filter apps/api + packages partagés
│   │   ├── ci-contracts.yml            # paths filter packages/api-contracts (build + typecheck)
│   │   └── audit.yml                   # pnpm audit hebdo + sur PR
│   ├── dependabot.yml                  # 4 blocs npm : root + apps/api + packages/api-contracts + packages/tsconfig
│   ├── CODEOWNERS
│   └── PULL_REQUEST_TEMPLATE.md
├── .husky/
│   ├── pre-commit                      # 1 ligne : pnpm exec lint-staged (racine)
│   ├── commit-msg                      # commitlint -e
│   └── pre-push                        # pnpm typecheck && pnpm test
├── .vscode/
├── apps/
│   └── api/
│       ├── prisma/
│       │   ├── schema.prisma           # User, Session, Account, Verification, Organization, Member, Invitation, Post
│       │   ├── seed.ts
│       │   └── migrations/
│       ├── src/
│       │   ├── main.ts
│       │   ├── app.module.ts
│       │   ├── config/
│       │   │   ├── env.schema.ts
│       │   │   └── config.module.ts
│       │   ├── common/
│       │   │   ├── decorators/
│       │   │   │   ├── current-user.decorator.ts
│       │   │   │   ├── public.decorator.ts
│       │   │   │   └── requires-org.decorator.ts        # NEW S8.6
│       │   │   ├── filters/
│       │   │   ├── interceptors/
│       │   │   └── guards/
│       │   ├── prisma/
│       │   │   ├── prisma.module.ts                     # provider PRISMA + InjectPrisma
│       │   │   ├── unsafe-prisma.service.ts             # ex-PrismaService renommé S8.6
│       │   │   └── tenant-extension.ts                  # NEW S8.6
│       │   ├── tenant/
│       │   │   ├── tenant.storage.ts                    # ALS + runAsAdmin
│       │   │   └── tenant.interceptor.ts                # APP_INTERCEPTOR global
│       │   ├── auth/
│       │   │   ├── auth.module.ts
│       │   │   ├── auth.controller.ts
│       │   │   ├── auth.service.ts
│       │   │   ├── auth.config.ts                       # + plugins organization, admin
│       │   │   ├── permissions.ts                       # createAccessControl + roles
│       │   │   ├── events.ts                            # types des events Nest
│       │   │   ├── http-adapter.ts
│       │   │   ├── hooks/
│       │   │   │   └── user-created.hook.ts             # @AfterCreate → emit user.created
│       │   │   └── listeners/
│       │   │       └── create-default-org.listener.ts   # @OnEvent('user.created')
│       │   ├── users/                                   # refacto TS-Rest en S8.4
│       │   │   ├── users.module.ts
│       │   │   ├── users.controller.ts                  # @TsRestHandler(usersContract.xxx)
│       │   │   └── users.service.ts
│       │   ├── posts/                                   # NEW S8.8 - module exemple tenant-scoped
│       │   │   ├── posts.module.ts
│       │   │   ├── posts.controller.ts                  # @RequiresOrg + permissions
│       │   │   └── posts.service.ts                     # @InjectPrisma + ownership
│       │   ├── observability/
│       │   │   └── sentry.ts
│       │   └── health/
│       ├── test/
│       │   ├── setup.ts                                 # bootstrap unique INestApplication (S8.2)
│       │   ├── tsconfig.json
│       │   ├── unit/
│       │   │   └── tenant-extension.spec.ts            # battle-tested S8.6
│       │   └── e2e/
│       │       ├── auth.e2e.spec.ts
│       │       ├── auth-rbac.e2e.spec.ts                # S8.5
│       │       ├── auth-hooks.e2e.spec.ts               # S8.7
│       │       ├── users.e2e.spec.ts
│       │       ├── tenant-isolation.e2e.spec.ts         # S8.6
│       │       ├── posts.e2e.spec.ts                    # S8.8
│       │       └── health.e2e.spec.ts                   # S09
│       ├── docker/Dockerfile
│       ├── package.json                                 # name: @fluch/api
│       ├── tsconfig.json                                # extends @fluch/tsconfig/api
│       ├── tsconfig.build.json
│       ├── vitest.config.ts
│       └── nest-cli.json
├── packages/
│   ├── api-contracts/
│   │   ├── src/
│   │   │   ├── users/
│   │   │   │   ├── contract.ts                          # TS-Rest contract
│   │   │   │   └── schemas.ts                           # Zod schemas
│   │   │   ├── posts/
│   │   │   │   ├── contract.ts
│   │   │   │   └── schemas.ts
│   │   │   ├── common/
│   │   │   │   └── pagination.schema.ts                 # PaginationSchema Zod réutilisable
│   │   │   └── index.ts                                 # barrel export
│   │   ├── package.json                                 # name: @fluch/api-contracts
│   │   └── tsconfig.json
│   ├── tsconfig/
│   │   ├── base.json
│   │   ├── api.json                                     # extends base, + decorators metadata
│   │   └── package.json                                 # name: @fluch/tsconfig
│   └── biome-config/
│       ├── biome.json
│       └── package.json                                 # name: @fluch/biome-config
├── docker-compose.dev.yml                               # postgres 16 + adminer
├── biome.json                                           # racine, extends @fluch/biome-config
├── commitlint.config.mjs
├── package.json                                         # workspace root, scripts délégants --filter
├── pnpm-workspace.yaml                                  # packages: ['apps/*', 'packages/*']
├── pnpm-lock.yaml
├── tsconfig.json                                        # racine pour IDE seulement
├── LICENSE
├── CONTRIBUTING.md
└── README.md
```

## 5. Configuration des fichiers — détails non-obvious

### 5.1 `package.json` — scripts

```json
"scripts": {
  "build": "nest build",
  "start": "node dist/main.js",
  "dev": "nest start --watch",
  "lint": "biome lint .",
  "format": "biome format --write .",
  "check": "biome check .",
  "check:fix": "biome check --write .",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:cov": "vitest run --coverage",
  "prisma:generate": "prisma generate",
  "prisma:migrate": "prisma migrate dev",
  "prisma:deploy": "prisma migrate deploy",
  "prisma:studio": "prisma studio",
  "prepare": "node -e \"try { require('fs').accessSync('.git'); require('child_process').execSync('husky', {stdio:'inherit'}) } catch {}\""
}
```

`biome check` exécute lint + format check en un appel (utilisé en CI). `biome check --write` applique les deux en local / pre-commit.

**Le `prepare` script est CRITIQUE** : il installe Husky seulement si `.git/` existe au cwd (standalone). En monorepo, le template est dans `apps/api/`, pas de `.git/` à ce niveau → no-op silencieux.

### 5.2 `package.json` — lint-staged

```json
"lint-staged": {
  "*.{ts,js,mjs,json,jsonc}": ["biome check --write --no-errors-on-unmatched"],
  "prisma/schema.prisma": ["prisma format"]
}
```

Note : Biome ne formate ni le Markdown ni le YAML. C'est laissé à l'éditeur (extension Prettier ou Biome côté workspace). Pas de friction au commit.

### 5.3 `.husky/pre-commit`

```sh
pnpm exec lint-staged
```

Une seule ligne. Tout le reste vient de `lint-staged`.

### 5.4 `tsconfig.json` — options strictes

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

### 5.5 `biome.json` — config unique lint + format

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": { "enabled": true },
  "files": {
    "ignore": ["dist", "node_modules", "coverage", ".husky", "prisma/migrations"]
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": {
        "useImportType": "error",
        "noNonNullAssertion": "warn"
      },
      "suspicious": {
        "noExplicitAny": "warn",
        "noConsoleLog": "warn"
      },
      "correctness": {
        "noUnusedVariables": "error"
      },
      "nursery": {
        "noFloatingPromises": "error",
        "useAwait": "warn"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100,
    "lineEnding": "lf"
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "asNeeded",
      "trailingCommas": "all",
      "arrowParentheses": "always"
    }
  }
}
```

**Note rules `nursery`** : `noFloatingPromises` couvre le cas critique des controllers NestJS async où un `Promise` est ignoré. À surveiller au fil des releases Biome — quand la règle quitte `nursery`, la déplacer dans la catégorie stable correspondante.

### 5.6 `src/main.ts` — bootstrap exact

```ts
import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { ValidationPipe, VersioningType } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppLogger } from './logger/app-logger.service'
import { json } from 'express'
import helmet from 'helmet'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import { AppModule } from './app.module'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'
import { initSentry } from './observability/sentry'

async function bootstrap() {
  initSentry()

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  })

  app.useLogger(app.get(AppLogger))
  app.set('trust proxy', 1)
  app.use(helmet())
  app.use(compression())
  app.use(cookieParser())
  app.use(json({ limit: '1mb' }))
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? false,
    credentials: true,
  })
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  })
  app.useGlobalPipes(new ZodValidationPipe())  // nestjs-zod, depuis S8.1
  app.useGlobalFilters(new AllExceptionsFilter())
  app.enableShutdownHooks()

  // OpenAPI doc généré depuis les contrats TS-Rest via @ts-rest/open-api
  // (pas @nestjs/swagger natif — ne sait pas lire les Zod schemas)
  const openApiDoc = generateOpenApi(allContracts, {
    info: { title: 'fluch-api', version: '1.0' },
  })
  if (process.env.NODE_ENV !== 'production') {
    SwaggerModule.setup('docs', app, openApiDoc)  // SwaggerModule juste pour l'UI
  }
  // /docs-json toujours actif (idempotent — utile pour codegen front)
  app.getHttpAdapter().get('/docs-json', (_req, res) => res.json(openApiDoc))

  const port = process.env.PORT ?? 3000
  await app.listen(port)
}
bootstrap()
```

**Ordre important** :
1. `initSentry()` AVANT `NestFactory.create` pour capturer toutes les erreurs de boot
2. `helmet` AVANT `compression` (priorité aux security headers)
3. `cookieParser` AVANT `cors`/auth (cookies parsés avant que les guards ne vérifient)
4. `enableVersioning` AVANT `useGlobalPipes` (pour que les validations s'appliquent aux routes versionnées)

### 5.7 `src/config/env.schema.ts` — validation Zod

```ts
import { z } from 'zod'

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  CORS_ORIGIN: z.string().optional(),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  SENTRY_DSN: z.string().url().optional(),
  THROTTLE_TTL_MS: z.coerce.number().int().positive().default(60000),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),
})

export type Env = z.infer<typeof envSchema>
```

Brancher dans `ConfigModule.forRoot({ validate: (env) => envSchema.parse(env) })`.

**`DATABASE_URL` recommandée** : suffixer par `?connection_limit=10&pool_timeout=10` en prod (sinon Prisma sature sous charge). Documenté dans `.env.example`.

### 5.8 `src/common/filters/all-exceptions.filter.ts` — comportement

- Gère `HttpException` nativement (préserve status + payload)
- Map les erreurs Prisma :
  - `PrismaClientKnownRequestError` `P2002` (unique constraint) → 409 Conflict
  - `P2025` (record not found) → 404 Not Found
  - `P2003` (FK constraint failed) → 400 Bad Request
  - Autres `Prisma*Error` → 500 Internal Server Error
- Logge via `AppLogger` avec `{ requestId, userId?, path, method, statusCode, errorName }` (le `requestId` est récupéré depuis `req.id` posé par `RequestIdInterceptor` cf. §5.12bis)
- En production, masque le stack trace dans la réponse client
- Format de réponse uniforme :
  ```json
  { "statusCode": 409, "message": "Email already in use", "error": "Conflict" }
  ```

### 5.9 `src/auth/auth.config.ts` — config better-auth

```ts
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { PrismaClient } from '@prisma/client'

export function createAuth(prisma: PrismaClient, env: Env) {
  const isProd = env.NODE_ENV === 'production'
  return betterAuth({
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      minPasswordLength: 12,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5 min
      },
    },
    advanced: {
      cookiePrefix: 'fluch',
      useSecureCookies: isProd,
      crossSubDomainCookies: { enabled: false },
      defaultCookieAttributes: {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
      },
      // CSRF protection : better-auth vérifie un token sur les routes mutantes
      // (sign-out, update, etc.). Activé par défaut, à laisser actif.
    },
  })
}
```

**Cookies de session** : `httpOnly` toujours, `secure` en prod (HTTPS), `sameSite: 'lax'` (équilibre SSO / sécurité). Prefix `fluch-` pour isoler du cookie cross-app éventuel.

**CSRF** : better-auth protège nativement les routes mutantes via un token. Pour les routes mutantes hors-auth (ex : `PATCH /users/me`), c'est l'`AuthGuard` qui vérifie la session — si le cookie est `sameSite: lax`, le risque CSRF est mitigé (les navigateurs ne renvoient pas le cookie en cross-site POST). Pour passer à `sameSite: strict`, vérifier que le frontend ne fait pas d'appels via redirect.

### 5.10 `src/auth/http-adapter.ts` — Node ↔ Web request bridge

better-auth expose un `handler(Request): Promise<Response>` (Fetch API). NestJS donne `req: Express.Request, res: Express.Response`. Il faut convertir dans les deux sens. Implémentation type ~30 lignes :

```ts
import type { Request, Response } from 'express'

export function toWebRequest(req: Request): Request {
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) v.forEach(val => headers.append(k, val))
    else if (v) headers.set(k, v)
  }
  return new globalThis.Request(url, {
    method: req.method,
    headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
    duplex: 'half'
  } as RequestInit)
}

export async function sendNodeResponse(webRes: Response, nodeRes: import('express').Response) {
  nodeRes.status(webRes.status)
  webRes.headers.forEach((v, k) => nodeRes.setHeader(k, v))
  const body = await webRes.text()
  nodeRes.send(body)
}
```

### 5.11 `src/auth/auth.controller.ts`

```ts
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @All('api/auth/*')
  async handler(@Req() req: Request, @Res() res: Response) {
    const webReq = toWebRequest(req)
    const webRes = await this.authService.auth.handler(webReq)
    await sendNodeResponse(webRes, res)
  }
}
```

### 5.12 `src/common/guards/auth.guard.ts` — vérif session

```ts
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('public', [
      ctx.getHandler(), ctx.getClass()
    ])
    if (isPublic) return true

    const req = ctx.switchToHttp().getRequest<Request>()
    const session = await this.authService.auth.api.getSession({
      headers: toWebRequest(req).headers
    })
    if (!session) throw new UnauthorizedException()

    req['user'] = session.user
    req['session'] = session.session
    return true
  }
}
```

Brancher en `APP_GUARD` provider dans `app.module.ts` pour qu'il soit global.

### 5.12bis `src/common/interceptors/request-id.interceptor.ts`

Propage le `x-request-id` en header de réponse. Si le client en envoie un, on le réutilise (utile pour cross-tier tracing). Sinon, on en génère un avec `crypto.randomUUID()` (Node 22 natif). L'interceptor pose aussi l'ID sur `req.id` pour qu'il soit récupérable depuis le filter et les autres interceptors.

```ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Observable, tap } from 'rxjs'
import type { Request, Response } from 'express'

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request & { id?: string }>()
    const res = ctx.switchToHttp().getResponse<Response>()
    const id = (req.headers['x-request-id'] as string | undefined) ?? req.id
    if (id) res.setHeader('x-request-id', id)
    return next.handle().pipe(tap())
  }
}
```

Enregistrer en `APP_INTERCEPTOR` global dans `app.module.ts`.

### 5.12ter Pagination — Zod schema partagé

**Convention** : offset/limit. Cursor-based réservé pour v2. Schema partagé dans `packages/api-contracts/src/common/pagination.schema.ts`, réutilisé par tous les contrats TS-Rest qui paginent.

```ts
// packages/api-contracts/src/common/pagination.schema.ts
import { z } from 'zod'

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>

export const PaginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
  })
```

Usage dans un contrat TS-Rest (`packages/api-contracts/src/users/contract.ts`) :

```ts
import { PaginationQuerySchema, PaginatedResponseSchema } from '../common/pagination.schema'

export const usersContract = c.router({
  list: {
    method: 'GET',
    path: '/users',
    query: PaginationQuerySchema,
    responses: {
      200: PaginatedResponseSchema(UserResponseSchema),
      403: ErrorSchema,
    },
  },
  // ...
})
```

Côté controller Nest : pagination est extraite automatiquement par TS-Rest via `req.query` typé.

### 5.12quater `src/observability/sentry.ts` — placeholder

```ts
export function initSentry() {
  if (!process.env.SENTRY_DSN) return
  // Placeholder : quand on active, importer @sentry/node + @sentry/profiling-node
  // et appeler Sentry.init({ dsn, tracesSampleRate, profilesSampleRate, ... })
  // Garder dans un fichier séparé pour que main.ts reste lisible.
  console.warn('SENTRY_DSN defined but Sentry not wired up — see src/observability/sentry.ts')
}
```

Permet d'activer Sentry sans refactor `main.ts`.

### 5.13 `prisma/schema.prisma`

Schéma canonique better-auth (à confirmer contre la doc better-auth au moment d'implémenter — certains noms de champs ont évolué) :

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified Boolean   @default(false)
  name          String?
  image         String?
  role          String    @default("user")
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  sessions      Session[]
  accounts      Account[]
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  expiresAt DateTime
  token     String   @unique
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}

model Account {
  id                    String    @id @default(cuid())
  userId                String
  providerId            String
  providerAccountId     String
  password              String?
  accessToken           String?
  refreshToken          String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([providerId, providerAccountId])
  @@index([userId])
}

model Verification {
  id         String   @id @default(cuid())
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  @@index([identifier])
}

// === Modèles better-auth plugin `organization` (S8.5) ===
// Les noms de champs viennent de la doc better-auth plugin organization.
// Susceptibles d'évoluer entre versions — confirmer la doc à jour.

model Organization {
  id          String       @id @default(cuid())
  name        String
  slug        String       @unique
  logo        String?
  createdAt   DateTime     @default(now())
  members     Member[]
  invitations Invitation[]
}

model Member {
  id             String       @id @default(cuid())
  userId         String
  organizationId String
  role           String       @default("member")
  createdAt      DateTime     @default(now())
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  @@unique([userId, organizationId])
  @@index([organizationId])
}

model Invitation {
  id             String       @id @default(cuid())
  email          String
  organizationId String
  role           String       @default("member")
  status         String       @default("pending")
  expiresAt      DateTime
  inviterId      String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  @@index([organizationId])
}

// === Module exemple tenant-scoped (S8.8) ===
// Démontre le pattern : champ `organizationId` → automatiquement filtré par l'extension Prisma.

model Post {
  id             String   @id @default(cuid())
  title          String
  content        String
  authorId       String
  organizationId String   // ← détecté runtime par Prisma.dmmf → ajouté à MODELS_WITH_TENANT
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  @@index([organizationId])
  @@index([authorId])
}
```

**Note plugin `organization` better-auth** : le plugin pose aussi `activeOrganizationId` sur le modèle `Session` (à ajouter au schéma à S8.5). C'est la valeur lue par le `TenantInterceptor` (§5.28).

### 5.14 `apps/api/vitest.config.ts`

Version S8.2 (sans Testcontainers ; ajouté en S8.11). `unplugin-swc` requis pour `emitDecoratorMetadata` (tsx/esbuild ne le supportent pas, casse la DI Nest).

```ts
import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.e2e.spec.ts', 'test/unit/**/*.spec.ts'],
    setupFiles: ['test/setup.ts'],
    pool: 'forks',
    fileParallelism: false,       // singleFork équivalent vitest 4 — DB partagée v1
    testTimeout: 10_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['**/*.module.ts', 'src/generated/**', '**/*.spec.ts'],
      reporter: ['text', 'html'],
      thresholds: { lines: 75, statements: 75, functions: 75, branches: 70 },
    },
  },
})
```

**Note S8.11** : quand Testcontainers est ajouté, retirer `fileParallelism: false` → parallel files OK (chaque file a son container).

### 5.15 `apps/api/test/setup.ts`

Version S8.2 — bootstrap unique d'`INestApplication` partagée entre tous les fichiers de test. La DB dev locale est utilisée directement (cleanup par pattern email `@test.local`). Testcontainers ajouté en S8.11.

```ts
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { afterAll, beforeAll } from 'vitest'
import { AppModule } from '@/app.module'

let app: INestApplication | undefined

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
  app = moduleRef.createNestApplication({ bodyParser: false })
  await app.init()
  ;(globalThis as Record<string, unknown>).__APP__ = app
})

afterAll(async () => {
  await app?.close()
})
```

**Prérequis run** : `docker compose -f docker-compose.dev.yml up -d` + `pnpm prisma migrate deploy` + `pnpm prisma db seed` (admin user dev).

**Cleanup test users** : pattern email `@test.local` (cf. `apps/api/test/e2e/helpers/db.ts`), préserve l'admin seed `admin@local.dev`.

### 5.16 `test/helpers/test-app.ts`

```ts
import { Test } from '@nestjs/testing'
import { AppModule } from '@/app.module'
import { ValidationPipe } from '@nestjs/common'

export async function createTestApp() {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule]
  }).compile()

  const app = moduleRef.createNestApplication()
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }))
  await app.init()
  return app
}
```

### 5.17 `test/helpers/reset-db.ts`

```ts
import { PrismaClient } from '@prisma/client'

export async function resetDb(prisma: PrismaClient) {
  await prisma.$transaction([
    prisma.session.deleteMany(),
    prisma.account.deleteMany(),
    prisma.verification.deleteMany(),
    prisma.user.deleteMany()
  ])
}
```

Appeler dans `beforeEach` des specs e2e.

### 5.18 `docker/Dockerfile`

```dockerfile
# syntax=docker/dockerfile:1.6
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate && pnpm build
RUN pnpm install --frozen-lockfile --prod

FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=nonroot:nonroot /app/node_modules ./node_modules
COPY --from=build --chown=nonroot:nonroot /app/dist ./dist
COPY --from=build --chown=nonroot:nonroot /app/prisma ./prisma
COPY --from=build --chown=nonroot:nonroot /app/package.json ./package.json
USER nonroot:nonroot
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://localhost:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["dist/main.js"]
```

**Notes** :
- `:nonroot` tag = user UID 65532, pas root → réduction surface d'attaque
- `--chown=nonroot:nonroot` sur chaque COPY → fichiers possédés par le bon user
- `HEALTHCHECK` utilise `fetch` natif Node 22 (pas besoin de `curl` — qui n'est pas dans distroless)

Critères : image < 200MB, boot < 2s, `docker inspect` → user `nonroot`.

### 5.19 `docker-compose.dev.yml`

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: fluch
      POSTGRES_PASSWORD: fluch
      POSTGRES_DB: fluch_dev
    ports: ['5432:5432']
    volumes: ['pgdata:/var/lib/postgresql/data']
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U fluch']
      interval: 5s
      timeout: 5s
      retries: 5

  adminer:
    image: adminer:latest
    ports: ['8080:8080']
    depends_on: { postgres: { condition: service_healthy } }

volumes:
  pgdata:
```

### 5.20 `.env.example`

```
NODE_ENV=development
PORT=3000

# En prod, ajouter ?connection_limit=10&pool_timeout=10 à l'URL
DATABASE_URL=postgresql://fluch:fluch@localhost:5432/fluch_dev

BETTER_AUTH_SECRET=replace-with-at-least-32-random-chars
BETTER_AUTH_URL=http://localhost:3000

# Liste séparée par virgules. Vide = CORS désactivé.
CORS_ORIGIN=http://localhost:5173

LOG_LEVEL=debug

# Throttler (in-memory) — défauts 100 req / 60s par IP
THROTTLE_TTL_MS=60000
THROTTLE_LIMIT=100

# Optionnel — Sentry (laisser vide pour désactiver)
# SENTRY_DSN=https://xxx@sentry.io/yyy
```

### 5.21 `.github/dependabot.yml`

```yaml
# IMPORTANT : si tu intègres ce template dans un monorepo, remplace tous les
# `directory: "/"` ci-dessous par le chemin de l'app (ex: "/apps/api").
# Le reste de la config (intervals, groupes) reste tel quel.

version: 2
updates:
  - package-ecosystem: npm
    directory: "/"
    schedule: { interval: weekly, day: monday }
    open-pull-requests-limit: 10
    groups:
      nestjs:
        patterns: ["@nestjs/*"]
      prisma:
        patterns: ["@prisma/*", "prisma"]
      testing:
        patterns: ["vitest", "@vitest/*", "@testcontainers/*", "supertest"]
      types:
        patterns: ["@types/*"]
        dependency-type: development
      biome:
        patterns: ["@biomejs/*"]

  - package-ecosystem: github-actions
    directory: "/"
    schedule: { interval: weekly, day: monday }

  - package-ecosystem: docker
    directory: "/docker"
    schedule: { interval: weekly, day: monday }
```

**Comportement attendu** : 3 jeux de PRs auto par semaine (npm groupés par famille, GH Actions, base image Docker). Les groupes évitent le bruit (1 PR pour tous les `@nestjs/*` au lieu de 12).

**Question utilisateur résolue** : "Si je copie ce template, Dependabot marchera ?" → **Oui**, transparent si le template reste à la racine. Si déplacé en `apps/api/`, modifier `directory: "/"` → `directory: "/apps/api"` (et `/apps/api/docker` pour le bloc Docker). Le commentaire en haut du fichier le rappelle.

### 5.22 `commitlint.config.mjs`

```js
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 100],
  },
}
```

Hook `commit-msg` Husky :
```sh
pnpm exec commitlint --edit $1
```

Convention enforced : `<type>(<scope>): <subject>` (ex `feat(auth): add password reset`). Types : feat, fix, chore, docs, refactor, test, ci, perf.

### 5.23 `.editorconfig`

```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false
```

Backup pour les rares éditeurs sans plugin Biome.

### 5.24 `LICENSE` — MIT

Boilerplate MIT standard avec année et nom du copyright holder. Le développeur remplace `<COPYRIGHT HOLDER>` au moment de l'init.

### 5.25 `.github/CODEOWNERS` et `PULL_REQUEST_TEMPLATE.md`

```
# CODEOWNERS — qui review quoi
* @clement
/prisma/ @clement
/.github/ @clement
```

```md
<!-- PULL_REQUEST_TEMPLATE.md -->
## Quoi
<!-- 1-3 bullets : ce que le PR change -->

## Pourquoi
<!-- contexte business / technique -->

## Comment tester
<!-- étapes reproductibles -->

## Checklist
- [ ] Tests e2e ajoutés/mis à jour
- [ ] Migration Prisma incluse si schéma touché
- [ ] OpenAPI à jour (contrats TS-Rest reflètent les changements)
- [ ] Pas de secret committé
- [ ] Modèle tenant-scoped ? Vérifier que `organizationId` est présent et indexé
- [ ] Service métier ? N'importe PAS `UnsafePrismaService` (lint rule)
```

### 5.26 `apps/api/src/prisma/tenant-extension.ts` (S8.6)

Extension Prisma qui intercepte toutes les opérations sur les modèles tenant-scoped. `MODELS_WITH_TENANT` dérivé runtime via DMMF — pas de fichier généré, source de vérité unique = `schema.prisma`.

```ts
import { Prisma } from '@prisma/client'

export const MODELS_WITH_TENANT = new Set(
  Prisma.dmmf.datamodel.models
    .filter((m) => m.fields.some((f) => f.name === 'organizationId'))
    .map((m) => m.name),
)

export const tenantExtension = (getTenantId: () => string | null | undefined) =>
  Prisma.defineExtension({
    name: 'tenant',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!MODELS_WITH_TENANT.has(model)) return query(args)

          const tenantId = getTenantId()
          if (tenantId === null) return query(args)  // bypass explicite via runAsAdmin
          if (!tenantId) {
            throw new Error(
              `No tenant context for ${model}.${operation}. ` +
              `Wrap the call in tenantStorage.run({ tenantId }, ...) or runAsAdmin().`,
            )
          }

          const readOps = new Set(['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy'])
          const targetedWriteOps = new Set(['update', 'updateMany', 'updateManyAndReturn', 'delete', 'deleteMany'])

          if (readOps.has(operation) || targetedWriteOps.has(operation)) {
            args.where = { ...args.where, tenantId }
          }
          if (operation === 'create' || operation === 'upsert') {
            args.data = { ...args.data, tenantId }
          }
          if (operation === 'createMany' || operation === 'createManyAndReturn') {
            const data = args.data
            args.data = Array.isArray(data)
              ? data.map((d) => ({ ...d, tenantId }))
              : { ...data, tenantId }
          }
          return query(args)
        },
      },
    },
  })
```

**Sémantique stricte null/undefined/string** (le bug à éviter à tout prix) :
- `tenantId === null` (strict) → bypass explicite, seulement via `runAsAdmin()`
- `!tenantId` (couvre `undefined` + `''`) → **throw** défensif
- `tenantId: string` non-vide → filtre injecté

### 5.27 `apps/api/src/tenant/tenant.storage.ts` (S8.6)

AsyncLocalStorage + helper `runAsAdmin`. Type strict pour empêcher la coercion accidentelle.

```ts
import { AsyncLocalStorage } from 'node:async_hooks'

export type TenantContext =
  | { tenantId: string }   // filtre normal
  | { tenantId: null }     // bypass explicite — runAsAdmin only

export const tenantStorage = new AsyncLocalStorage<TenantContext>()

/** Helper pour exécuter du code avec bypass tenant (admin context). */
export const runAsAdmin = <T>(fn: () => Promise<T>): Promise<T> =>
  tenantStorage.run({ tenantId: null }, fn)
```

**État `undefined`** = absence de store (par défaut `getStore()` retourne `undefined`). C'est l'extension qui rejette ce cas via throw. **Ne pas** ajouter `{ tenantId: undefined }` au type — ce serait redondant et risquerait de réintroduire `?? null`.

### 5.28 `apps/api/src/tenant/tenant.interceptor.ts` (S8.6)

APP_INTERCEPTOR global qui lit `req.session.session.activeOrganizationId` (posé par `AuthGuard` thallesp) et le propage via ALS. **Ne JAMAIS faire `?? null`** — si pas d'org active, ne pas créer de store du tout (= getStore() retournera undefined = throw défensif au prochain query tenant-scoped).

```ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable } from 'rxjs'
import { tenantStorage } from './tenant.storage'

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest()
    const orgId = req.session?.session?.activeOrganizationId

    return new Observable((observer) => {
      const run = orgId
        ? () => tenantStorage.run({ tenantId: orgId }, () => next.handle().subscribe(observer))
        : () => next.handle().subscribe(observer)  // pas de store → throw défensif si modèle tenant touché
      run()
    })
  }
}
```

Enregistrement (`apps/api/src/app.module.ts`) — **APRÈS** l'AuthGuard, donc en `APP_INTERCEPTOR` global :

```ts
providers: [
  { provide: APP_INTERCEPTOR, useClass: TenantInterceptor },
]
```

### 5.29 `apps/api/src/prisma/prisma.module.ts` (S8.6)

Module global qui expose 2 providers : `UnsafePrismaService` (raw, dangereux) et `PRISMA` (token Symbol → client étendu, par défaut dans les services métier).

```ts
import { Global, Inject, Module } from '@nestjs/common'
import { UnsafePrismaService } from './unsafe-prisma.service'
import { tenantExtension } from './tenant-extension'
import { tenantStorage } from '../tenant/tenant.storage'

export const PRISMA = Symbol('PRISMA')
export const InjectPrisma = () => Inject(PRISMA)
export type TenantScopedPrismaClient = ReturnType<UnsafePrismaService['$extends']>

@Global()
@Module({
  providers: [
    UnsafePrismaService,
    {
      provide: PRISMA,
      useFactory: (raw: UnsafePrismaService) =>
        raw.$extends(tenantExtension(() => tenantStorage.getStore()?.tenantId)),
      inject: [UnsafePrismaService],
    },
  ],
  exports: [UnsafePrismaService, PRISMA],
})
export class PrismaModule {}
```

**Usage par défaut** dans les services métier :
```ts
@Injectable()
export class PostService {
  constructor(@InjectPrisma() private prisma: TenantScopedPrismaClient) {}
  list() { return this.prisma.post.findMany() }  // tenantId injecté auto
}
```

**Usage exceptionnel** dans un job admin / seed (visuellement marqué `Unsafe`) :
```ts
@Injectable()
export class GlobalCleanupJob {
  constructor(private prisma: UnsafePrismaService) {}  // ← saute aux yeux en review
  @Cron('0 0 * * *') async cleanup() { /* cross-tenant */ }
}
```

### 5.30 `apps/api/src/auth/permissions.ts` (S8.5)

`createAccessControl` + statements de référence + 3 roles (`member`, `admin`, `owner`). Chaque projet étend cette base.

```ts
import { createAccessControl } from 'better-auth/plugins/access'

const statement = {
  user: ['read', 'update', 'delete'],
  organization: ['read', 'update', 'delete'],
  member: ['create', 'read', 'update', 'delete'],
  invitation: ['create', 'read', 'cancel'],
  post: ['create', 'read', 'update', 'delete'],
} as const

export const ac = createAccessControl(statement)

export const member = ac.newRole({
  post: ['create', 'read', 'update'],
  organization: ['read'],
})

export const admin = ac.newRole({
  user: ['read', 'update'],
  organization: ['read', 'update'],
  member: ['create', 'read', 'update', 'delete'],
  invitation: ['create', 'read', 'cancel'],
  post: ['create', 'read', 'update', 'delete'],
})

export const owner = ac.newRole({
  user: ['read', 'update', 'delete'],
  organization: ['read', 'update', 'delete'],
  member: ['create', 'read', 'update', 'delete'],
  invitation: ['create', 'read', 'cancel'],
  post: ['create', 'read', 'update', 'delete'],
})
```

Passé au plugin `organization` (et/ou `admin`) dans `auth.config.ts` :
```ts
plugins: [
  organization({ ac, roles: { member, admin, owner } }),
  // admin plugin pour les rôles system-wide :
  // admin({ ... }),
]
```

### 5.31 `apps/api/src/common/decorators/requires-org.decorator.ts` (S8.6)

Décorateur + guard qui renvoient **400 propre** si la session n'a pas d'`activeOrganizationId`. Évite que l'extension Prisma lève un 500 from depth.

```ts
import { CanActivate, ExecutionContext, Injectable, SetMetadata, BadRequestException, applyDecorators, UseGuards } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

const META = 'requires-org'

@Injectable()
export class RequiresOrgGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const flag = this.reflector.getAllAndOverride<boolean>(META, [ctx.getHandler(), ctx.getClass()])
    if (!flag) return true
    const req = ctx.switchToHttp().getRequest()
    if (!req.session?.session?.activeOrganizationId) {
      throw new BadRequestException('No active organization on session')
    }
    return true
  }
}

export const RequiresOrg = () => applyDecorators(SetMetadata(META, true), UseGuards(RequiresOrgGuard))
```

Usage : `@RequiresOrg()` sur un controller ou une route handler. Sans ça, l'extension lève un 500 from depth — moins propre côté API.

### 5.32 `packages/api-contracts/src/users/contract.ts` (S8.4)

Exemple de contrat TS-Rest complet. Réutilise les Zod schemas générés par `prisma-zod-generator` + filtre les champs sensibles (password, accounts, sessions).

```ts
import { initContract } from '@ts-rest/core'
import { z } from 'zod'
import { PaginationQuerySchema, PaginatedResponseSchema } from '../common/pagination.schema'
import { UserResponseSchema, UserUpdateInputSchema } from './schemas'

const c = initContract()

export const usersContract = c.router({
  me: {
    method: 'GET',
    path: '/users/me',
    responses: { 200: UserResponseSchema, 401: z.object({ message: z.string() }) },
  },
  getById: {
    method: 'GET',
    path: '/users/:id',
    pathParams: z.object({ id: z.string() }),
    responses: { 200: UserResponseSchema, 403: z.object({ message: z.string() }), 404: z.object({ message: z.string() }) },
  },
  list: {
    method: 'GET',
    path: '/users',
    query: PaginationQuerySchema,
    responses: { 200: PaginatedResponseSchema(UserResponseSchema), 403: z.object({ message: z.string() }) },
  },
  updateMe: {
    method: 'PATCH',
    path: '/users/me',
    body: UserUpdateInputSchema,
    responses: { 200: UserResponseSchema, 400: z.object({ issues: z.array(z.any()) }) },
  },
})
```

`schemas.ts` réutilise les Zod générés depuis Prisma :
```ts
import { z } from 'zod'
import { UserUpdateInputSchema as RawUpdate } from '../../../../apps/api/src/generated/zod'

// Filtre les champs sensibles que le client n'a pas le droit de set
export const UserUpdateInputSchema = RawUpdate.omit({ email: true, role: true, emailVerified: true })

// Filtre les champs sensibles dans la response
export const UserResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  image: z.string().url().nullable(),
  role: z.string(),
  createdAt: z.string().or(z.date()),
})
```

### 5.33 `packages/api-contracts/package.json`

```json
{
  "name": "@fluch/api-contracts",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "import": "./dist/index.mjs", "require": "./dist/index.js", "types": "./dist/index.d.ts" }
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm,cjs --dts --clean",
    "dev": "tsup src/index.ts --format esm,cjs --dts --watch"
  },
  "peerDependencies": {
    "@ts-rest/core": "^3.0.0",
    "zod": "^3.0.0"
  },
  "devDependencies": {
    "@fluch/tsconfig": "workspace:*",
    "tsup": "^8.0.0",
    "typescript": "^5.5.0"
  }
}
```

Build via `tsup` (rapide, double output ESM/CJS, types inclus). Consommé par `apps/api` via workspace ref `"@fluch/api-contracts": "workspace:*"`.

### 5.34 Hooks better-auth + listeners Nest (S8.7)

**Hook unique** dans `apps/api/src/auth/hooks/user-created.hook.ts` — délègue tout aux listeners via event-emitter :

```ts
import { Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { AfterCreate } from '@thallesp/nestjs-better-auth'

@Injectable()
export class UserCreatedHook {
  constructor(private events: EventEmitter2) {}

  @AfterCreate('user')
  async onUserCreated(user: { id: string; email: string; name: string | null }) {
    await this.events.emitAsync('user.created', { user })
  }
}
```

**Listener exemple** dans `apps/api/src/auth/listeners/create-default-org.listener.ts` — crée une org par défaut + la met active :

```ts
import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { AuthService } from '../auth.service'
import type { UserCreatedEvent } from '../events'

@Injectable()
export class CreateDefaultOrgListener {
  constructor(private auth: AuthService) {}

  @OnEvent('user.created', { async: true })
  async handle({ user }: UserCreatedEvent) {
    const orgName = user.name ? `${user.name}'s workspace` : 'My workspace'
    await this.auth.api.createOrganization({ body: { name: orgName, userId: user.id } })
    // Le plugin organization pose membership owner + active org auto
  }
}
```

**`emitAsync` (pas `emit`)** : le hook better-auth attend la fin des listeners avant de retourner. Sinon race conditions au signup. **Listeners post-commit** : l'user est déjà commité quand l'event est émis ; pas d'accès à la transaction better-auth.

### 5.35 Lint rule `UnsafePrismaService` (S8.6)

Biome ne supporte pas encore les `no-restricted-imports` avec patterns par chemin (vérifier `nursery` à l'impl). Si insuffisant → ajouter ESLint en parallèle juste pour cette règle.

```js
// .eslintrc.cjs (override paths-restricted only — ne remplace pas biome)
module.exports = {
  overrides: [
    {
      files: ['apps/api/src/**/*.service.ts', 'apps/api/src/**/*.controller.ts'],
      rules: {
        'no-restricted-imports': ['error', {
          paths: [{
            name: '@/prisma/unsafe-prisma.service',
            importNames: ['UnsafePrismaService'],
            message:
              'UnsafePrismaService bypasses tenant isolation. ' +
              'Use @InjectPrisma() with TenantScopedPrismaClient instead. ' +
              'If you really need raw access (cross-tenant job, admin script), ' +
              'add the file to the allowlist override.',
          }],
        }],
      },
    },
    {
      files: ['apps/api/src/jobs/**', 'apps/api/prisma/**', 'apps/api/scripts/**'],
      rules: { 'no-restricted-imports': 'off' },
    },
  ],
}
```

**Alternative si on veut rester biome-only** : un test CI qui grep `UnsafePrismaService` dans `apps/api/src/**/*.{service,controller}.ts` (hors paths autorisés) et échoue si trouvé. ~10 lignes de bash.

## 6. CI workflows

### 6.1 `.github/workflows/ci-api.yml`

```yaml
name: CI API

on:
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'prisma/**'
      - 'test/**'
      - 'docker/**'
      - 'package.json'
      - 'pnpm-lock.yaml'
      - 'tsconfig*.json'
      - '.github/workflows/ci-api.yml'
  pull_request:
    paths:
      - 'src/**'
      - 'prisma/**'
      - 'test/**'
      - 'docker/**'
      - 'package.json'
      - 'pnpm-lock.yaml'
      - 'tsconfig*.json'
      - '.github/workflows/ci-api.yml'

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm prisma generate
      - run: pnpm check
      - run: pnpm typecheck

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm prisma generate
      - run: pnpm test
        env:
          NODE_ENV: test

  build:
    runs-on: ubuntu-latest
    needs: [check, test]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm prisma generate
      - run: pnpm build
      - name: Docker build
        run: docker build -f docker/Dockerfile -t fluch-api:${{ github.sha }} .
```

### 6.2 `.github/workflows/audit.yml`

```yaml
name: Audit deps

on:
  schedule: [{ cron: '0 9 * * 1' }]
  pull_request: { paths: ['package.json', 'pnpm-lock.yaml'] }

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm audit --prod --audit-level=high
```

## 7. Architecture monorepo

Le starter est un monorepo pnpm dès l'origine (pas un "pattern safe" en option). Six mécanismes le rendent cohérent :

### 7.1 Workspace pnpm

`pnpm-workspace.yaml` :
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

Chaque package a son `package.json` avec un nom scoped (`@fluch/api`, `@fluch/api-contracts`, `@fluch/tsconfig`, `@fluch/biome-config`). Inter-dépendances déclarées via `"workspace:*"`.

### 7.2 Scripts root délégants

Le `package.json` racine ne contient pas le code applicatif. Il délègue tout :
```json
"scripts": {
  "dev": "pnpm --filter @fluch/api dev",
  "build": "pnpm -r build",
  "test": "pnpm --filter @fluch/api test",
  "test:cov": "pnpm --filter @fluch/api test:cov",
  "typecheck": "pnpm -r typecheck",
  "check": "biome check .",
  "prisma:migrate": "pnpm --filter @fluch/api prisma:migrate"
}
```

`pnpm -r <script>` exécute le script dans tous les workspaces qui le définissent.

### 7.3 Husky centralisé root, lint-staged délégant

`.husky/` au root. `lint-staged` au root délègue par paths :
```json
"lint-staged": {
  "apps/api/**/*.{ts,js,json}": "biome check --write --no-errors-on-unmatched",
  "packages/*/src/**/*.ts": "biome check --write --no-errors-on-unmatched",
  "apps/api/prisma/schema.prisma": "pnpm --filter @fluch/api prisma format"
}
```

### 7.4 Tsconfig partagé via `packages/tsconfig`

`packages/tsconfig/base.json` (config commune strict). `packages/tsconfig/api.json` (extends base + `experimentalDecorators` + `emitDecoratorMetadata`). `apps/api/tsconfig.json` extends `@fluch/tsconfig/api.json`.

### 7.5 Contrats partagés via `packages/api-contracts`

C'est la valeur clé du monorepo. Les contrats TS-Rest + Zod schemas vivent dans `packages/api-contracts/`. `apps/api/` les consomme via workspace ref. Quand `apps/web/` arrivera, il les consommera de la même façon — partage **sans publication npm**.

### 7.6 Biome config partagée via `packages/biome-config`

`packages/biome-config/biome.json` est la SoT. `biome.json` à la racine `extends` simplement vers ce package. Chaque package peut overrider localement si besoin (rare).

### 7.7 CI paths-filtered par workspace

`.github/workflows/ci-api.yml` filtre :
```yaml
paths:
  - 'apps/api/**'
  - 'packages/api-contracts/**'
  - 'packages/tsconfig/**'
  - 'pnpm-lock.yaml'
  - 'pnpm-workspace.yaml'
  - '.github/workflows/ci-api.yml'
```

Modification dans `apps/web/` → `ci-api.yml` ne tourne pas. **Naming** : `ci-api.yml` (pas `ci.yml`) pour anticiper `ci-web.yml`.

### 7.8 Dependabot 4 blocs

`.github/dependabot.yml` ouvre 4 blocs npm (un par workspace) + GH Actions + Docker. Chaque workspace a ses propres PR auto, groupées par famille (`@nestjs/*`, `@prisma/*`, etc.).

## 8. README — structure attendue

Le README doit avoir ces sections, dans cet ordre :

1. **Quick start** (5 lignes max : clone, install, env, migrate, dev)
2. **Stack** (table de la §2 de cette spec)
3. **Project structure** (arbo de la §4)
4. **Available scripts** (table extraite de `package.json`)
5. **Environment variables** (table des vars + descriptions)
6. **API documentation** (lien `/docs` en dev, `/docs-json` export — pointer vers la gen de client)
7. **Authentication flow** (sign-up, sign-in, session cookies — exemples curl)
8. **Database** (migrations, seed, studio, stratégie prod — cf. §13)
9. **Testing** (Vitest + Testcontainers, comment lancer)
10. **Docker** (build local, run prod, compose dev, nonroot, HEALTHCHECK)
11. **Monorepo structure** (architecture pnpm — voir §7 : `apps/api`, `packages/api-contracts`, `packages/tsconfig`, `packages/biome-config`, scripts délégants, ajout d'un `apps/web` ultérieur)
12. **Multi-tenant isolation** (extension Prisma, `@InjectPrisma()` vs `UnsafePrismaService`, `runAsAdmin`, `@RequiresOrg`, comment ajouter un modèle tenant-scoped — pointer vers [fluch-nest-starter-tenant-extension.md](fluch-nest-starter-tenant-extension.md))
13. **RBAC permissions** (`createAccessControl`, table des décorateurs `@Roles`/`@OrgRoles`/`@UserHasPermission`/`@MemberHasPermission`, exemple d'ajout de role)
14. **TS-Rest contracts** (structure `packages/api-contracts`, ajout d'un module, consommation depuis le front à venir)
15. **Adding OAuth providers** (pointer vers la doc better-auth, indiquer où câbler)
16. **Conventional commits** (table des types acceptés, comment ça génère le changelog)
17. **Production checklist** (vars secrets à régénérer, migrations à exécuter, Sentry à activer, etc.)

## 9. Critères d'acceptation (smoke tests)

Le développeur doit valider chacun de ces points avant de considérer le template "fini" :

1. `pnpm install` ne sort aucun warning critique
2. `cp .env.example .env` puis `docker compose -f docker-compose.dev.yml up -d` → postgres healthy
3. `pnpm prisma migrate dev --name init` → migration initiale créée, tables User/Session/Account/Verification présentes
4. `pnpm dev` → boot < 3s, log "Application is running on: http://localhost:3000" via `AppLogger`
5. `GET http://localhost:3000/v1/health` → 200, JSON `{ status: 'ok', info: { db: { status: 'up' } } }`
6. **OpenAPI doc** : `GET http://localhost:3000/docs` → Swagger UI en dev ; en prod `NODE_ENV=production pnpm start` → 404. `/docs-json` toujours 200.
7. **API versioning** : toutes les routes répondent sous `/v1/*` ; `/users/me` (sans préfixe) → 404
8. `POST http://localhost:3000/v1/api/auth/sign-up/email` avec `{ email, password, name }` → 200, set-cookie avec flags `HttpOnly; SameSite=Lax` (et `Secure` en prod)
9. `POST http://localhost:3000/v1/api/auth/sign-in/email` correct → 200, set-cookie
10. `GET http://localhost:3000/v1/users/me` avec cookie → 200, JSON user (sans `password`/`account` leak)
11. `GET http://localhost:3000/v1/users/me` sans cookie → 401
12. **Request-id** : `curl -H "x-request-id: abc-123" .../v1/health` → header `x-request-id: abc-123` dans la réponse
13. **Body size limit** : `POST` avec un body 2MB → 413
14. **Compression** : `curl -H "Accept-Encoding: gzip" .../docs-json -I` → header `Content-Encoding: gzip`
15. `pnpm test` → Testcontainers démarre postgres, tous les specs e2e verts
16. **Coverage** : `pnpm test:cov` → ≥ 80% sur `src/auth/**` et `src/users/**`
17. `pnpm check` && `pnpm typecheck` → zéro erreur
18. **Floating promise détecté** : ajouter `this.usersService.findById('x')` (sans await) dans un controller → `pnpm check` signale `noFloatingPromises`
19. **Commit message invalide** : `git commit -m "wip"` → bloqué par commitlint
20. **Pre-push** : staged un fichier avec erreur TS, `git push` → bloqué
21. `docker build -f docker/Dockerfile -t fluch-api .` → image < 200MB
22. `docker inspect fluch-api --format '{{.Config.User}}'` → `nonroot:nonroot`
23. **HEALTHCHECK Docker** : `docker run -d --name x fluch-api && sleep 15 && docker inspect x --format '{{.State.Health.Status}}'` → `healthy`
24. **Test monorepo** : `mkdir -p /tmp/mono/apps/api && cp -r . /tmp/mono/apps/api && rm -rf /tmp/mono/apps/api/.git && cd /tmp/mono/apps/api && pnpm install` → pas d'erreur du `prepare` script (no-op)
25. **Dependabot config valide** : pousser sur GitHub → onglet "Security" → Dependabot listé comme actif sans erreur de parsing
26. **Org auto-créée** : `POST /v1/api/auth/sign-up/email` → 200, puis `GET /v1/api/auth/get-session` avec cookie → `session.session.activeOrganizationId` présent (event listener S8.7)
27. **Isolation tenant** : créer 2 users dans 2 orgs (A, B), chacun crée 1 post → `GET /v1/posts` user A → 1 post (le sien), pas celui de B (extension Prisma S8.6)
28. **Cross-tenant bypass impossible** : user A → `GET /v1/posts/<id-du-post-de-B>` → 404 (pas 200, pas 403). L'extension injecte le filtre `tenantId` dans le `where`, le record est invisible.
29. **Lint rule UnsafePrismaService** : ajouter `import { UnsafePrismaService } from '@/prisma/unsafe-prisma.service'` dans `apps/api/src/users/users.service.ts` → `pnpm check` échoue avec message clair (S8.6)
30. **Contrat partagé** : `import { usersContract } from '@fluch/api-contracts'` depuis un fichier hors `apps/api` compile et fournit le typage end-to-end (S8.4)

## 10. Hors scope v1

À documenter dans le README comme "extensions possibles" :

- OAuth providers (Google, GitHub, etc.) — better-auth les supporte, l'user les active selon besoins
- OpenTelemetry full instrumentation — placeholder Sentry présent, mais pas câblé
- Rate limiting via Redis — `@nestjs/throttler` in-memory uniquement
- File uploads / S3
- Job queue (BullMQ etc.)
- WebSockets / SSE
- GraphQL
- Cursor-based pagination — offset/limit suffit en v1
- Changelog auto-generation (release-please, changesets) — décision laissée à l'user
- SBOM generation pour supply chain — peut être ajouté en CI quand le besoin émerge
- Hygen scaffolding (`pnpm gen:resource <Model>`) — reporté post-S18, à ré-évaluer après 3-4 modules métier (rule of three)
- App frontend (`apps/web/`) — out-of-scope du starter back, mais la structure monorepo l'attend
- BI tools / accès direct DB — pour ce cas, RLS Postgres reste pertinent (voir [tenant-extension.md](fluch-nest-starter-tenant-extension.md) §7)

## 11. Questions ouvertes (à trancher en cours d'implémentation)

- Format exact du `User` model better-auth : vérifier la doc à jour avant de figer le schéma Prisma (§5.13 est un best guess)
- Format exact des modèles `Organization` / `Member` / `Invitation` du plugin better-auth `organization` : confirmer à l'impl S8.5 — peuvent avoir évolué entre versions
- Statements et roles initiaux dans `permissions.ts` : le starter livre une base (user, organization, member, invitation, post + roles member/admin/owner). Chaque projet étend selon ses besoins. À documenter dans README.
- Création d'org par défaut au signup vs invitation explicite : le starter par défaut crée une org "personnelle" (S8.7). Documenté comme adaptable — si le SaaS visé attend invitation, retirer le listener.
- Liste des effets de bord du listener `user.created` : starter livre la création d'org. Mail welcome, seed démo, queue onboarding restent placeholders documentés. À étoffer par projet.
- Lint rule `UnsafePrismaService` : biome (nursery) suffit-il à l'impl S8.6, ou faut-il ajouter ESLint en parallèle ? Décision au moment de l'impl (cf. §5.35).
- Gestion d'erreur dans les listeners Nest (`emitAsync`) : un listener qui throw bloque les autres par défaut. Wrap try/catch dans chaque listener pour isolation ? Décision au moment de l'impl S8.7.
- ~~Préfixe API~~ → **Tranché** : tout sous `/api/*` pour cohérence frontend
- ~~`updatedAt`~~ → **Tranché** : `@updatedAt` Prisma natif suffit
- ~~Logger~~ → **Tranché** : `ConsoleLogger` natif Nest 11 (cf. §5.6 + S04)

## 12. Sources / références à consulter pendant l'impl

- <https://docs.nestjs.com/> — base
- <https://www.better-auth.com/docs> — config + adapter Prisma
- <https://www.better-auth.com/docs/plugins/organization> — plugin organization
- <https://www.better-auth.com/docs/plugins/admin> — plugin admin
- <https://www.better-auth.com/docs/plugins/access> — createAccessControl
- <https://github.com/ThallesP/nestjs-better-auth> — intégration Nest officielle
- <https://www.prisma.io/docs> — schema, migrate, client
- <https://ts-rest.com/docs> — TS-Rest core + Nest adapter
- <https://github.com/omar-dulaimi/prisma-zod-generator> — generator Zod depuis Prisma
- <https://docs.nestjs.com/techniques/events> — @nestjs/event-emitter
- <https://nodejs.org/api/async_context.html> — AsyncLocalStorage natif
- <https://node.testcontainers.org/modules/postgresql/> — testcontainers postgres (S8.11)
- <https://docs.nestjs.com/techniques/logger> — `ConsoleLogger` natif (options `json`, `colors`, `logLevels`)
- <https://biomejs.dev/reference/configuration/> — config Biome
- <https://commitlint.js.org/> — conventional commits

## 13. Stratégie de migrations en production

Décision lockée : **`prisma migrate deploy` exécuté en job CI dédié**, séparé du build et du deploy de l'image. Jamais au boot du container.

### Pourquoi pas au boot

- **Race condition multi-replica** : si N pods démarrent en même temps après un deploy, N pods exécutent les migrations en parallèle. Postgres a un advisory lock côté Prisma, mais les pods qui attendent vont timeout sur le readiness probe.
- **Migration cassée = pod en crashloop** : si une migration foire, le pod ne démarre pas, l'orchestrateur recrée, boucle infinie. Plus dur à debug qu'un job CI qui échoue clairement.
- **Rollback impossible** : on ne peut pas distinguer "migration appliquée" de "migration en cours" pour un rollback de pod.

### Workflow recommandé

1. PR mergée sur `main` → CI build l'image Docker et la pousse sur ghcr
2. Job CI séparé (`deploy.yml`, hors-scope template v1) :
   a. Job `migrate` : checkout, install, `pnpm prisma migrate deploy` contre la DB prod (auth via secrets)
   b. Job `deploy` (depends: migrate) : rollout de la nouvelle image sur k8s/Render/Fly
3. En cas d'échec de `migrate` : le `deploy` ne tourne pas, l'ancienne version reste up. Alert manuel, fix de la migration, retry.

### Migrations destructives (drop column, etc.)

Toujours **deux deploys** :
1. Deploy 1 : ajout d'une nouvelle colonne / table compatible avec l'ancien code
2. Deploy 2 : ancien code retiré, migration de suppression

C'est documenté dans CONTRIBUTING.md, pas dans le code du template (mais le template doit le rendre facile via Prisma).

### Migrations en CI tests

Pour les tests, `pnpm prisma migrate deploy` est appelé dans `test/setup.ts` (cf. §5.15) sur le container Testcontainers. Pas de risque, container éphémère.

### Backup avant migration prod

Hors scope template, mais à documenter dans le README "Production checklist" : avant tout deploy avec migration, snapshot DB (`pg_dump` ou snapshot RDS/managed equivalent).
