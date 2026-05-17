# Stories — Template backend `fluch-nest-starter`

Découpage en stories destiné au développeur qui va bootstrapper le template. Chaque story est dimensionnée pour ~½ jour à 1,5 jour. Référence permanente : `fluch-nest-starter-spec.md` (voisin de ce fichier).

**Légende tailles** : S = ≤ 4h, M = ≤ 1 jour, L = 1-2 jours.

**Convention** : "DoD" = Definition of Done = critères d'acceptation testables.

---

## S01 — Bootstrap du projet

**Taille** : S
**Dépendances** : aucune
**Goal** : avoir un repo Node/TypeScript propre, vide mais structuré, prêt à recevoir les modules.

**Tâches**
- `git init`, créer le repo `fluch-nest-starter`
- `package.json` initial avec `"name": "fluch-nest-starter"`, `"private": true`, scripts vides
- `tsconfig.json` strict (cf. spec §5.4), `tsconfig.build.json` pour exclure les tests
- `.nvmrc` contenant `22`
- `.gitignore` (Node, dist, .env, coverage, .DS_Store)
- `.vscode/settings.json` + `.vscode/extensions.json` (recommander ESLint, Prettier, Prisma)
- `README.md` squelette (juste les titres des sections de la spec §8)
- Installer NestJS via `pnpm add @nestjs/common @nestjs/core @nestjs/platform-express reflect-metadata rxjs`
- `pnpm-lock.yaml` committé

**DoD**
- `pnpm install` réussit sans warnings critiques
- `pnpm tsc --noEmit` passe sans erreur (rien à compiler encore mais la config est valide)
- Premier commit pushé sur `main`

---

## S02 — Tooling lint / format / pre-commit (Biome)

**Taille** : S
**Dépendances** : S01
**Goal** : pipeline de qualité de code en place avec Biome (un seul outil lint + format). Inclut le pattern monorepo-safe du `prepare` script.

**Tâches**
- Installer : `pnpm add -D @biomejs/biome husky lint-staged`
- `biome.json` (cf. spec §5.5) avec règles `nursery.noFloatingPromises` activée
- Ajouter scripts dans `package.json` : `lint`, `format`, `check`, `check:fix`, `typecheck`, `prepare` (avec le node -e conditionnel — cf. spec §5.1)
- `lint-staged` config dans `package.json` (cf. spec §5.2) — utilise `biome check --write`
- `.husky/pre-commit` avec une seule ligne `pnpm exec lint-staged`
- Exécuter `pnpm install` une fois pour déclencher `prepare`
- `.vscode/extensions.json` : recommander `biomejs.biome` (remplacer la reco ESLint+Prettier du S01)
- `.vscode/settings.json` : définir Biome comme default formatter pour les langages JS/TS/JSON

**DoD**
- `pnpm check` exit 0
- `pnpm check:fix` corrige un fichier mal formaté
- `pnpm typecheck` exit 0
- Écrire un controller test avec `async handler() { this.service.doStuff() }` (Promise non-awaited) → `pnpm check` signale `noFloatingPromises`
- Faire un commit avec un fichier non-formaté → auto-fixé par pre-commit (lint-staged ajoute la version corrigée)
- Tester en supprimant `.git/` temporairement et lancer `pnpm install` → `prepare` script no-op silencieux
- **Test monorepo simulé** : `cp -r . /tmp/test-mono/apps/api && cd /tmp/test-mono/apps/api && rm -rf .git && pnpm install` → ne tente pas d'installer husky, exit 0

**Note** : Biome ne formate pas Markdown/YAML. Si l'éditeur du dev n'a pas Prettier installé, ces fichiers ne seront pas auto-formatés — c'est OK, pas critique pour le template.

---

## S03 — Module Config + validation Zod

**Taille** : S
**Dépendances** : S01
**Goal** : charger et valider `process.env` au boot. Crash propre si une var requise manque.

**Tâches**
- `pnpm add @nestjs/config zod`
- `src/config/env.schema.ts` (cf. spec §5.7)
- `src/config/config.module.ts` : `ConfigModule.forRoot({ isGlobal: true, validate: (env) => envSchema.parse(env) })`
- `.env.example` créé (cf. spec §5.20)

**DoD**
- `pnpm dev` sans `.env` ou avec `BETTER_AUTH_SECRET` < 32 chars → crash immédiat avec message Zod clair
- `pnpm dev` avec un `.env` valide (copié depuis `.env.example`) → boot OK
- `ConfigService.get('DATABASE_URL')` retourne la valeur typée (le type doit être inféré, pas `string | undefined`)

---

## S04 — Logger structuré (ConsoleLogger natif)

**Taille** : S
**Dépendances** : S03
**Goal** : logs JSON en prod (pour ingestion par agrégateurs), colorés pretty en dev, niveau pilotable via `LOG_LEVEL`.

**Tâches**
- Pas d'install : `ConsoleLogger` est déjà dans `@nestjs/common` v11
- `src/logger/app-logger.service.ts` : `AppLogger extends ConsoleLogger`, `@Injectable()`, injecte `ConfigService<Env, true>`, configure `super({ json: isProd, colors: !isProd, logLevels, timestamp: true })`. Mapping `LOG_LEVEL` Pino-style (`trace|debug|info|warn|error`) → `LogLevel[]` Nest cascading (`verbose|debug|log|warn|error|fatal`) via une table interne
- `src/logger/logger.module.ts` : provide + export `AppLogger`, importé dans `AppModule`
- Dans `main.ts` : `NestFactory.create(AppModule, { bufferLogs: true })` puis `app.useLogger(app.get(AppLogger))`

**DoD**
- En dev, `pnpm dev` → logs colorisés (ANSI), format natif Nest
- En `NODE_ENV=production node dist/main.js` → logs JSON parseable (`{"level":"log","pid":...,"timestamp":...,"message":"...","context":"..."}`)
- `LOG_LEVEL=error` → seuls les niveaux error/fatal apparaissent
- `AppLogger` injectable et typé : `constructor(private readonly logger: AppLogger) {}` compile

**Note déviation vs spec initiale** : la spec d'origine prescrivait `nestjs-pino + pino + pino-http + pino-pretty`. Depuis Nest 11, le `ConsoleLogger` natif supporte `json: true` + `colors` + `logLevels` configurables — couvre 100 % du besoin "JSON prod / pretty dev / level configurable" sans dépendance externe. Trade-offs vs Pino : perte de perf (~5x sur du très haut débit), pas de child loggers ni redaction natifs, pas de logging HTTP auto. Le logging HTTP par requête + propagation `req.id` sont gérés via interceptors Nest en S06.

---

## S05a — DB locale Docker + setup Prisma (pipeline)

**Taille** : XS
**Dépendances** : S03
**Goal** : pipeline DB → migration → Prisma client fonctionnel, validé sur un schéma minimal. Aucun modèle métier encore.

**Tâches**
- `docker-compose.dev.yml` (cf. spec §5.19) : service postgres seul (image officielle, port 5432, volume nommé, user/db `fluch`)
- `pnpm add @prisma/client` ; `pnpm add -D prisma`
- Scripts `package.json` : `prisma:generate`, `prisma:migrate` (= `prisma migrate dev`), `prisma:deploy` (= `prisma migrate deploy`), `prisma:studio`
- `prisma/schema.prisma` minimal : `datasource db { provider = "postgresql" url = env("DATABASE_URL") }` + `generator client { provider = "prisma-client-js" }` + un modèle pivot trivial (`model _Ping { id Int @id @default(autoincrement()) }`) juste pour avoir une migration non-vide

**DoD**
- `docker compose -f docker-compose.dev.yml up -d postgres` → conteneur healthy
- `pnpm prisma:migrate --name init` → migration initiale créée dans `prisma/migrations/` + appliquée
- `pnpm prisma:studio` ouvre l'UI sur http://localhost:5555 et affiche la table `_Ping` vide
- `docker exec ... psql -U fluch -d fluch_dev -c '\dt'` → table `_Ping` + `_prisma_migrations` listées

---

## S05b — Schéma better-auth (4 modèles)

**Taille** : S
**Dépendances** : S05a
**Goal** : schéma DB conforme à better-auth, prêt à être utilisé par le module Auth (S07).

**Tâches**
- Compléter `prisma/schema.prisma` avec les 4 modèles : `User`, `Session`, `Account`, `Verification` (cf. spec §5.13)
- **Vérifier d'abord la doc better-auth à jour** : les noms de champs (notamment `Account`/`Session`) ont évolué entre versions. Si écart vs §5.13, ajuster le schéma ET fixer la spec dans le même commit
- Supprimer le modèle `_Ping` de S05a
- `pnpm prisma:migrate --name better-auth-models` → migration des 4 modèles

**DoD**
- Les 4 tables `User`, `Session`, `Account`, `Verification` existent (`docker exec ... psql -c '\dt'`)
- Les contraintes critiques sont en place : `User.email UNIQUE`, `Account.(providerId, providerAccountId) UNIQUE`, `Session.token UNIQUE`, index sur les `userId` FK
- `prisma format` (via hook lint-staged si présent) ne touche pas le fichier (donc déjà formaté)
- `pnpm prisma:studio` montre les 4 tables vides

**Risque** : doc better-auth peut diverger de la spec §5.13. Si oui, mettre à jour la spec dans ce même commit.

---

## S05c — PrismaService + PrismaModule global injectables

**Taille** : S
**Dépendances** : S05a (pas besoin du schéma final pour valider l'injection)
**Goal** : `PrismaClient` accessible via DI partout, lifecycle propre (connect au boot, disconnect au shutdown).

**Tâches**
- `src/prisma/prisma.service.ts` : `@Injectable()` class `PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy` ; `async onModuleInit() { await this.$connect() }` ; `async onModuleDestroy() { await this.$disconnect() }`
- `src/prisma/prisma.module.ts` : `@Global() @Module({ providers: [PrismaService], exports: [PrismaService] })`
- Importer `PrismaModule` dans `AppModule`
- `app.enableShutdownHooks()` dans `main.ts` (sinon `onModuleDestroy` ne sera pas appelé sur SIGTERM)

**DoD**
- `pnpm dev` → log `Prisma Client connected` (debug log) ou aucune erreur de connexion
- Probe temporaire `src/_tmp_prisma_probe.ts` : controller minimal qui inject `PrismaService` et fait un `$queryRaw\`SELECT 1\`` → compile et retourne le résultat sans erreur
- `Ctrl+C` sur `pnpm dev` → pas de "unclosed connection" warning (le `$disconnect` a tourné)

---

## S05d — Seed dev (user admin)

**Taille** : XS
**Dépendances** : S05b, S05c
**Goal** : pouvoir reset+seed la DB de dev en 1 commande pour itérer rapidement.

**Tâches**
- `prisma/seed.ts` : si `NODE_ENV !== 'development'` → exit 0 (no-op silencieux) ; sinon `upsert` un user admin dev (email/name/role hardcodés, idempotent)
- Script `package.json` : `prisma:seed` (= `tsx prisma/seed.ts`) — installer `tsx` en devDep si pas encore présent
- Bloc `prisma` dans `package.json` : `{ "seed": "tsx prisma/seed.ts" }` (pour que `prisma migrate dev` invoque le seed automatiquement après reset)

**DoD**
- `pnpm prisma:seed` (avec `NODE_ENV=development`) → user admin créé/updaté en DB, exit 0
- `pnpm prisma:seed` (avec `NODE_ENV=production`) → exit 0 sans rien faire
- `pnpm prisma migrate reset --force` → seed exécuté automatiquement après reset

---

## S06 — Module common (filters, interceptors, decorators, guard, DTOs)

**Taille** : M
**Dépendances** : S04
**Goal** : infrastructure transverse en place. Permettra aux modules suivants (auth, users) de bien s'intégrer.

**Tâches**
- `src/common/filters/all-exceptions.filter.ts` (cf. spec §5.8 — HttpException + 4 erreurs Prisma mappées + format de réponse uniforme)
- `src/common/interceptors/logging.interceptor.ts` : log entrée/sortie HTTP avec durée et statusCode
- `src/common/interceptors/timeout.interceptor.ts` : timeout configurable (ex 30s), throw `RequestTimeoutException`
- `src/common/interceptors/request-id.interceptor.ts` : propage `x-request-id` en header de réponse (cf. spec §5.12bis)
- `src/common/pipes/validation-pipe.factory.ts` : factory exportant l'instance `ValidationPipe` configurée
- `src/common/decorators/public.decorator.ts` : `SetMetadata('public', true)`
- `src/common/decorators/current-user.decorator.ts` : `createParamDecorator` qui extrait `req.user`
- `src/common/dto/pagination.dto.ts` + `paginated-response.dto.ts` (cf. spec §5.12ter — offset/limit, helper `paginate()`)
- `src/common/guards/auth.guard.ts` (cf. spec §5.12) — ébaucher, finalisé en S07
- `src/observability/sentry.ts` : placeholder `initSentry()` (cf. spec §5.12quater)

**DoD**
- Test unitaire ou e2e du filter : provoquer une `P2002` Prisma → réponse 409 + format correct
- Logging interceptor visible dans les logs structurés quand on hit un endpoint
- `curl -H "x-request-id: abc-123" /health` (à valider en S09) → header `x-request-id: abc-123` en réponse
- Sans header `x-request-id` envoyé, la réponse contient quand même un UUID (généré par `RequestIdInterceptor` via `crypto.randomUUID()`)
- `@Public()` placé sur un controller test → permet de bypass le guard (à finaliser en S07)
- `PaginationDto` valide bien : `?page=-1` → 400, `?limit=200` → 400, `?page=2&limit=50` → OK

---

## S07 — Module Auth (better-auth)

**Taille** : L
**Dépendances** : S05b, S05c, S06
**Goal** : sign-up/sign-in email+password fonctionnels avec sessions cookies, guard global pour protéger les routes par défaut.

**Tâches**
- `pnpm add better-auth`
- `src/auth/auth.config.ts` (cf. spec §5.9) — factory `createAuth(prisma, env)` avec cookie flags explicites (httpOnly, secure-in-prod, sameSite:lax, prefix `fluch-`)
- `src/auth/auth.service.ts` : `@Injectable()`, instancie `betterAuth(...)` au boot, expose `auth` (l'instance complète)
- `src/auth/http-adapter.ts` : `toWebRequest`, `sendNodeResponse` (cf. spec §5.10)
- `src/auth/auth.controller.ts` : `@All('api/auth/*')` mounted handler (cf. spec §5.11), décoré `@Public()`
- `src/auth/auth.module.ts` : provide `AuthService`, register controller
- Finaliser `AuthGuard` (cf. spec §5.12)
- Enregistrer `AuthGuard` en `APP_GUARD` provider global dans `app.module.ts`
- Vérifier que CSRF protection de better-auth est bien active (par défaut oui — confirmer par un test)

**DoD**
- `POST /api/auth/sign-up/email` avec `{ email, password, name }` valides → 200, set-cookie session
- **Inspecter le set-cookie** : présent `HttpOnly`, `SameSite=Lax`, et `Secure` quand `NODE_ENV=production`
- Cookie nommé `fluch-session_token` (prefix configuré)
- `POST /api/auth/sign-in/email` avec credentials → 200, set-cookie
- Un endpoint protégé non décoré `@Public()` → 401 sans cookie
- Avec cookie session valide → 200, `req.user` populé
- **CSRF test** : sur une route mutante hors-auth (`PATCH /users/me`), sans le cookie sameSite-lax automatique du navigateur, la requête échoue depuis une origine étrangère (simuler via header `Origin: https://evil.com` + `Referer`)

**Risque** : la doc better-auth peut avoir évolué depuis la spec (champs schema, options CSRF, cookie API). Si écart, **fixer la spec en même temps que l'impl** (commit de fix sur ce repo design avant de continuer).

---

## S08 — Module Users

**Taille** : M
**Dépendances** : S06, S07
**Goal** : endpoints démontrant les patterns transverses : DTO + `@CurrentUser()` + pagination + décoration OpenAPI.

**Tâches**
- `src/users/dto/update-user.dto.ts` : champs `name?`, `image?` avec `class-validator` + `@ApiProperty` pour OpenAPI
- `src/users/dto/user-response.dto.ts` : shape de retour (id, email, name, image, role, createdAt) + `@ApiProperty`
- `src/users/users.service.ts` : `findById(id)`, `updateMe(userId, dto)`, `me(userId)`, `findMany(pagination): { items, total }`
- `src/users/users.controller.ts` :
  - `GET /users/me` → user courant via `@CurrentUser()`
  - `GET /users/:id` → user par ID (403 si pas `role: admin` et `id !== userId`)
  - `PATCH /users/me` avec `UpdateUserDto`
  - `GET /users` → liste paginée (admin uniquement, `PaginationDto` via `@Query`)
- `src/users/users.module.ts`
- Tagger le controller `@ApiTags('users')`

**DoD**
- `GET /users/me` avec session valide → user JSON correct, pas de `password`/`account` leak
- `GET /users/:id` d'un autre user en tant qu'user standard → 403
- `PATCH /users/me` avec payload invalide → 400 avec messages class-validator clairs
- `PATCH /users/me` avec `email` (pas dans DTO et whitelist activé) → 400 forbiddenNonWhitelisted
- `GET /users?page=2&limit=10` (admin) → `{ items, total, page, limit }` cohérent
- `GET /users?limit=200` → 400 (max 100)
- Sur Swagger `/docs`, les endpoints users apparaissent avec les bons DTOs, paramètres, et tag

---

## S09 — Module Health

**Taille** : S
**Dépendances** : S05c
**Goal** : endpoint `/health` consommable par orchestrateurs (k8s, docker, Render, etc.).

**Tâches**
- `pnpm add @nestjs/terminus`
- `src/health/health.controller.ts` : `@Get('health')` + `HealthCheck()` :
  - `PrismaHealthIndicator` (custom — `$queryRaw('SELECT 1')`)
  - `MemoryHealthIndicator.checkHeap('memory_heap', 300 * 1024 * 1024)`
- `src/health/health.module.ts`
- Décorer le controller `@Public()`

**DoD**
- `GET /health` → 200 avec `{ status: 'ok', info: { db: { status: 'up' } }, ... }`
- Couper la DB (`docker compose stop postgres`) → `GET /health` → 503

---

## S10 — Bootstrap final `main.ts` (hardening complet)

**Taille** : M
**Dépendances** : S04, S06
**Goal** : `main.ts` complet conformément à la spec §5.6 — inclut tout le hardening prod-ready : trust proxy, compression, body limit, versioning, Swagger, Sentry placeholder, request-id.

**Tâches**
- Installer : `pnpm add helmet compression cookie-parser @nestjs/swagger` ; `pnpm add -D @types/compression @types/cookie-parser`
- Implémenter `src/main.ts` exactement comme spec §5.6 (séquence complète : initSentry → NestFactory → useLogger → trust proxy → helmet → compression → cookieParser → json(limit) → cors → enableVersioning → useGlobalPipes → useGlobalFilters → enableShutdownHooks → Swagger setup → listen)
- Enregistrer `RequestIdInterceptor` comme `APP_INTERCEPTOR` global dans `app.module.ts`
- Swagger : UI montée sur `/docs` seulement si `NODE_ENV !== 'production'` ; `/docs-json` toujours actif (utile pour codegen client typé côté frontend)
- Versioning : `app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })`. Décorer le controller Health avec `@Version(VERSION_NEUTRAL)` SI on choisit de garder `/health` non-versionné (sinon il devient `/v1/health`)
- Vérifier `bufferLogs: true` pour que les logs du boot soient buffés vers `AppLogger` (déjà ajouté en S04)

**DoD**
- `pnpm dev` → boot < 3s, log "Application is running on: http://localhost:3000"
- `curl -I http://localhost:3000/v1/health` → headers de sécurité présents (x-content-type-options, x-frame-options, etc.)
- Sans header `Origin` ou avec origine non-autorisée → CORS rejette
- **Compression** : `curl -H "Accept-Encoding: gzip" /docs-json -I` → header `Content-Encoding: gzip`
- **Body size limit** : `curl -X POST -d "$(head -c 2000000 /dev/urandom | base64)" .../v1/users/me` → 413
- **Trust proxy** : `curl -H "X-Forwarded-For: 1.2.3.4" /v1/health` → les logs montrent `1.2.3.4` comme IP, pas l'IP du proxy
- **Versioning** : `/v1/health` → 200 ; `/health` (sauf si VERSION_NEUTRAL) → 404
- **Request-id** : `curl -H "x-request-id: my-trace-id" /v1/health` → réponse contient `x-request-id: my-trace-id`
- **Swagger UI** : `pnpm dev` → http://localhost:3000/docs montre l'UI avec tous les endpoints
- **Swagger UI désactivée en prod** : `NODE_ENV=production node dist/main.js` → `/docs` → 404, mais `/docs-json` → 200
- **Sentry placeholder** : `SENTRY_DSN=https://test@sentry.io/1 pnpm dev` → warning log "SENTRY_DSN defined but Sentry not wired up"
- `Ctrl+C` → log "shutdown" propre (pas de timeout)

---

## S11 — Setup testing (Vitest + Testcontainers)

**Taille** : M
**Dépendances** : S05b, S05c
**Goal** : infra de tests e2e avec Postgres réel éphémère. Aucun mock DB.

**Tâches**
- `pnpm add -D vitest @vitest/coverage-v8 vite-tsconfig-paths @testcontainers/postgresql supertest @types/supertest`
- `vitest.config.ts` (cf. spec §5.14)
- `test/setup.ts` (cf. spec §5.15) — exports `setup` + `teardown`
- `test/helpers/test-app.ts` (cf. spec §5.16)
- `test/helpers/reset-db.ts` (cf. spec §5.17)
- Scripts `package.json` : `test`, `test:watch`, `test:cov`

**DoD**
- `pnpm test` boot le container postgres, exécute les migrations, et termine sans tests (juste setup/teardown fonctionnels)
- Le container est bien arrêté à la fin (vérifier `docker ps -a | grep postgres` après le run — il doit y avoir un exit)
- Un test factice (`expect(1).toBe(1)`) passe vert

---

## S12 — Tests e2e (auth + users + health)

**Taille** : M
**Dépendances** : S07, S08, S09, S11
**Goal** : couverture end-to-end des flows critiques.

**Tâches**
- `test/e2e/health.e2e.spec.ts` : 200 avec DB up, 503 avec DB down (skip si compliqué à simuler, garder seulement le cas up)
- `test/e2e/auth.e2e.spec.ts` :
  - `POST /api/auth/sign-up/email` → 200, cookie présent
  - Re-sign-up même email → 409 (mapping P2002 du filter à valider)
  - `POST /api/auth/sign-in/email` avec mauvais password → 401
  - `POST /api/auth/sign-in/email` correct → 200, cookie
- `test/e2e/users.e2e.spec.ts` :
  - `GET /users/me` sans cookie → 401
  - `GET /users/me` avec cookie → 200, JSON user attendu
  - `PATCH /users/me` avec body valide → 200, données mises à jour
  - `PATCH /users/me` avec champ non-whitelisté → 400
- Avant chaque test : `await resetDb(prisma)`

**DoD**
- `pnpm test` → tous les specs verts
- Couverture sur les fichiers `src/auth/**` et `src/users/**` ≥ 80%
- Le run complet prend < 60s (Testcontainers compte pour la première fois ~15s)

---

## S13 — Dockerfile multi-stage

**Taille** : M
**Dépendances** : S05c, S10
**Goal** : image production minimale, prête à déployer.

**Tâches**
- `docker/Dockerfile` (cf. spec §5.18) — base distroless `:nonroot`, USER nonroot, COPY --chown, HEALTHCHECK avec fetch natif
- `.dockerignore` : `node_modules`, `dist`, `.git`, `.env*`, `coverage`, `test`, `*.md` sauf README
- Tester local : `docker build -f docker/Dockerfile -t fluch-api .`

**DoD**
- Image build < 3 min en cold cache, < 30s en warm cache
- `docker images fluch-api` → taille < 200MB
- `docker run -p 3000:3000 --env-file .env fluch-api` boot, `/v1/health` répond 200
- **Nonroot** : `docker inspect fluch-api --format '{{.Config.User}}'` → `nonroot:nonroot`
- **HEALTHCHECK actif** : `docker run -d --name probe fluch-api && sleep 15 && docker inspect probe --format '{{.State.Health.Status}}'` → `healthy`
- Le container ne contient pas de shell (`docker exec ... sh` → fail, signe distroless OK)

---

## S14 — docker-compose.dev.yml

**Taille** : S
**Dépendances** : aucune (peut être fait dès S01)
**Goal** : DB dev locale en une commande.

**Tâches**
- `docker-compose.dev.yml` (cf. spec §5.19)
- Ajouter au README la section "Quick start" mentionnant `docker compose -f docker-compose.dev.yml up -d`

**DoD**
- `docker compose -f docker-compose.dev.yml up -d` → postgres up et healthy en < 10s
- Adminer accessible sur http://localhost:8080
- `pnpm prisma migrate dev` fonctionne contre ce postgres

---

## S15 — CI workflows

**Taille** : M
**Dépendances** : S02, S12
**Goal** : pipeline CI complet, paths-filtered, monorepo-friendly.

**Tâches**
- `.github/workflows/ci-api.yml` (cf. spec §6.1)
- `.github/workflows/audit.yml` (cf. spec §6.2)
- Vérifier que les `paths:` filters fonctionnent (modifier un fichier hors-filter sur une branche test → workflow ne tourne pas)

**DoD**
- Pousser une PR avec une vraie modif `src/**` → 3 jobs `check`, `test`, `build` lancés, tous verts
- Pousser une modif seulement sur `README.md` → CI **ne tourne pas** (paths filter)
- L'audit cron est visible dans l'onglet Actions, et tourne le lundi matin

---

## S16 — Quality gates & meta files

**Taille** : M
**Dépendances** : S02, S15
**Goal** : tous les fichiers meta qui font un repo "production-quality" : commitlint, dependabot, license, codeowners, PR template, editorconfig, pre-push hook.

**Tâches**
- Installer : `pnpm add -D @commitlint/cli @commitlint/config-conventional`
- `commitlint.config.mjs` (cf. spec §5.22)
- `.husky/commit-msg` : `pnpm exec commitlint --edit $1`
- `.husky/pre-push` : `pnpm typecheck && pnpm test` (avec un skip si `SKIP_PREPUSH=1` pour les hotfix)
- `.github/dependabot.yml` (cf. spec §5.21) — avec commentaire d'en-tête expliquant l'adaptation monorepo (modifier `directory:`)
- `.github/CODEOWNERS` (cf. spec §5.25) — ajuster `@clement` au handle GitHub réel
- `.github/PULL_REQUEST_TEMPLATE.md` (cf. spec §5.25)
- `.editorconfig` (cf. spec §5.23)
- `LICENSE` MIT (cf. spec §5.24) — remplir année + nom
- `CONTRIBUTING.md` court : conventional commits accepted types, branch model (`main` direct ou feature branches + PR ?), revue obligatoire

**DoD**
- `git commit -m "wip"` → bloqué par commitlint ("subject must start with type")
- `git commit -m "feat(auth): add password reset"` → accepté
- `git push` avec une erreur TS non corrigée → bloqué par pre-push
- `SKIP_PREPUSH=1 git push` → passe
- **Test Dependabot config** : `gh workflow run` ou pousser sur GitHub → onglet "Security" > "Dependabot" affiche "Up to date" sans erreur de parsing
- LICENSE présent et reconnu par GitHub (le sidebar du repo affiche "MIT License")
- Ouvrir une PR de test → le template apparaît automatiquement avec la checklist
- `.editorconfig` détecté par les éditeurs courants (test rapide dans VS Code)

**Note monorepo** : tous ces fichiers (sauf `.editorconfig` qui peut rester) doivent être déplacés au root du monorepo. Dependabot directory ajustée. Le README S17 le documente.

---

## S17 — README complet

**Taille** : M
**Dépendances** : S01-S16
**Goal** : doc opérationnelle, le developer suivant peut se débrouiller sans poser de question.

**Tâches**
- Suivre la structure exacte de la spec §8 (14 sections)
- Pour chaque section, inclure les exemples de commandes / payloads réels du template
- Section "API documentation" : indiquer `/docs` (dev) et `/docs-json` (toujours), exemple de codegen client avec `openapi-typescript` ou similaire
- Section "Authentication flow" : exemples curl complets (sign-up, sign-in, /v1/users/me avec cookie)
- Section "Database" : commandes Prisma + référence à §13 de la spec pour la stratégie migrations prod
- Section "Docker" : montrer `nonroot` user et `HEALTHCHECK`
- Section "Monorepo integration" : décrire les 4 mécanismes (Husky conditionnel, paths CI, no hardcoded paths, dependabot `directory:`) avec exemple concret de relocation dans `apps/api/`
- Section "Adding OAuth providers" : indiquer où câbler dans `auth.config.ts`, pointer vers la doc better-auth
- Section "Conventional commits" : table des types (feat, fix, chore, docs, refactor, test, ci, perf), exemple complet
- Section "Production checklist" : régénérer `BETTER_AUTH_SECRET`, activer `SENTRY_DSN`, ajuster `connection_limit` sur `DATABASE_URL`, configurer le reverse proxy pour `X-Forwarded-For`, snapshot DB avant migrations

**DoD**
- Un dev qui découvre le repo peut faire le quick start en < 5 min
- Toutes les variables d'env sont documentées
- Section Monorepo lisible et actionnable (pas juste théorique)
- Section "Production checklist" exhaustive et actionnable

---

## S18 — Smoke tests finaux (acceptance)

**Taille** : M
**Dépendances** : toutes les autres
**Goal** : valider les 25 critères de la spec §9 sur une session propre.

**Tâches**
- Cloner le repo dans un dossier neuf
- Suivre les 25 points de la spec §9 dans l'ordre
- Tester aussi le test monorepo (point 24) — c'est le plus susceptible de mordre
- Noter et corriger toute friction (typo dans le README, dépendance manquante, etc.)

**DoD**
- Les 25 critères de la spec §9 sont OK
- Un tag `v0.1.0` est créé sur `main`

---

## Ordre d'exécution recommandé

**Phase 1 — Fondations (peut se faire en série sur ~2 jours)**
S01 → S02 → S03 → S04

**Phase 2 — Persistence (1 jour)**
S05a → S05b → S05c → S05d (S05c peut être bossé en parallèle de S05b si on accepte un schéma temporaire ; S05d est optionnel pour débloquer S06+)

**Phase 3 — Infrastructure transverse (½ jour)**
S06

**Phase 4 — Domaine (1,5 jour, séquentiel)**
S07 → S08 → S09 → S10

**Phase 5 — Tests (1 jour, séquentiel)**
S11 → S12

**Phase 6 — Packaging (peut se paralléliser sur ~1 jour)**
S13 ‖ S14 ‖ S15

**Phase 7 — Quality gates & meta (½ jour)**
S16

**Phase 8 — Finition (½ jour)**
S17 → S18

**Total estimé** : 7-9 jours-développeur (avec hardening complet — ce qui sépare un POC d'un template vraiment production-ready).

## Notes au développeur

- **Ne pas dévier de la spec** sans la mettre à jour en même temps. La spec et les stories vivent dans le repo `flush-design` (à côté de `design-skill-spec.md`) — pousser un commit là quand un écart est nécessaire.
- **La doc better-auth peut diverger** des bouts de code de la spec (§5.9, §5.13). Vérifier au moment de S07 — c'est la story la plus risquée.
- **Le pattern monorepo-safe** (§7 spec, S02 + S15 + S16 stories) est un point critique. Trois mécanismes : (1) `prepare` script conditionnel pour Husky, (2) `paths:` filters dans les workflows CI, (3) commentaire d'en-tête dans `dependabot.yml` rappelant d'ajuster `directory:`. Ne négliger aucun des trois.
- **Conventional commits dès S16** : à partir du moment où commitlint est installé, tous les commits suivants doivent suivre la convention (sinon Husky les bloque). Faire les commits S01-S15 dans un style libre est OK ; à partir de S16 c'est strict.
- Pour **chaque story**, faire un commit séparé avec un titre type `feat: S01 bootstrap project` (après S16), ou `S01: bootstrap project` (avant S16). Facilite la relecture et permet à l'user de checker au fil de l'eau.
