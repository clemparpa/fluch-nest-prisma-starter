# Fluch Nest Starter — Pattern isolation multi-tenant via Prisma Client Extension

Document de référence technique pour le pattern d'isolation tenant. Décrit l'architecture complète : Prisma Client Extension + `AsyncLocalStorage` + middleware Nest qui lit la session better-auth. À implémenter quand on attaque la story tenant.

Voir [fluch-nest-starter-stack-decisions.md](fluch-nest-starter-stack-decisions.md) pour le contexte global et les alternatives écartées.

Dernière mise à jour : 2026-05-23

---

## Objectif

Garantir que **toute opération Prisma** sur un modèle tenant-scoped applique automatiquement un filtre `tenantId = <org de la session>`. Plus aucun risque d'oublier un `where: { organizationId }` dans un service.

Couvre le filtre par **organisation** (= tenant). Ne couvre pas l'**ownership row-level** (« Bob ne voit que ses propres posts ») — qui reste explicite dans les services par convention.

---

## Architecture vue d'ensemble

```text
┌─────────────────────────┐
│ Requête HTTP            │
│ (session better-auth    │
│  attachée par AuthGuard)│
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ TenantMiddleware        │  lit req.session.session.activeOrganizationId
│ (Nest)                  │  appelle tenantStorage.run({ tenantId }, next)
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ Controller → Service    │  appelle prisma.post.findMany()
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ Prisma Client Extension │  intercepte $allOperations
│ (tenant-extension.ts)   │  lit tenantStorage.getStore()?.tenantId
│                         │  injecte le filtre dans args
└───────────┬─────────────┘
            ▼
       Database
```

3 composants. Chacun fait UNE chose.

---

## 1. L'extension Prisma

```ts
// src/prisma/tenant-extension.ts
import { Prisma } from '@prisma/client';

/**
 * Liste des modèles qui ont une colonne tenantId.
 * Mise à jour manuelle au début, ou via Hygen `gen:resource <Model> --tenant`.
 * Voir section "Maintenance" plus bas.
 */
export const MODELS_WITH_TENANT = new Set<string>([
  // 'Post',
  // 'Project',
  // ...
]);

export const tenantExtension = (
  getTenantId: () => string | null | undefined,
) =>
  Prisma.defineExtension({
    name: 'tenant',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!MODELS_WITH_TENANT.has(model)) return query(args);

          const tenantId = getTenantId();

          // null explicite = bypass (admin, seed, job cron, support tool)
          if (tenantId === null) return query(args);

          // undefined ou '' = pas de contexte → on refuse, sinon leak silencieux
          if (!tenantId) {
            throw new Error(
              `No tenant context for ${model}.${operation}. ` +
                `Wrap the call in tenantStorage.run({ tenantId }, ...) ` +
                `or { tenantId: null } for admin bypass.`,
            );
          }

          const readOps = new Set([
            'findUnique', 'findUniqueOrThrow',
            'findFirst', 'findFirstOrThrow', 'findMany',
            'count', 'aggregate', 'groupBy',
          ]);
          const targetedWriteOps = new Set([
            'update', 'updateMany', 'updateManyAndReturn',
            'delete', 'deleteMany',
          ]);

          if (readOps.has(operation) || targetedWriteOps.has(operation)) {
            args.where = { ...args.where, tenantId };
          }

          if (operation === 'create' || operation === 'upsert') {
            args.data = { ...args.data, tenantId };
          }

          if (operation === 'createMany' || operation === 'createManyAndReturn') {
            const data = args.data;
            args.data = Array.isArray(data)
              ? data.map((d) => ({ ...d, tenantId }))
              : { ...data, tenantId };
          }

          return query(args);
        },
      },
    },
  });
```

**Note importante sur `upsert`.** L'opération combine create + update. Le filtre `tenantId` injecté dans `args.data` couvre la création. Le filtre dans `args.where` (via `targetedWriteOps`) couvrirait la partie update — mais `upsert` n'est pas dans le set actuel. À évaluer : si on veut couvrir aussi le where de l'upsert, ajouter `'upsert'` au `targetedWriteOps`. Décision à figer quand on aura le premier vrai cas.

---

## 2. Le contexte par requête : `AsyncLocalStorage`

```ts
// src/tenant/tenant.storage.ts
import { AsyncLocalStorage } from 'node:async_hooks';

export type TenantContext = {
  /**
   * - string : tenantId actif → l'extension filtre automatiquement
   * - null   : bypass explicite (admin, seed, job cron)
   * - undefined : aucun contexte → l'extension lève une erreur
   */
  tenantId: string | null;
};

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

/**
 * Helper pour exécuter du code avec bypass tenant (admin context).
 * Usage : await runAsAdmin(async () => { await prisma.post.findMany(); });
 */
export const runAsAdmin = <T>(fn: () => Promise<T>): Promise<T> =>
  tenantStorage.run({ tenantId: null }, fn);
```

**Pourquoi `AsyncLocalStorage` et pas request-scoped providers Nest.** Voir [fluch-nest-starter-stack-decisions.md](fluch-nest-starter-stack-decisions.md) section multi-tenant. Résumé : request-scoped propage en cascade sur toute la stack de DI, impact perf et complexité. ALS propage l'identité sans toucher au cycle de vie des providers.

---

## 3. Le middleware Nest

```ts
// src/tenant/tenant.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { tenantStorage } from './tenant.storage';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    // req.session est attaché par le AuthGuard de @thallesp/nestjs-better-auth
    const session = (req as any).session;
    const tenantId = session?.session?.activeOrganizationId ?? null;

    // tenantId null = utilisateur authentifié sans org active (ex: signup juste fait)
    //   → on bypass. À adapter selon la politique du SaaS.
    // En pratique : pour les routes qui REQUIERENT un tenant, ajouter un guard
    //   qui vérifie la présence de activeOrganizationId.
    tenantStorage.run({ tenantId }, () => next());
  }
}
```

**Enregistrement** :

```ts
// src/app.module.ts
@Module({ /* ... */ })
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
```

**Ordre d'exécution important.** Le middleware doit s'exécuter **après** que le AuthGuard de thallesp ait attaché la session à `req.session`. En pratique, Nest exécute les middlewares avant les guards — donc on **ne peut pas** lire la session dans le middleware classique. Deux options :

1. **Lire la session via better-auth dans le middleware** (`auth.api.getSession({ headers: fromNodeHeaders(req.headers) })`) → bypass de l'ordre Nest, mais round-trip supplémentaire.
2. **Utiliser un `Interceptor` global** (`APP_INTERCEPTOR`) au lieu d'un middleware → s'exécute **après** les guards, donc `req.session` est dispo.

**Recommandation : option 2 (Interceptor).** Plus propre, pas de duplication d'appel à getSession.

```ts
// src/tenant/tenant.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tenantStorage } from './tenant.storage';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const req = ctx.switchToHttp().getRequest();
    const tenantId = req.session?.session?.activeOrganizationId ?? null;

    return new Observable((observer) => {
      tenantStorage.run({ tenantId }, () => {
        next.handle().subscribe(observer);
      });
    });
  }
}
```

Enregistrement global :

```ts
// src/app.module.ts
providers: [
  { provide: APP_INTERCEPTOR, useClass: TenantInterceptor },
],
```

**Note sur les routes `@AllowAnonymous`.** Pas de session → `tenantId = null` → bypass. Si une route anonyme accède à un modèle tenant-scoped (rare mais possible : ex. page publique listant les produits d'une org), l'extension renverra null et l'opération passera sans filtre — ce qui est probablement faux. **À traiter au cas par cas** : soit la route exige explicitement un tenantId (param d'URL), soit elle ne touche pas aux modèles tenant-scoped.

---

## 4. Exposition du client étendu via Factory provider

**Choix : garder la classe `UnsafePrismaService` existante** (ex-`PrismaService`, qui gère adapter PG + Logger + lifecycle), et ajouter à côté un **Factory provider** qui produit un client étendu tenant-scoped depuis cette instance. Les deux cohabitent : l'un (raw, dangereux) reste injectable pour les rares cas légitimes, l'autre (filtré) est l'usage par défaut dans les services métier.

### Convention de nommage

| Symbole | Rôle | Quand l'utiliser |
| --- | --- | --- |
| `UnsafePrismaService` (classe) | Client Prisma brut, hérite de `PrismaClient`, sans extension tenant. **Bypass possible du filtre.** | Uniquement dans : seeds, scripts CLI, jobs cross-tenant. Jamais dans les services métier. |
| `TenantScopedPrismaClient` (type) | Type du client étendu avec extension tenant active. | Annotation du paramètre de constructeur dans les services métier. |
| `PRISMA` (token Symbol) | Token DI Nest qui résout vers l'instance du client étendu. | À utiliser via `@Inject(PRISMA)` ou son sucre `@InjectPrisma()`. |
| `@InjectPrisma()` (décorateur) | Sucre pour `@Inject(PRISMA)`. | Usage par défaut dans tous les services métier. |

Le préfixe `Unsafe` est volontaire et doit être conservé dans le template : il **alerte visuellement** dans les imports, déclarations de constructeur et code reviews. Inspiration : `dangerouslySetInnerHTML` (React), `unsafe-eval` (CSP), `Unsafe` en Rust.

### Code

**Renommer la classe existante** (anciennement `PrismaService`) :

```ts
// src/prisma/unsafe-prisma.service.ts
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import type { Env } from '../config/env';

/**
 * ⚠️ Client Prisma brut, SANS extension tenant.
 * Toutes les queries bypass l'isolation multi-tenant.
 *
 * À utiliser uniquement dans :
 *   - prisma/seed.ts
 *   - src/jobs/** (jobs cron cross-tenant)
 *   - scripts/** (scripts CLI admin)
 *
 * Dans les services métier, injecter le client étendu via @InjectPrisma()
 * avec le type TenantScopedPrismaClient.
 */
@Injectable()
export class UnsafePrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UnsafePrismaService.name);

  constructor(config: ConfigService<Env, true>) {
    super({
      adapter: new PrismaPg({
        connectionString: config.get('DATABASE_URL', { infer: true }),
      }),
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma connected');
  }

  async onModuleDestroy() {
    this.logger.log('Prisma disconnecting');
    await this.$disconnect();
  }
}
```

**Module avec Factory provider pour le client tenant-scoped** :

```ts
// src/prisma/prisma.module.ts
import { Global, Module, Inject } from '@nestjs/common';
import { UnsafePrismaService } from './unsafe-prisma.service';
import { tenantExtension } from './tenant-extension';
import { tenantStorage } from '../tenant/tenant.storage';

export const PRISMA = Symbol('PRISMA');

/** Sucre pour l'injection — usage par défaut dans les services métier. */
export const InjectPrisma = () => Inject(PRISMA);

export type TenantScopedPrismaClient = ReturnType<UnsafePrismaService['$extends']>;

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

**Usage par défaut dans les services métier** :

```ts
import { Injectable } from '@nestjs/common';
import { InjectPrisma, type TenantScopedPrismaClient } from '../prisma/prisma.module';

@Injectable()
export class PostService {
  constructor(@InjectPrisma() private prisma: TenantScopedPrismaClient) {}

  // tenantId injecté automatiquement par l'extension.
  list() {
    return this.prisma.post.findMany();
  }

  // Ownership row-level reste explicite (voir convention).
  updateOwn(user: User, id: string, data: UpdatePostInput) {
    return this.prisma.post.update({
      where: { id, authorId: user.id },
      data,
    });
  }
}
```

**Usage exceptionnel dans un job admin / seed** (visuellement marqué) :

```ts
import { Injectable } from '@nestjs/common';
import { UnsafePrismaService } from '../prisma/unsafe-prisma.service';

@Injectable()
export class GlobalCleanupJob {
  constructor(private prisma: UnsafePrismaService) {}
  //                          ^^^^^^^^^^^^^^^^^^^
  //                          Le mot "Unsafe" saute aux yeux en code review.

  @Cron('0 0 * * *')
  async cleanupExpiredAcrossAllTenants() {
    // Cas légitime : nettoyage cross-tenant, pas de session utilisateur.
    await this.prisma.post.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  }
}
```

### Pourquoi ce pattern (vs alternatives)

| Alternative | Pourquoi écartée |
| --- | --- |
| `PrismaService extends PrismaClient` + propriété `.client` exposant le client étendu | DX dégradée : `prisma.client.post.findMany()` partout. Et la propriété `.post` (héritée de PrismaClient) reste accessible → leak silencieux possible. |
| `class PrismaService extends ExtendedPrismaClient` | Impossible : `ExtendedPrismaClient` est un **type** TypeScript (issu de `typeof`/`ReturnType`), pas une classe runtime. On ne peut pas `extends` un type. |
| Hack constructeur (`constructor() { return this.$extends(...) }`) | Marche au runtime, mais le système de types ment, debugging cauchemardesque, non-idiomatique. À éviter. |
| Provider unique exposant directement le client étendu (sans `UnsafePrismaService`) | Pas de porte de sortie pour les scripts admin légitimes. Force à recréer un `PrismaClient` ailleurs, avec duplication de config (adapter, connection string). |

Le Factory provider qu'on retient :

1. Préserve la classe `UnsafePrismaService` existante (zéro refacto sur la config adapter/lifecycle).
2. Donne une DX native dans les services métier (`prisma.post.findMany()`).
3. Garde une porte de sortie explicitement nommée pour les cas admin légitimes.
4. Le seul "coût" : injection par token (`@InjectPrisma()`) au lieu de par classe — ~12 caractères de plus, pattern standard Nest (cf. `@InjectRepository()` de TypeORM).

### Garde-fou : règle ESLint qui interdit `UnsafePrismaService` dans les services métier

```js
// eslint.config.js
{
  files: ['src/**/*.service.ts', 'src/**/*.controller.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      paths: [{
        name: '@/prisma/unsafe-prisma.service',
        importNames: ['UnsafePrismaService'],
        message:
          'UnsafePrismaService bypasses tenant isolation. ' +
          'Use @InjectPrisma() with TenantScopedPrismaClient instead. ' +
          'If you really need the raw client (cross-tenant job, admin script), ' +
          'add this file to the allowlist override.',
      }],
    }],
  },
},
// Override pour les chemins autorisés
{
  files: ['src/jobs/**', 'prisma/seed.ts', 'scripts/**'],
  rules: { 'no-restricted-imports': 'off' },
}
```

Effet : tout import accidentel de `UnsafePrismaService` dans un service ou controller métier échoue au lint avec un message explicite. Liste blanche restreinte aux dossiers légitimes.

---

## 5. Bypass admin (seeds, jobs, support)

Deux manières de bypasser l'isolation tenant, à choisir selon le contexte :

**Option A — `runAsAdmin` avec le client tenant-scoped** (préférée si on a déjà accès au client étendu via DI) :

```ts
import { runAsAdmin } from '../tenant/tenant.storage';
import { InjectPrisma, type TenantScopedPrismaClient } from '../prisma/prisma.module';

@Injectable()
export class PostCleanupJob {
  constructor(@InjectPrisma() private prisma: TenantScopedPrismaClient) {}

  @Cron('0 * * * *')
  async cleanupExpiredPosts() {
    await runAsAdmin(async () => {
      await this.prisma.post.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
    });
  }
}
```

**Option B — Injecter directement `UnsafePrismaService`** (préférée pour les contextes où on est explicitement hors-tenant : seeds, scripts CLI, jobs cross-tenant sans contexte HTTP) :

```ts
import { UnsafePrismaService } from '../prisma/unsafe-prisma.service';

@Injectable()
export class GlobalCleanupJob {
  constructor(private prisma: UnsafePrismaService) {}

  @Cron('0 0 * * *')
  async nightlyCleanup() {
    await this.prisma.post.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  }
}
```

```ts
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
// Hors Nest : on instancie un PrismaClient directement (pas besoin du Service Nest).
const prisma = new PrismaClient();
await prisma.post.createMany({ data: [/* ... */] });
```

**Quand choisir A vs B.**

- Le code vit dans un **service Nest** qui interagit normalement avec des utilisateurs (et ponctuellement doit faire du cross-tenant) → **option A** (`runAsAdmin` sur portion ciblée). Garde l'isolation par défaut, bypass localisé et visible.
- Le code est **exclusivement cross-tenant** (job cron global, script CLI, seed) → **option B** (`UnsafePrismaService` ou `new PrismaClient()`). Plus simple, le nom `Unsafe` documente l'intention.

**Sécurité — règles à respecter.**

- `runAsAdmin` ne **jamais** être appelé depuis un controller ni depuis un service métier qui traite des requêtes utilisateur — escalation possible.
- `UnsafePrismaService` ne **jamais** être injecté dans un service métier — la règle ESLint (section 4) bloque l'import par défaut.
- Les deux portes de sortie ne sont autorisées que dans : `prisma/seed.ts`, `src/jobs/**`, `scripts/**`.

---

## 6. Maintenance de `MODELS_WITH_TENANT`

**Phase 1 (template au démarrage).** Fichier `tenant-models.ts` édité à la main. 5 secondes par modèle. Acceptable jusqu'à 10-15 modèles.

**Phase 2 (croissance).** Script qui parse `schema.prisma`, détecte les modèles avec champ `organizationId String` (ou `tenantId String`), et regénère le fichier `tenant-models.ts`. Intégré dans le hook `postgenerate` de Prisma.

```json
// prisma.config.ts
{
  "generator": {
    "postGenerate": "tsx scripts/generate-tenant-models.ts"
  }
}
```

**Phase 3 (si besoin).** Un mini Prisma generator dédié. Probablement pas nécessaire — le script de phase 2 fait 30 lignes.

**Décision : commencer phase 1, basculer phase 2 dès qu'on dépasse 5 modèles tenant-scoped.**

---

## 7. Limitations connues — ce que l'extension ne couvre PAS

1. **Accès direct DB** (psql, BI tools, autre app sur la même base) — non couvert. À traiter au niveau **rôle DB / VPC / firewall**, pas dans l'app. C'est volontaire (cf. décision RLS écartée).

2. **`$queryRaw` / `$executeRaw`** — l'extension intercepte `$allOperations` sur les modèles, pas les requêtes raw. **Convention** : pas de SQL raw sur les tables tenant-scoped. Si nécessaire (perf, agrégat complexe), le filtre `tenant_id = $1` doit être ajouté à la main et reviewé en PR.

3. **Ownership row-level** — l'extension filtre par org, pas par user. Si Bob ne doit voir que ses propres posts au sein de son org, ça reste explicite dans le service : `where: { id, authorId: user.id }`.

4. **Bug dans l'extension elle-même** — leak silencieux possible. Mitigation : tests unitaires sur l'extension (50 lignes testées) + tests d'intégration qui vérifient l'isolation entre deux orgs (cf. section testing).

5. **Routes anonymes touchant des modèles tenant-scoped** — `tenantId = null` → bypass. Acceptable pour les routes admin/cross-tenant, dangereux si non intentionnel. À auditer route par route.

6. **Modèles partagés cross-tenant** (ex. catalogue de templates publics, plans Stripe) — ne pas les ajouter à `MODELS_WITH_TENANT`. Aucun filtre injecté, comportement normal.

---

## 8. Tests

**Test unitaire de l'extension** (`tenant-extension.spec.ts`) :

- Pour chaque opération (`findMany`, `create`, `update`, `delete`, `upsert`, `createMany`, `count`, etc.) sur un modèle dans `MODELS_WITH_TENANT` :
  - Avec `tenantId = 'org-1'` dans l'ALS → l'argument passé au PrismaClient sous-jacent contient bien `tenantId: 'org-1'` (dans `where` ou `data` selon l'op).
  - Avec `tenantId = null` → l'argument N'A PAS de filtre tenant ajouté.
  - Avec `tenantId = undefined` → throw error.

- Pour un modèle PAS dans `MODELS_WITH_TENANT` → aucune modification d'argument.

**Test d'intégration** (`tenant-isolation.e2e.spec.ts`) :

- Créer 2 orgs avec 2 users (Alice@org-A, Bob@org-B).
- Alice crée un Post.
- Bob (session active sur org-B) liste ses posts → doit retourner `[]`, pas le post d'Alice.
- Bob tente d'updater le post d'Alice par ID → doit échouer (record not found, à cause du filtre dans le where).

**Test du middleware/interceptor** : vérifier que `req.session.session.activeOrganizationId` est bien propagé dans l'ALS au moment où le controller appelle un service.

---

## 9. Migration d'un modèle vers tenant-scoped

Procédure quand un modèle existant doit devenir tenant-scoped :

1. Ajouter `organizationId String` + relation dans `schema.prisma`.
2. `prisma migrate dev --name xxx_add_tenant_to_post` — migration générée avec `ALTER TABLE` (nullable au début).
3. Backfill via script : assigner `organizationId` aux rows existantes (depuis l'auteur ? choix métier).
4. Migration suivante : passer `organizationId` en NOT NULL + ajouter l'index.
5. Ajouter `'Post'` à `MODELS_WITH_TENANT`.
6. Vérifier tous les services existants qui touchent à Post — les `where` actuels deviennent désormais doublés du filtre tenant (pas un problème, mais à auditer pour les cas cross-tenant intentionnels).

---

## 10. Points de vigilance opérationnels

- **Ne JAMAIS injecter `UnsafePrismaService` dans un service métier ou un controller.** Règle ESLint en place (cf. section 4) qui bloque l'import par défaut. Le nom `Unsafe` doit également apparaître tel quel dans tous les renommages futurs — ne pas l'adoucir.
- **Ne JAMAIS appeler `runAsAdmin` depuis un controller ou un service métier.** Lint rule à ajouter (`no-restricted-imports` sur `runAsAdmin` avec mêmes overrides que `UnsafePrismaService`).
- **Auditer systématiquement les `$queryRaw` / `$executeRaw`** lors de chaque code review touchant un modèle tenant-scoped. L'extension n'intercepte pas le SQL raw.
- **Documenter dans le README du template** que l'injection par défaut est `@InjectPrisma() prisma: TenantScopedPrismaClient`, avec un exemple de leak pour montrer le pourquoi.
- **Si un dev injecte `UnsafePrismaService` dans un service métier en désactivant la règle ESLint** (`// eslint-disable-next-line`), le PR review doit le challenger systématiquement et exiger une justification écrite dans le commit ou un commentaire dédié.
