# Spec — Template backend `fluch-nest-starter`

Spec implémentable destinée au développeur qui va bootstrapper le repo. Toutes les décisions de stack et de design sont **lockées** sauf mention explicite "ouvert". Le développeur ne doit pas avoir à choisir entre alternatives — la spec tranche partout.

Repo cible : `fluch-nest-starter` (à créer côté user). Layout : à plat (pas de `apps/api/` au démarrage). Le README expliquera comment relocaliser pour intégration monorepo.

## 1. Objectif

Template backend "tout-terrain" Node.js, prêt à brancher sur n'importe quel projet, production-ready dès le clone :

- API HTTP REST avec NestJS bien structuré (modules, DTOs, filters, interceptors, guards)
- Persistence Postgres via Prisma
- Authentification email/password + sessions via better-auth (sans OAuth providers pré-câblés)
- Observabilité minimale : logger structuré JSON, health check
- Tests e2e avec Postgres réel (Testcontainers) — pas de mocks DB
- Tooling complet : lint, format, typecheck, audit, pre-commit
- Image Docker prête à brancher sur un docker-compose multi-services
- Pattern **standalone-first / monorepo-safe** : tourne seul, et s'absorbe dans un monorepo sans casser

Ce template doit pouvoir cohabiter dans un monorepo avec `fluch-react-signals-starter` (template frontend) sans que les hooks Husky ou les workflows GitHub Actions se collisionnent. Voir §10.

## 2. Stack lockée

| Concern | Tech | Version cible |
|---|---|---|
| Framework | NestJS | ^11.0 |
| Runtime | Node.js | 22 LTS |
| Package manager | pnpm | 9.x |
| Language | TypeScript | ^5.5 (strict mode) |
| ORM | Prisma | ^6.0 |
| DB | Postgres | 16 |
| Auth | better-auth | latest (^1.0+) |
| Config | `@nestjs/config` + `zod` | NestJS 11 compatible + Zod 3.x |
| Logger | `ConsoleLogger` natif (`@nestjs/common`) | NestJS 11 (`json` + `colors` + `logLevels` natifs depuis v11) |
| Validation | `class-validator` + `class-transformer` | latest |
| Sécurité | `helmet`, CORS natif Nest, `csurf` (via better-auth) | latest |
| Compression | `compression` middleware Express | latest |
| OpenAPI doc | `@nestjs/swagger` | latest |
| Throttling | `@nestjs/throttler` | latest (in-memory v1) |
| Health | `@nestjs/terminus` | latest |
| Auto-updates | Dependabot (GitHub natif) | — |
| Testing | Vitest + Testcontainers + Supertest | Vitest 2.x, `@testcontainers/postgresql` |
| Lint + Format | Biome | ^1.9 (rules `nursery` activées pour `noFloatingPromises`) |
| Pre-commit | Husky + lint-staged | latest |
| CI | GitHub Actions | — |
| Container | Multi-stage Dockerfile, base `node:22-alpine` puis `gcr.io/distroless/nodejs22-debian12` | — |

**Versions épinglées strictement** dans `package.json` (utiliser `^x.y.0` pour permettre patch updates uniquement). Lockfile (`pnpm-lock.yaml`) committé.

## 3. Décisions de design lockées

1. **Layout à plat** : `src/`, `prisma/`, `test/` au root du repo. Pas de `apps/api/` au démarrage. Documenter dans le README comment déplacer pour monorepo.
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

## 4. Structure du repo

```
fluch-nest-starter/
├── .github/
│   ├── workflows/
│   │   ├── ci-api.yml              # lint + test + build, paths-filtered
│   │   └── audit.yml               # pnpm audit hebdo + sur PR
│   ├── dependabot.yml              # auto-updates npm + GH Actions + Docker
│   ├── CODEOWNERS                  # règles de review
│   └── PULL_REQUEST_TEMPLATE.md
├── .husky/
│   ├── pre-commit                  # 1 ligne : pnpm exec lint-staged
│   ├── commit-msg                  # commitlint -e
│   └── pre-push                    # pnpm typecheck && pnpm test
├── .vscode/
│   ├── settings.json               # format on save, Biome comme formatter
│   └── extensions.json             # recommandations Biome, Prisma
├── docker/
│   └── Dockerfile                  # multi-stage : deps → build → distroless
├── prisma/
│   ├── schema.prisma               # User + Session + Account + Verification
│   ├── migrations/                 # créé par `prisma migrate dev` initial
│   └── seed.ts                     # seed minimal (admin user dev)
├── src/
│   ├── main.ts                     # bootstrap
│   ├── app.module.ts               # racine, glue des modules
│   ├── config/
│   │   ├── env.schema.ts           # Zod schema validation process.env
│   │   └── config.module.ts        # @nestjs/config + validation
│   ├── common/
│   │   ├── filters/
│   │   │   └── all-exceptions.filter.ts
│   │   ├── interceptors/
│   │   │   ├── logging.interceptor.ts
│   │   │   ├── timeout.interceptor.ts
│   │   │   └── request-id.interceptor.ts   # propage x-request-id en réponse
│   │   ├── pipes/
│   │   │   └── validation-pipe.factory.ts
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts
│   │   │   ├── public.decorator.ts
│   │   │   └── api-paginated.decorator.ts  # combine ApiOkResponse + type wrapper
│   │   ├── dto/
│   │   │   ├── pagination.dto.ts            # PaginationDto (page, limit)
│   │   │   └── paginated-response.dto.ts    # { items, total, page, limit }
│   │   └── guards/
│   │       └── auth.guard.ts       # vérifie session better-auth
│   ├── observability/
│   │   └── sentry.ts               # placeholder : init Sentry si SENTRY_DSN présent
│   ├── prisma/
│   │   ├── prisma.module.ts        # global module
│   │   └── prisma.service.ts       # extends PrismaClient + onModuleInit/Destroy
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts      # @All('auth/*'), mount better-auth handler
│   │   ├── auth.service.ts         # encapsule l'instance betterAuth({...})
│   │   ├── auth.config.ts          # config better-auth (adapter Prisma, options)
│   │   └── http-adapter.ts         # toWebRequest + sendNodeResponse helpers
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts     # GET /users/me, GET /users/:id
│   │   ├── users.service.ts
│   │   └── dto/
│   │       ├── update-user.dto.ts
│   │       └── user-response.dto.ts
│   └── health/
│       ├── health.module.ts
│       └── health.controller.ts    # @nestjs/terminus : db + memory
├── test/
│   ├── setup.ts                    # globalSetup Vitest → Testcontainers postgres
│   ├── helpers/
│   │   ├── test-app.ts             # bootstrap NestJS testing module + DB réelle
│   │   └── reset-db.ts             # TRUNCATE entre tests, séquence ré-init
│   └── e2e/
│       ├── auth.e2e.spec.ts        # sign-up, sign-in, /users/me avec cookie
│       ├── users.e2e.spec.ts
│       └── health.e2e.spec.ts
├── .dockerignore
├── .editorconfig                   # défauts pour éditeurs sans plugin Biome
├── .env.example
├── .gitignore
├── .nvmrc                          # "22"
├── biome.json                      # config unique lint + format
├── commitlint.config.mjs           # config Conventional Commits
├── docker-compose.dev.yml          # postgres 16 + adminer (UI :8080)
├── LICENSE                         # MIT par défaut
├── CONTRIBUTING.md                 # convention commits, branch model, PR flow
├── package.json
├── pnpm-lock.yaml
├── README.md
├── tsconfig.json                   # strict, paths "@/" → "./src/"
├── tsconfig.build.json             # exclut test, types, *.spec.ts
└── vitest.config.ts
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
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  app.useGlobalFilters(new AllExceptionsFilter())
  app.enableShutdownHooks()

  // Swagger : UI seulement en dev, JSON exporté toujours (utile pour codegen client)
  const swaggerConfig = new DocumentBuilder()
    .setTitle('fluch-api')
    .setDescription('API HTTP de l\'application')
    .setVersion('1.0')
    .addCookieAuth('better-auth.session_token')
    .build()
  const swaggerDoc = SwaggerModule.createDocument(app, swaggerConfig)
  if (process.env.NODE_ENV !== 'production') {
    SwaggerModule.setup('docs', app, swaggerDoc)
  }
  // /docs-json toujours actif (idempotent)
  app.getHttpAdapter().get('/docs-json', (_req, res) => res.json(swaggerDoc))

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

### 5.12ter `src/common/dto/pagination.dto.ts` et `paginated-response.dto.ts`

**Convention** : offset/limit. Cursor-based réservé pour v2 si un cas justifie.

```ts
// pagination.dto.ts
import { Type } from 'class-transformer'
import { IsInt, IsOptional, Max, Min } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class PaginationDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit: number = 20
}
```

```ts
// paginated-response.dto.ts
export class PaginatedResponseDto<T> {
  items!: T[]
  total!: number
  page!: number
  limit!: number
}

export function paginate<T>(items: T[], total: number, page: number, limit: number): PaginatedResponseDto<T> {
  return { items, total, page, limit }
}
```

Usage dans un controller :

```ts
@Get()
async list(@Query() pagination: PaginationDto): Promise<PaginatedResponseDto<UserResponseDto>> {
  const { items, total } = await this.usersService.findMany(pagination)
  return paginate(items, total, pagination.page, pagination.limit)
}
```

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
```

### 5.14 `vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    globalSetup: ['./test/setup.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 30000,
    hookTimeout: 30000,
    include: ['test/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['**/*.spec.ts', '**/main.ts', '**/dto/**']
    }
  }
})
```

### 5.15 `test/setup.ts`

```ts
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { execSync } from 'node:child_process'

let container: StartedPostgreSqlContainer

export async function setup() {
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  process.env.DATABASE_URL = container.getConnectionUri()
  process.env.BETTER_AUTH_SECRET = 'test-secret-at-least-32-characters-long'
  process.env.BETTER_AUTH_URL = 'http://localhost:3000'
  execSync('pnpm prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    stdio: 'inherit'
  })
}

export async function teardown() {
  await container?.stop()
}
```

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
- [ ] OpenAPI à jour (les décorateurs Swagger reflètent les changements)
- [ ] Pas de secret committé
```

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

## 7. Pattern monorepo-safe — explicite

C'est le point que l'user a soulevé explicitement. Trois mécanismes :

### 7.1 Husky `prepare` conditionnel

Voir §5.1. Le script vérifie l'existence de `.git/` au cwd avant d'installer les hooks. Dans un monorepo, le template est dans `apps/api/` où il n'y a pas de `.git/` → no-op silencieux. Les hooks du root prennent le relais.

**Pour intégration monorepo**, le root doit avoir un `lint-staged` qui délègue :

```json
"lint-staged": {
  "apps/api/**/*.{ts,js,json}": "pnpm --filter @fluch/api exec biome check --write --no-errors-on-unmatched"
}
```

(Documenter dans le README.)

### 7.2 CI avec `paths:` filters

Voir §6.1. Les filtres `paths:` font que le workflow ne tourne que si des fichiers pertinents changent. En monorepo, l'user remplace `src/**` par `apps/api/src/**`, etc. Aucun conflit avec un `ci-web.yml` qui filtre `apps/web/**`.

**Naming** : `ci-api.yml` (pas `ci.yml`) pour éviter collision si un autre template définit aussi `ci.yml`.

### 7.3 Pas de hardcoded paths absolus

Tout chemin dans les scripts (`package.json`, `Dockerfile`, etc.) est relatif au cwd du template. Le Dockerfile fonctionne tel quel en standalone (`docker build -f docker/Dockerfile .`) ET en monorepo (`docker build -f apps/api/docker/Dockerfile apps/api/`).

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
11. **Monorepo integration** (section dédiée — voir §7 de cette spec + ajustements `dependabot.yml`)
12. **Adding OAuth providers** (pointer vers la doc better-auth, indiquer où câbler)
13. **Conventional commits** (table des types acceptés, comment ça génère le changelog)
14. **Production checklist** (vars secrets à régénérer, migrations à exécuter, Sentry à activer, etc.)

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

## 10. Hors scope v1

À documenter dans le README comme "extensions possibles" :

- OAuth providers (Google, GitHub, etc.) — better-auth les supporte, l'user les active selon besoins
- OpenTelemetry full instrumentation — placeholder Sentry présent, mais pas câblé
- Rate limiting via Redis — `@nestjs/throttler` in-memory uniquement
- Multi-tenancy
- File uploads / S3
- Job queue (BullMQ etc.)
- WebSockets / SSE
- GraphQL
- Cursor-based pagination — offset/limit suffit en v1
- Pagination cross-cutting via `@nestjs/swagger` `ApiExtraModels` — patterns plus avancés v2
- Changelog auto-generation (release-please, changesets) — décision laissée à l'user
- SBOM generation pour supply chain — peut être ajouté en CI quand le besoin émerge

## 11. Questions ouvertes (à trancher en cours d'implémentation)

- Format exact du `User` model better-auth : vérifier la doc à jour avant de figer le schéma Prisma (§5.13 est un best guess)
- Préfixe API : tout sous `/api/*` ou les routes auth uniquement sous `/api/auth/*` ? Recommandation : tout sous `/api/*` pour cohérence frontend.
- Mise à jour automatique de `updatedAt` sur User : via `@updatedAt` Prisma (OK) ou middleware Nest ? Prisma suffit.
- ~~Logger : faut-il un transport spécifique pour stdout JSON en prod ?~~ **Tranché** : `ConsoleLogger` natif Nest 11 avec `json: true` en prod, `colors: true` en dev. Pas de dép externe. Cf. §5.6 + S04 dans stories.

## 12. Sources / références à consulter pendant l'impl

- https://docs.nestjs.com/ — base
- https://www.better-auth.com/docs — config + adapter Prisma
- https://www.prisma.io/docs — schema, migrate, client
- https://node.testcontainers.org/modules/postgresql/ — testcontainers postgres
- https://docs.nestjs.com/techniques/logger — `ConsoleLogger` natif (options `json`, `colors`, `logLevels`)
- https://biomejs.dev/reference/configuration/ — config Biome
- https://commitlint.js.org/ — conventional commits

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
