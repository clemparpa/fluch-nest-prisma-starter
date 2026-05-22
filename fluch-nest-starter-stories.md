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

## S8.1 — Pivot validation : Prisma types + `prisma-zod-generator`

**Taille** : M
**Dépendances** : S08
**Goal** : remplacer la stack `class-validator` + DTOs hand-written par une stack **Prisma-as-source-of-truth** : types Prisma générés pour les responses, schémas Zod auto-générés depuis Prisma pour la validation runtime des inputs. Une seule source de vérité, plus de drift schéma DB ↔ schémas HTTP.

**Contexte** :
S08 a livré le module Users avec `class-validator` + `UpdateUserDto` / `UserResponseDto` / `PaginationDto` + `@nestjs/swagger` `@ApiProperty`. C'est conventionnel mais introduit :
- 3 stacks de typage à maintenir (Prisma, class-validator, Swagger decorators) ;
- du `@ApiProperty()` à dupliquer manuellement à chaque champ ;
- un risque de drift quand un champ Prisma bouge sans qu'on touche le DTO ;
- des DTOs "response" pures-recopies des types Prisma (`UserResponseDto` = `Pick<User, ...>`).

Zod est déjà utilisé pour `env.schema.ts` (S04). Standardiser sur Zod via `prisma-zod-generator` aligne tout l'input validation runtime sur la même lib et fait des schémas Prisma la source unique.

**Décisions techniques arrêtées (instructions détaillées par l'user au démarrage de la story)**
- Pipe de validation global : **`nestjs-zod`** (`ZodValidationPipe`). Remplace `createValidationPipe()` (factory `class-validator` actuelle).
- Le détail du wiring `nestjs-zod` (use-global pipe vs `APP_PIPE` provider, gestion des erreurs, eventuelle config Swagger `nestjs-zod/zod-dto`) sera précisé par l'user à l'ouverture de la story — ne pas anticiper les choix d'implémentation ici.

**Tâches**
- Installer : `pnpm add zod nestjs-zod` ; `pnpm add -D prisma-zod-generator`
- Ajouter le generator dans `prisma/schema.prisma` :
  ```prisma
  generator zod {
    provider = "prisma-zod-generator"
    output   = "../src/generated/zod"
  }
  ```
  Puis `pnpm prisma generate` → schémas Zod auto-générés (`UserUpdateInputSchema`, `UserCreateInputSchema`, etc.)
- Câbler le `ZodValidationPipe` de `nestjs-zod` (remplace `createValidationPipe()` dans `src/main.ts`)
- Supprimer `src/users/dto/user-response.dto.ts` ; les controllers retournent `Pick<User, 'id' | 'email' | 'name' | 'image' | 'role' | 'createdAt'>` (type Prisma direct)
- Supprimer `src/users/dto/update-user.dto.ts` ; le `@Body()` utilise un schéma Zod custom (subset de `UserUpdateInputSchema`, sans `email`/`role`/`emailVerified`)
- Refacto `PaginationDto` → schéma Zod (`src/common/dto/pagination.schema.ts`)
- Supprimer `class-validator`, `class-transformer`, `@nestjs/swagger`-decorators de `package.json` (vérifier qu'aucun import résiduel ne casse — S10 réintroduira Swagger via `nestjs-zod`'s `@nestjs/swagger` integration si besoin)
- Supprimer `createValidationPipe()` (`src/common/pipes/validation-pipe.factory.ts`) si plus utilisée
- Mettre à jour la note Biome (`useImportType`) : les schémas Zod sont des constantes, pas des classes — donc plus de problème "import type vs value" pour les DTOs

**DoD**
- `pnpm typecheck` → 0 erreur
- `pnpm check` → 0 erreur
- `pnpm dev` → boot OK
- `PATCH /users/me` `{"email":"x@x.com"}` → 400 (Zod rejette champ non-listé, équivalent `forbidNonWhitelisted`)
- `PATCH /users/me` `{"name":""}` → 400 message Zod clair (`name: String must contain at least 1 character(s)`)
- `GET /users?limit=200` → 400 (Zod `max(100)`)
- `package.json` ne contient plus `class-validator` ni `class-transformer`
- `src/generated/zod/` contient un schéma par modèle Prisma, ré-généré à chaque `prisma generate`
- (Régression S08) Tous les DoD curl de S08 passent toujours

**Hors-scope**
- Pas de génération de client typé front depuis les schémas Zod (S08 livre les types Prisma + schémas Zod côté backend ; le partage frontend est une décision séparée)
- Pas d'intégration `nestjs-zod` ↔ `@nestjs/swagger` (déléguée à S10 quand Swagger sera wiré)

---

## S8.2 — Pivot tests : vitest + supertest contre DB dev

**Taille** : M
**Dépendances** : S08, S8.1
**Goal** : remplacer les smoke curl tests par une suite e2e reproductible. Setup minimal `vitest` + `supertest` qui hit la DB dev (sans Testcontainers, ça vient en S11). Chaque story à partir de S09 ship avec ses propres tests.

**Contexte** :
Les stories S07, S08, S8.1 ont chacune été validées par ~10 commandes `curl` manuelles. C'est non-reproductible, sensible à l'état DB, et ne survit pas à un refactor. Décision prise post-S08 : on n'attend pas S11 pour avoir un harness. On démarre minimal (Vitest + supertest contre DB dev) et S11 ajoutera juste Testcontainers pour l'isolation par-test.

**Tâches**
- Installer : `pnpm add -D vitest @vitest/coverage-v8 supertest @types/supertest`
- `vitest.config.ts` à la racine : preset NestJS-compatible, alias `@/`, `pool: 'forks'`, timeout 10s
- `test/setup.ts` : crée une `INestApplication` une fois par run, attaque la DB dev locale
- `test/e2e/helpers/auth.ts` : helpers `signUpAndGetCookie(app, email, password, name)` + `signInAndGetCookie(app, email, password)` + `resetTestUsers(prisma)` (cleanup des users de test, garde l'admin seed)
- `test/e2e/users.e2e.spec.ts` :
  - `GET /users/me` sans cookie → 401
  - `GET /users/me` avec cookie lambda → 200, shape exact
  - `GET /users/:id` lambda → autre user → 403
  - `GET /users/:id` admin → autre user → 200
  - `PATCH /users/me` payload valide → 200
  - `PATCH /users/me` `{email:'x'}` → 400 (whitelist Zod)
  - `PATCH /users/me` `{name:''}` → 400 (MinLength Zod)
  - `GET /users` lambda → 403
  - `GET /users?limit=10` admin → shape paginé
  - `GET /users?limit=200` → 400
  - `GET /users/invalid-id` → 404
- `test/e2e/auth.e2e.spec.ts` :
  - sign-up valide → 200 + cookie `fluch.session_token`
  - sign-up password < 12 chars → 400
  - sign-in correct → 200 + cookie
  - sign-in faux password → 401
  - `GET /api/auth/get-session` avec cookie → 200 + JSON session
- Scripts `package.json` : `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:cov": "vitest run --coverage"`
- README : section "Tests" avec les commandes + note "DB dev doit tourner"

**DoD**
- `pnpm test` → tous les specs verts, durée < 15s
- Le run ne nécessite **pas** Docker au-delà de la DB Postgres dev déjà running
- Un `prisma migrate reset` puis `pnpm test` re-passe (la suite est self-contained — chaque test crée ses propres users)
- `pnpm test:cov` → couverture > 75% sur `src/users/**` et `src/auth/**`
- Modifier `src/users/users.controller.ts` (ex: remplacer `me.role !== 'admin'` par `me.role === 'admin'`) → `pnpm test` rouge (régressions détectées)

**Hors-scope**
- Pas de Testcontainers (S11 ajoute l'isolation par test)
- Pas de tests unitaires (services testés via e2e suffisent pour ce starter ; le pattern unit-test viendra avec les modules métier downstream)
- Pas de CI hookup encore (S15)

---

## S8.3 — Pivot monorepo pnpm

**Taille** : M
**Dépendances** : S8.2
**Goal** : refactor structurel du repo en monorepo pnpm. Aucun code métier touché. Pose les fondations pour les packages partagés (S8.4) et tout ce qui suit.

**Contexte** : avant que le code grossisse (TS-Rest + multi-tenant + modules métier tenant-scoped), on bascule en monorepo pour permettre `packages/api-contracts` partagé avec le futur front. Déménager plus tard = 10× plus de friction.

**Tâches**
- Créer `apps/api/` et déplacer `src/`, `prisma/`, `test/`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`, `nest-cli.json` dedans
- Adapter `pnpm-workspace.yaml` : ajouter `packages: ['apps/*', 'packages/*']`
- Adapter `package.json` racine : devient un workspace root avec scripts qui délèguent (`"dev": "pnpm --filter @fluch/api dev"`, etc.)
- `apps/api/package.json` : `"name": "@fluch/api"`, scripts d'origine déplacés
- Adapter chemins : `docker-compose.dev.yml` reste à la racine (DB partagée), `prisma.config.ts` déplacé dans `apps/api/`
- Adapter biome : `biome.json` à la racine, ignore-paths adaptés (`apps/*/dist`, `apps/*/coverage`)
- Adapter Husky `.husky/pre-commit` : lint-staged à la racine, délègue via filter (`pnpm --filter @fluch/api ...`)
- Adapter vitest path dans tests : `@/` reste mais résout vers `apps/api/src/`

**DoD**
- `pnpm install` à la racine → installe tout
- `pnpm dev` (root) → boot l'API depuis `apps/api/`
- `pnpm test` → 19 tests S8.2 toujours verts
- `pnpm check` && `pnpm typecheck` → 0 erreur
- `pnpm prisma migrate dev --name xxx` exécuté depuis la racine → fonctionne (chemin `apps/api/prisma/`)
- `docker compose -f docker-compose.dev.yml up -d` → DB toujours up
- Le commit S8.2 (4d5e8db) reste réf dans git log — aucune perte d'historique

**Hors-scope**
- Pas de `packages/api-contracts` encore (S8.4)
- Pas de `packages/tsconfig` partagé (S8.4)
- Pas de refacto Users en TS-Rest (S8.4)

---

## S8.4 — Packages partagés (api-contracts) + refacto Users en TS-Rest

**Taille** : M
**Dépendances** : S8.3, S8.1
**Goal** : créer `packages/api-contracts/` qui exporte le premier contrat TS-Rest (Users). Refacto le module Users existant pour consommer ce contrat. Établit le pattern qui sera répété pour chaque module métier suivant.

**Contexte** : le starter livre une API type-safe end-to-end via TS-Rest. Le contrat (input/output Zod schemas + endpoints) vit dans `packages/api-contracts/` et est consommé par `apps/api/` (back) et plus tard `apps/web/` (front). Users est refacto pour cohérence — tous les modules suivants seront en TS-Rest, autant aligner Users dès maintenant.

**Tâches**
- Créer `packages/api-contracts/` :
  - `package.json` (`"name": "@fluch/api-contracts"`, exports configurés)
  - `tsconfig.json` (extends `packages/tsconfig/base.json`)
  - `src/users/contract.ts` : contrat TS-Rest pour `/users/me`, `/users/:id`, `/users` (paginé), `PATCH /users/me`
  - `src/users/schemas.ts` : Zod schemas (réutilise `UserUpdateInputSchema` généré, expose `UserResponseSchema` filtré)
  - `src/index.ts` : barrel export
- Créer `packages/tsconfig/` :
  - `base.json` : config commune (strict, ES2022, etc.)
  - `api.json` : extends base, ajoute decorators + emitDecoratorMetadata
  - `package.json` (`"name": "@fluch/tsconfig"`)
- `apps/api/tsconfig.json` : extends `@fluch/tsconfig/api.json`
- `pnpm add -w @ts-rest/core @ts-rest/nest @ts-rest/open-api` (dans apps/api)
- Refacto `apps/api/src/users/users.controller.ts` :
  - Remplace les `@Get/@Patch` Nest natifs par `@TsRestHandler(usersContract.xxx)` + `tsRestHandler()`
  - Import du contrat depuis `@fluch/api-contracts`
  - Les types des params/body/response sont inférés du contrat → suppression manuelle de types redondants
- Vérifier que les tests e2e Users (S8.2) passent toujours sans modif (routes inchangées côté HTTP)

**DoD**
- `pnpm typecheck` → 0 erreur
- `pnpm test` → 19 tests S8.2 toujours verts (régression zéro)
- Le contrat est importable côté apps/api : `import { usersContract } from '@fluch/api-contracts'`
- Test de typage : changer manuellement le `name` schema dans le contrat → le controller `apps/api` ne compile plus → preuve que le typage flow contrat → controller
- `packages/api-contracts` build standalone : `pnpm --filter @fluch/api-contracts build` produit un dist consommable
- `pnpm check` → 0 erreur (biome heureux)

**Hors-scope**
- Pas de partage front (pas d'`apps/web` encore)
- Pas de `@ts-rest/open-api` câblé sur main.ts (S10 le fait)
- Pas d'autres modules en TS-Rest (Users seulement comme exemple ; les suivants seront déjà natifs TS-Rest)

---

## S8.5 — better-auth plugins (organization + admin) + permissions

**Taille** : M
**Dépendances** : S07, S05b (schema better-auth)
**Goal** : activer les plugins `organization` et `admin` de better-auth + définir `createAccessControl` avec statements + roles + brancher les décorateurs thallesp (`@Roles`/`@OrgRoles`/`@UserHasPermission`/`@MemberHasPermission`).

**Contexte** : nécessaire pour le multi-tenant (S8.6 lit `session.session.activeOrganizationId`) et pour le RBAC dans tous les modules métier suivants. Doit être en place AVANT l'infra tenant.

**Tâches**
- `pnpm add @thallesp/nestjs-better-auth` (déjà présent ? vérifier)
- Ajouter au schema Prisma les modèles better-auth `organization` + `admin` :
  - `Organization` (id, name, slug, createdAt, ...)
  - `Member` (userId, organizationId, role) — table de jointure
  - `Invitation` (email, organizationId, expiresAt, status, ...)
  - Étendre `User` avec `role` (system-wide) si pas déjà — déjà là
  - Étendre `Session` avec `activeOrganizationId` (better-auth pose ça)
- `pnpm prisma migrate dev --name auth-org-admin-models`
- `apps/api/src/auth/permissions.ts` :
  - Définir `statement` (placeholder réaliste : `user`, `organization`, `member`, `invitation` actions)
  - Créer `ac = createAccessControl(statement)`
  - Définir 2-3 roles : `member`, `admin`, `owner`
- `apps/api/src/auth/auth.config.ts` : ajouter `plugins: [organization({ ac, roles: { member, admin, owner } }), admin({ ac, roles: { ... } })]`
- Brancher `AuthModule.forRootAsync()` pour s'assurer que `AuthGuard` global est wired avec les décorateurs thallesp
- Documenter dans la doc archi (stack-decisions.md a déjà la section, juste pointer)
- Ajouter quelques tests e2e dans `test/e2e/auth-rbac.e2e.spec.ts` :
  - User sans permission `user.delete` → `@UserHasPermission({ permission: { user: ['delete'] } })` route → 403
  - Org owner → `@OrgRoles(['owner'])` route → 200
  - Org member → `@OrgRoles(['owner'])` route → 403
  - System admin → `@Roles(['admin'])` route → 200
  - **Anti privilege-escalation** : org owner → `@Roles(['admin'])` route → 403 (séparation system/org)

**DoD**
- `pnpm typecheck` → 0 erreur
- `pnpm test` → tous les tests précédents verts + ~5 nouveaux RBAC
- Sign-up via better-auth crée une session sans `activeOrganizationId` (par défaut)
- Création d'org via `auth.api.createOrganization({...})` → membre owner créé automatiquement
- Switch d'org via better-auth → `session.session.activeOrganizationId` change

**Risque** : la doc thallesp peut diverger entre versions. Si écart, fixer la doc archi (stack-decisions.md) dans le même commit.

---

## S8.6 — Multi-tenant infrastructure (extension Prisma + ALS + DMMF + tests battle-tested)

**Taille** : L
**Dépendances** : S05c (PrismaService), S8.5 (organization plugin)
**Goal** : poser l'infra complète d'isolation multi-tenant. Toute query Prisma sur un modèle avec colonne `organizationId` est automatiquement filtrée par l'org active. Le filtre n'est bypass-able que via `runAsAdmin()` ou injection explicite de `UnsafePrismaService`.

**Contexte** : C'est le différenciateur clé du starter SaaS B2B. Doit être 100% battle-tested AVANT le premier module métier tenant-scoped (S8.8). Story L mais on fera plusieurs commits intermédiaires pour faciliter la revue.

**Décisions architecturales arrêtées (à appliquer telles quelles)**
- **3 états ALS stricts** :
  - `undefined` (default, pas de store) → l'extension **throw** si modèle tenant-scoped touché
  - `null` → bypass explicite (seulement via `runAsAdmin()` ou `tenantStorage.run({ tenantId: null }, ...)`)
  - `string` non-vide → filtre injecté
  - **JAMAIS** de `?? null` dans le middleware/interceptor (c'est le bug principal à éviter)
- **MODELS_WITH_TENANT runtime via DMMF** :
  ```ts
  export const MODELS_WITH_TENANT = new Set(
    Prisma.dmmf.datamodel.models
      .filter(m => m.fields.some(f => f.name === 'organizationId'))
      .map(m => m.name)
  )
  ```
  Pas de fichier généré, pas de script postgenerate. Une seule SoT (schema.prisma).
- **UnsafePrismaService** (renommer la classe `PrismaService` actuelle) cohabite avec un Factory provider exposant `TenantScopedPrismaClient` via token `PRISMA` (`@InjectPrisma()`)
- **Interceptor global** (pas middleware) car doit s'exécuter APRÈS l'AuthGuard pour lire `req.session.session.activeOrganizationId`
- **Lint rule** `no-restricted-imports` qui bloque `UnsafePrismaService` hors `apps/api/src/jobs/**`, `apps/api/prisma/seed.ts`, `apps/api/scripts/**`
- **Décorateur `@RequiresOrg()`** : guard léger qui renvoie 400 propre si session sans `activeOrganizationId` sur une route qui exige un tenant. Évite le 500 from extension.

**Tâches**
1. Renommer `apps/api/src/prisma/prisma.service.ts` → `unsafe-prisma.service.ts`, classe `PrismaService` → `UnsafePrismaService` (préfixe `Unsafe` volontaire, ne pas adoucir)
2. Créer `apps/api/src/tenant/tenant.storage.ts` :
   - `AsyncLocalStorage<TenantContext>` avec type strict `{ tenantId: string } | { tenantId: null }`
   - Helper `runAsAdmin<T>(fn): Promise<T>`
3. Créer `apps/api/src/prisma/tenant-extension.ts` :
   - Génère `MODELS_WITH_TENANT` runtime via DMMF
   - `tenantExtension(getTenantId)` factory
   - Logique stricte : `=== null` → bypass, `!tenantId` → throw, sinon inject filtre dans where/data selon op
   - Gère `findUnique/findFirst/findMany/count/aggregate/groupBy` (where) + `update/updateMany/delete/deleteMany` (where) + `create/upsert` (data) + `createMany/createManyAndReturn` (data array ou single)
4. Modifier `apps/api/src/prisma/prisma.module.ts` :
   - Provider `UnsafePrismaService` (raw)
   - Provider factory `PRISMA` (token Symbol) qui produit `raw.$extends(tenantExtension(() => tenantStorage.getStore()?.tenantId))`
   - Export type `TenantScopedPrismaClient = ReturnType<UnsafePrismaService['$extends']>`
   - Décorateur `InjectPrisma = () => Inject(PRISMA)`
   - `@Global()`, exporte `UnsafePrismaService` + `PRISMA`
5. Créer `apps/api/src/tenant/tenant.interceptor.ts` :
   - Lit `req.session.session.activeOrganizationId`
   - Si présent → `tenantStorage.run({ tenantId: orgId }, () => next.handle().subscribe(observer))`
   - Si absent → pas de `run()` (getStore() retournera undefined → throw défensif si modèle tenant touché)
6. Enregistrer `TenantInterceptor` en `APP_INTERCEPTOR` (APRÈS l'AuthGuard) dans `AppModule`
7. Créer `apps/api/src/common/decorators/requires-org.decorator.ts` + guard associé qui 400 si pas d'org active
8. Créer `apps/api/src/common/decorators/run-as-admin.ts` — re-export de `runAsAdmin` depuis tenant.storage
9. Lint rule biome (ou eslint si biome ne supporte pas no-restricted-imports — vérifier) :
   - Blocker `UnsafePrismaService` dans `apps/api/src/**/*.service.ts` et `apps/api/src/**/*.controller.ts`
   - Override autorisé dans `apps/api/src/jobs/**`, `apps/api/prisma/**`, `apps/api/scripts/**`
   - **Note** : biome ne supporte pas no-restricted-imports patterns aussi précis que ESLint. Si bloqueur, soit ajouter ESLint en parallèle (paths-restricted only), soit faire un test automatisé (grep CI) qui échoue si import détecté hors paths autorisés.
10. Refacto les services existants (`apps/api/src/users/users.service.ts`) pour utiliser `@InjectPrisma()` (Users n'est PAS tenant-scoped mais valide qu'on n'a pas régressé)
11. **Suite de tests battle-tested** (`test/unit/tenant-extension.spec.ts` + `test/e2e/tenant-isolation.e2e.spec.ts`) :
    - **Unit (extension mock)** :
      - getStore() undefined + modèle tenant-scoped → throw
      - `{ tenantId: '' }` → throw (defensive)
      - `{ tenantId: null }` → pass-through, args inchangés
      - `{ tenantId: 'org-1' }` + findMany Post → args.where contient `{ tenantId: 'org-1' }`
      - `{ tenantId: 'org-1' }` + create Post → args.data contient `{ tenantId: 'org-1' }`
      - `{ tenantId: 'org-1' }` + createMany Post → chaque item de args.data contient `{ tenantId: 'org-1' }`
      - Modèle hors MODELS_WITH_TENANT → args inchangés
    - **E2E isolation** :
      - Créer 2 orgs (A, B), 2 users (Alice@A, Bob@B)
      - **Note** : ce test nécessite un modèle exemple tenant-scoped. Décision : **on introduit `_TestPost` minimal en S8.6** (`id`, `title`, `organizationId`) juste pour la suite de tests, supprimé en S8.8 quand le vrai module arrive. Justifie : on ne shipped pas l'infra sans preuve d'isolation.
      - Alice crée un `_TestPost` → seul filtre `tenantId: 'org-A'` injecté → OK
      - Bob (session org-B) liste `_TestPost` → `[]` (pas le post d'Alice)
      - Bob tente d'update le post d'Alice par ID → 404 (record not found, à cause du filtre dans where)
      - Test concurrence ALS : 2 requêtes concurrentes (Alice + Bob) → chacune voit son propre tenantId, pas de mix

**DoD**
- `pnpm typecheck` → 0 erreur
- `pnpm test` → tous les tests précédents verts + suite tenant-extension verte + suite tenant-isolation verte
- Tenter d'importer `UnsafePrismaService` dans `apps/api/src/users/users.service.ts` → lint rule bloque
- `runAsAdmin(() => prisma.user.deleteMany({ where: { email: 'x' } }))` dans un script → exécuté sans throw (bypass)
- Service métier qui appelle `prisma.post.findMany()` sans tenant context → throw clair
- Doc archi tenant-extension.md mise à jour avec les 3 états ALS stricts + DMMF + @RequiresOrg + lint rule

**Hors-scope**
- Pas de Hygen pour scaffold les modules tenant-scoped (reporté)
- Pas de migration "modèle existant → tenant-scoped" doc (déjà couverte en section 9 de tenant-extension.md)

---

## S8.7 — Hook user.created → événements Nest (découplage des effets de bord)

**Taille** : S
**Dépendances** : S8.5 (organization plugin), S8.6 (infra tenant si listeners touchent du tenant-scoped)
**Goal** : remplacer un hook better-auth monolithique par un dispatcher d'événements Nest. Un seul `@AfterCreate('user')` qui emit `user.created`, N listeners découplés (créer org par défaut, mail welcome, seed démo, queue onboarding).

**Contexte** : sans cette story, le hook `@AfterCreate('user')` ferait 4 choses → couplage fort, tests pénibles, fail d'une étape bloque les autres. Le pattern event-emitter est le standard Nest pour ce cas.

**Décisions arrêtées**
- **`emitAsync`** (pas `emit`) pour que le hook better-auth attende la fin des listeners avant de retourner. Sinon race conditions au signup.
- **Listeners post-commit** : pas d'accès à la transaction better-auth depuis les listeners. Effets de bord acceptent que l'user est déjà commité.
- **Au moins 1 listener implémenté** dans la story : "créer une org par défaut" (le plus fréquent en SaaS B2B). Les autres (mail, seed, queue) restent placeholders documentés.

**Tâches**
- `pnpm add @nestjs/event-emitter`
- `apps/api/src/app.module.ts` : `EventEmitterModule.forRoot()` global
- Créer `apps/api/src/auth/hooks/user-created.hook.ts` :
  - Un seul `@AfterCreate('user')` qui appelle `eventEmitter.emitAsync('user.created', { user })`
- Créer `apps/api/src/auth/listeners/create-default-org.listener.ts` :
  - `@OnEvent('user.created', { async: true })`
  - Crée une org dont le nom = `<user.name>'s workspace` (placeholder), user devient owner
  - Met l'org active sur la session de l'user (via better-auth API)
- Type `UserCreatedEvent` partagé dans `apps/api/src/auth/events.ts`
- Tests e2e dans `test/e2e/auth-hooks.e2e.spec.ts` :
  - Sign-up → user créé ET org par défaut créée
  - Session active de l'user nouvellement signé contient bien `activeOrganizationId`

**DoD**
- `pnpm test` → tous les tests précédents verts + nouveaux tests hook verts
- Code des effets de bord (création d'org) est dans le listener, pas dans le hook better-auth
- Ajout d'un 2e listener (placeholder `console.log` "send welcome email") → fonctionne sans toucher au hook

**Hors-scope**
- Pas de mail welcome réel (placeholder log)
- Pas de seed démo / queue onboarding (placeholders documentés)
- Pas de gestion d'erreur sophistiquée (un listener qui throw bloque-t-il les autres ? À tester et documenter — `emitAsync` propage par défaut, à wrap en try/catch dans chaque listener si on veut isolation)

---

## S8.8 — Module exemple tenant-scoped (Post)

**Taille** : M
**Dépendances** : S8.4 (TS-Rest pattern), S8.6 (infra tenant), S8.7 (org auto-créée au signup)
**Goal** : premier module métier complet tenant-scoped. Sert de **template de référence** pour tous les modules suivants (et plus tard pour Hygen). Démontre : contrat TS-Rest dans `packages/api-contracts`, controller + service consommant `@InjectPrisma()`, tests e2e d'isolation entre 2 orgs.

**Contexte** : on a posé l'infra (S8.3-S8.7), on prouve qu'elle fonctionne via un module réel. Choix `Post` (modèle universel, simple à comprendre).

**Tâches**
- Schema Prisma : ajouter `Post` (id, title, content, authorId, organizationId, createdAt, updatedAt)
- Migration : `pnpm prisma migrate dev --name add-post-model`
- Supprimer le `_TestPost` introduit en S8.6 (remplacé par le vrai Post)
- Adapter la suite de tests d'isolation S8.6 pour qu'elle utilise `Post` (pas `_TestPost`)
- `packages/api-contracts/src/posts/contract.ts` : contrat TS-Rest (CRUD complet)
- `packages/api-contracts/src/posts/schemas.ts` : Zod schemas (CreatePostInput, UpdatePostInput, PostResponse)
- `apps/api/src/posts/posts.module.ts`
- `apps/api/src/posts/posts.controller.ts` : handlers TS-Rest, décoré `@RequiresOrg()`, permissions via `@MemberHasPermission({ permissions: { post: ['create'] } })` etc.
- `apps/api/src/posts/posts.service.ts` : utilise `@InjectPrisma()` + ownership row-level (`where: { id, authorId: user.id }` pour update/delete d'un user standard, override admin via permissions)
- Ajouter statements et permissions Post à `permissions.ts` (S8.5)
- Tests e2e `test/e2e/posts.e2e.spec.ts` :
  - CRUD complet par user d'une org
  - User org-A ne voit pas les posts org-B (isolation tenant)
  - User org-A non-auteur tente de supprimer un post de son org → 404 (ownership row-level)
  - Org owner peut tout supprimer dans son org (permissions admin)

**DoD**
- `pnpm test` → tous les tests précédents verts + nouveaux tests Post verts
- `GET /v1/posts` org-A → liste filtrée org-A automatiquement (via extension, pas dans le service)
- `POST /v1/posts` org-A → `organizationId` injecté automatiquement (extension)
- Le contrat Post est importable depuis `@fluch/api-contracts`
- Test "fail loud" : commenter le décorateur `@RequiresOrg()` et appeler `GET /v1/posts` avec session sans org active → 500 from extension (preuve que le throw défensif fonctionne)

**Hors-scope**
- Hygen scaffolding (reporté post-S18)
- Refacto Users pour devenir tenant-scoped (Users reste système-wide — pas un cas pertinent ici)

---

## S09 — Module Health

**Taille** : S
**Dépendances** : S05c
**Goal** : endpoint `/health` consommable par orchestrateurs (k8s, docker, Render, etc.).

**Note monorepo** : tous les chemins de fichiers dans cette story sont relatifs à `apps/api/` après S8.3.

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
- Swagger : UI montée sur `/docs` seulement si `NODE_ENV !== 'production'` ; `/docs-json` toujours actif. **Utiliser `nestjs-zod` + `@ts-rest/open-api` pour générer le doc** depuis les contrats TS-Rest (cf. S8.4) — pas de `@nestjs/swagger` natif qui ne sait pas lire les Zod schemas générés en S8.1.
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

## S8.11 — Ajout Testcontainers (isolation par-test)

**Taille** : S (raboté depuis le M original)
**Dépendances** : S8.2
**Goal** : remplacer la DB dev partagée des tests par un container Postgres éphémère qui démarre/stoppe par run. Permet d'isoler les tests entre eux et de paralléliser entre files.

**Contexte** : S8.2 a posé vitest+supertest contre la DB dev (singleFork: true, pattern email `@test.local` pour le cleanup). S8.11 ajoute Testcontainers pour : 1) parallélisation entre files, 2) reset DB total entre fichiers de tests, 3) reproductibilité totale (CI sans DB dev).

**Tâches**
- `pnpm add -D @testcontainers/postgresql`
- Modifier `test/setup.ts` (S8.2) : ajouter `globalSetup` qui lance un container Postgres, exporte la `DATABASE_URL`, exécute `prisma migrate deploy`
- Retirer `fileParallelism: false` de vitest.config.ts → autorise parallel
- Adapter `resetTestUsers()` en `resetDb()` (truncate complet possible maintenant que la DB est éphémère)

**DoD**
- `pnpm test` → tous les tests précédents verts, durée < 60s (incluant boot container ~15s première fois)
- `docker ps -a | grep postgres` après `pnpm test` → container exited (cleanup OK)
- Désactiver Docker → `pnpm test` échoue clairement

---

## ~~S12 — Tests e2e (auth + users + health)~~ — supprimée

**Statut** : absorbée par S8.2 (auth + users) + S09 (health back-fill — à ajouter dans la story S09 directement) + tests des nouveaux modules (S8.5, S8.6, S8.7, S8.8). Aucun "back-fill" résiduel n'est nécessaire.

---

## S13 — Dockerfile multi-stage

**Taille** : M
**Dépendances** : S05c, S10
**Goal** : image production minimale, prête à déployer.

**Tâches**
- `apps/api/docker/Dockerfile` (cf. spec §5.18) — base distroless `:nonroot`, USER nonroot, COPY --chown, HEALTHCHECK avec fetch natif
- `.dockerignore` : `node_modules`, `dist`, `.git`, `.env*`, `coverage`, `test`, `*.md` sauf README
- Tester local depuis la racine : `docker build -f apps/api/docker/Dockerfile -t fluch-api apps/api/`
- Adapter le COPY pour inclure les packages workspace dont apps/api dépend (`packages/api-contracts/dist`, `packages/tsconfig/`)

**DoD**
- Image build < 3 min en cold cache, < 30s en warm cache
- `docker images fluch-api` → taille < 200MB
- `docker run -p 3000:3000 --env-file .env fluch-api` boot, `/v1/health` répond 200
- **Nonroot** : `docker inspect fluch-api --format '{{.Config.User}}'` → `nonroot:nonroot`
- **HEALTHCHECK actif** : `docker run -d --name probe fluch-api && sleep 15 && docker inspect probe --format '{{.State.Health.Status}}'` → `healthy`
- Le container ne contient pas de shell (`docker exec ... sh` → fail, signe distroless OK)

---

## ~~S14 — docker-compose.dev.yml~~ — supprimée

**Statut** : déjà livrée en S05a (la story posait le service Postgres dev). Aucun delta restant.

---

## S15 — CI workflows

**Taille** : M
**Dépendances** : S02, S12
**Goal** : pipeline CI complet, paths-filtered, monorepo-friendly.

**Tâches**
- `.github/workflows/ci-api.yml` (cf. spec §6.1)
- `.github/workflows/audit.yml` (cf. spec §6.2)
- Vérifier que les `paths:` filters fonctionnent (modifier un fichier hors-filter sur une branche test → workflow ne tourne pas)
- Paths filters mis à jour pour structure monorepo :
  - `ci-api.yml` filtre `apps/api/**`, `packages/api-contracts/**`, `packages/tsconfig/**`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`
  - Si plus tard `ci-web.yml` arrive, filtre `apps/web/**` + packages partagés

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
- `.github/dependabot.yml` (cf. spec §5.21) : 4 blocs npm (un par workspace : root, apps/api, packages/api-contracts, packages/tsconfig)
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
- Section "Monorepo structure" : architecture pnpm (`apps/api`, `packages/api-contracts`, `packages/tsconfig`, `packages/biome-config`), scripts root délégants via `--filter`, workspace pinning
- Section "Multi-tenant isolation" : explique l'extension Prisma, `@InjectPrisma()` vs `UnsafePrismaService`, `runAsAdmin`, `@RequiresOrg()` (pointer vers `fluch-nest-starter-tenant-extension.md`)
- Section "RBAC permissions" : table des décorateurs (`@Roles`/`@OrgRoles`/`@UserHasPermission`/`@MemberHasPermission`), exemple d'ajout de role
- Section "TS-Rest contracts" : structure `packages/api-contracts`, comment ajouter un module, comment consommer depuis le front (à venir)
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
- Les 30 critères de la spec §9 sont OK (25 originaux + 5 nouveaux post-pivot architectural)
- Critères supplémentaires à valider :
  - Sign-up → org par défaut auto-créée (event listener S8.7)
  - User org-A ne voit pas les posts org-B (isolation tenant, S8.6 + S8.8)
  - Org owner peut switcher d'org → `session.activeOrganizationId` change
  - Import du contrat `@fluch/api-contracts` depuis un fichier hors apps/api compile (preuve du partage)
  - Tenter d'importer `UnsafePrismaService` dans un fichier `*.service.ts` → lint rule échoue
- Un tag `v0.1.0` est créé sur `main`

---

## Ordre d'exécution recommandé

**Phase 1 — Fondations (FAIT)**
S01 → S02 → S03 → S04

**Phase 2 — Persistence (FAIT)**
S05a → S05b → S05c → S05d

**Phase 3 — Infrastructure transverse (FAIT)**
S06

**Phase 4 — Domaine v1 + Pivots qualité (FAIT)**
S07 → S08 → S8.1 → S8.2

**Phase 5 — Pivot architectural (~3-4 jours)**
S8.3 (monorepo) → S8.4 (packages + Users en TS-Rest) → S8.5 (better-auth plugins) → S8.6 (tenant infra) → S8.7 (events Nest) → S8.8 (Post exemple)

**Phase 6 — Reprise plan original (adapté)**
S09 (Health) → S10 (Bootstrap final, Swagger via TS-Rest) → S8.11 (Testcontainers light)

**Phase 7 — Packaging (parallélisable)**
S13 ‖ S15 ‖ S16

**Phase 8 — Finition**
S17 (README enrichi) → S18 (smoke tests étendus)

**Supprimées** : S11 (devenue S8.11 rabotée), S12 (absorbée par S8.2 + tests modules), S14 (livrée en S05a)

**Total estimé** : 13-16 jours-développeur (vs 7-9 du plan original). Le surplus = ~6-8 jours pour le pivot architectural (monorepo + TS-Rest + RBAC + multi-tenant). Justifié : c'est ce qui transforme un "backend Nest classique" en "starter SaaS B2B complet".

## Notes au développeur

- **Ne pas dévier de la spec** sans la mettre à jour en même temps. La spec et les stories vivent dans le repo `flush-design` (à côté de `design-skill-spec.md`) — pousser un commit là quand un écart est nécessaire.
- **La doc better-auth peut diverger** des bouts de code de la spec (§5.9, §5.13). Vérifier au moment de S07 — c'est la story la plus risquée.
- **Le pattern monorepo-safe** (§7 spec, S02 + S15 + S16 stories) est un point critique. Trois mécanismes : (1) `prepare` script conditionnel pour Husky, (2) `paths:` filters dans les workflows CI, (3) commentaire d'en-tête dans `dependabot.yml` rappelant d'ajuster `directory:`. Ne négliger aucun des trois.
- **Conventional commits dès S16** : à partir du moment où commitlint est installé, tous les commits suivants doivent suivre la convention (sinon Husky les bloque). Faire les commits S01-S15 dans un style libre est OK ; à partir de S16 c'est strict.
- Pour **chaque story**, faire un commit séparé avec un titre type `feat: S01 bootstrap project` (après S16), ou `S01: bootstrap project` (avant S16). Facilite la relecture et permet à l'user de checker au fil de l'eau.
- **Phase 5 = point de non-retour** : à partir de S8.3, le repo est en monorepo pnpm. Ne plus écrire de chemins racine `src/` sans préfixe `apps/api/`.
- **Sécurité multi-tenant** : à partir de S8.6, NE JAMAIS injecter `UnsafePrismaService` dans un service métier — lint rule en place mais à respecter à la lettre. Cf. [fluch-nest-starter-tenant-extension.md](fluch-nest-starter-tenant-extension.md) section 10.
- **Pattern TS-Rest** : tout nouveau module métier écrit après S8.4 utilise TS-Rest. Pas de `@Get/@Post` natif Nest dans `apps/api/src/` (sauf cas legacy comme Auth).
