# Fluch Nest Starter — Décisions d'architecture du template

Document de référence sur les choix de stack du template SaaS. À garder à jour quand un choix évolue. Chaque section explique le **quoi** + le **pourquoi** + ce qui a été **écarté** et pour quelle raison — pour éviter de re-débattre dans le futur.

Dernière mise à jour : 2026-05-23

---

## Vue d'ensemble

| Layer | Choix | Alternatives écartées |
| --- | --- | --- |
| API routing | NestJS + TS-Rest (`@ts-rest/nest`) | tRPC, REST nu, GraphQL |
| Validation | Zod auto-généré depuis Prisma (`prisma-zod-generator`) | class-validator + class-transformer |
| Auth | better-auth + `@thallesp/nestjs-better-auth` | Passport, custom JWT |
| RBAC permissions | `createAccessControl` de better-auth + décorateurs thallesp | CASL, système maison |
| Multi-tenant isolation | Prisma Client Extension + `AsyncLocalStorage` | RLS Postgres, request-scoped providers |
| Ownership row-level | Convention dans services (`where: { id, authorId }`) | Framework dédié |
| Scaffolding | Hygen (`gen:resource <Model>`) | Générateur Prisma custom, copie manuelle |
| ORM | Prisma 7 | Drizzle, TypeORM |

---

## Couche API : TS-Rest + NestJS

**Choix.** Les routes du back sont décrites via des contrats TS-Rest. Chaque module expose un fichier `*.contract.ts` qui réutilise les schémas Zod auto-générés depuis Prisma. Les controllers Nest utilisent `@ts-rest/nest` pour brancher leurs handlers sur le contrat.

**Pourquoi.**

- Type-safety end-to-end client/serveur **sans tRPC** : le front importe le contrat et obtient un client typé.
- REST reste REST : GET reste GET, status codes idiomatiques, OpenAPI natif, webhooks entrants supportés sans contorsion, clients non-TS toujours possibles.
- Intégration NestJS officielle, peu de magie.
- Réutilisation directe des Zod schemas déjà générés depuis Prisma → zéro duplication validation/typage.

**Pourquoi pas tRPC.** Pour un template SaaS générique, tRPC enferme dans un écosystème TS-only. Le jour où un client demande une API publique (Zapier, partenaires), une app mobile native, ou des webhooks bidirectionnels, on bricole. TS-Rest donne la même type-safety **en restant standard HTTP**.

**Pourquoi pas REST nu + `@nestjs/swagger`.** Acceptable mais le client TS doit alors être généré (`openapi-typescript`) ou maintenu à la main — un round-trip de plus, et la type-safety dépend du codegen. TS-Rest court-circuite ça.

**Note pratique.** Contrats écrits à la main pour les premiers modules. Pas de générateur custom au démarrage — rule of three. Si après 3-4 ressources un pattern récurrent émerge, alors on envisagera un mini-générateur Prisma qui sort les contrats CRUD de base.

---

## Auth : better-auth + thallesp

**Choix.** better-auth comme moteur. `@thallesp/nestjs-better-auth` pour l'intégration Nest (AuthGuard global, décorateurs, hooks DB avec DI).

**Plugins better-auth activés par défaut.**

- `organization` — quasi tous les SaaS modernes sont B2B avec teams. Active aussi le système de permissions org-scoped.
- `admin` — système de rôle/permissions system-wide (super-admin, support tools).

**Hooks utilisés dans le scaffold du template.**

- `@AfterCreate('user')` : créer une org par défaut, envoyer le mail de bienvenue via le `EmailService` Nest, seed des données démo, publier un event "user_created" vers la queue d'onboarding.

**Pourquoi pas Passport.** Trop bas niveau. Pour un SaaS B2B, on veut org/teams/invitations/access-control out-of-the-box. better-auth les fournit nativement.

---

## RBAC : `createAccessControl` + décorateurs thallesp

**Choix.** Définir les statements + roles **une seule fois** côté config better-auth :

```ts
// src/auth/permissions.ts
import { createAccessControl } from "better-auth/plugins/access";

const statement = {
  project: ["create", "read", "update", "delete"],
  invoice: ["read", "export"],
  // ...
} as const;

export const ac = createAccessControl(statement);

export const editor = ac.newRole({
  project: ["create", "update", "read"],
  invoice: ["read"],
});

export const adminRole = ac.newRole({
  project: ["create", "read", "update", "delete"],
  invoice: ["read", "export"],
});
```

Passer `ac` + `roles` au plugin `admin` et/ou `organization` dans la config better-auth.

**Utilisation sur les controllers (zéro guard custom).**

```ts
@UserHasPermission({ permission: { project: ['create'] } })  // system-wide
@MemberHasPermission({ permissions: { project: ['delete'] } }) // org-scoped
@Roles(['admin'])      // system role
@OrgRoles(['owner'])   // org role
```

**Séparation `@Roles` / `@OrgRoles` (idem pour les permissions) : volontaire.** Anti privilege-escalation. Un org admin ne peut PAS franchir une route `@Roles(['admin'])` (réservée system admin). Un system admin ne peut PAS franchir `@OrgRoles(['owner'])` sans contexte org. **Ne pas tenter de "factoriser" en un seul décorateur — c'est une fonctionnalité, pas un défaut.**

**Pourquoi pas CASL.** CASL/Oso brillent sur de l'ABAC complexe avec conditions imbriquées (« user peut éditer si auteur OU éditeur ET draft ET quota non atteint »). Pour 95% des SaaS, RBAC + ownership row-level suffisent. CASL est over-engineering au démarrage, documenté en "going further" si un besoin réel émerge.

---

## Multi-tenant : Prisma Client Extension + AsyncLocalStorage

Voir [fluch-nest-starter-tenant-extension.md](fluch-nest-starter-tenant-extension.md) pour le pattern technique complet.

**Choix.** Une extension Prisma intercepte `$allOperations` et injecte automatiquement `tenantId` (= `organizationId` dans notre cas) sur tous les modèles tenant-scoped. Le contexte du tenant est propagé via `AsyncLocalStorage`, alimenté par un middleware Nest qui lit `req.session.session.activeOrganizationId` (attaché par le AuthGuard de thallesp).

**Pourquoi pas RLS Postgres.**

- Setup pool de connexions : pgbouncer en mode transaction casse le `SET LOCAL` → incompatible avec une grosse partie des hébergeurs serverless. Pooler RLS-aware ou session mode = scaling réduit.
- Dual-role DB obligatoire (app + admin avec BYPASSRLS) — friction sur migrations/seeds/scripts.
- Debug difficile : filtres invisibles depuis le code, devs perdus.
- Prisma `db push` n'applique pas les policies → drift dev.
- Pour 95% des SaaS Nest classiques (tout passe par les services), RLS apporte ~5% de sécurité défensive pour ~10x de complexité opérationnelle.

RLS reste documenté en "going further" pour les cas spécifiques (BI tools en accès direct, conformité audit DB-level, multi-app sur même DB).

**Pourquoi pas request-scoped providers Nest.** `@Injectable({ scope: Scope.REQUEST })` propage en cascade : tout service dépendant d'un service request-scoped devient lui-même request-scoped. On perd la DI singleton sur toute une branche, impact perf et complexité non-négligeables. `AsyncLocalStorage` propage l'identité sans toucher au cycle de vie des providers.

---

## Ownership row-level

**Choix.** Convention dans les services, pas de framework.

```ts
async updatePost(user: User, id: string, data: UpdatePostInput) {
  return this.prisma.post.update({
    where: { id, authorId: user.id }, // ownership filter
    data,
  });
}
```

**Pourquoi.** L'ownership a souvent des nuances (admin peut éditer tout, modérateur dans son équipe, etc.). Le mettre en convention claire dans les services rend l'intention **visible et debuggable** — la sécurité doit être lue, pas devinée.

**Aide scaffolding.** Hygen scaffold un commentaire `// TODO: ownership filter if needed` dans les méthodes `update`/`delete` du service. À supprimer une fois la décision prise (filtrer ou non).

---

## Validation : Zod auto-généré

**Choix.** `prisma-zod-generator` produit les schémas Zod depuis `schema.prisma`. Variantes par modèle via annotations `/// @zod.omit(['password'])` / `/// @zod.readonly` :

- `CreateXInput` — sans id, sans timestamps, sans champs serveur
- `UpdateXInput` — tous optionnels, sans id
- `XResponse` — sans secrets (password, tokens, …)

**Réutilisation.** Schémas importés dans :

1. Les contrats TS-Rest (`input` / `output`)
2. La validation runtime via le pipe Zod
3. Le client TS (via l'import du contrat)

**Zéro duplication.** La source de vérité unique = `schema.prisma` + annotations.

---

## Scaffolding : Hygen

**Choix.** Hygen comme moteur. `pnpm gen:resource Post` scaffold un module Nest complet :

```text
src/posts/
  posts.module.ts
  posts.contract.ts          # TS-Rest contract, importe schémas Zod
  posts.controller.ts        # TS-Rest handlers + décorateurs permissions skeleton
  posts.service.ts           # CRUD via prisma.post.*, ownership TODO
  posts.service.spec.ts      # Tests unitaires
```

**Pourquoi pas un générateur Prisma custom au démarrage.** Rule of three. Tant qu'on n'a pas écrit 3-4 modules à la main, on ne sait pas **vraiment** ce qui se répète. Une abstraction prématurée se paie en tooling rigide. Si après 3-4 ressources un pattern récurrent et stable émerge dans les **contrats** (pas dans les services, qui restent métier-spécifique), alors on envisage un mini-générateur Prisma pour les contrats de base **seulement**.

**Maintenance liste tenant-scoped models.** Hygen met à jour `src/prisma/tenant-models.ts` quand on passe `--tenant` au scaffold. Voir doc dédiée.

---

## Hors scope (volontairement)

- **tRPC** — incompatible avec un template SaaS générique (clients non-TS, API publique, webhooks).
- **CASL / Oso / Casbin** — over-engineering pour le RBAC SaaS standard.
- **RLS Postgres dans le scaffold par défaut** — coût opérationnel disproportionné au bénéfice pour un back Nest classique. Documenté en "going further".
- **GraphQL** — pas pertinent vs TS-Rest pour un template SaaS REST-first.
- **Générateur custom Prisma pour controllers/routes** — abstraction prématurée. À reconsidérer après 3-4 ressources scaffoldées Hygen.

---

## Questions ouvertes (à trancher en cours d'implémentation)

- **Liste des modèles tenant-scoped** : maintenue à la main dans un fichier `tenant-models.ts`, OU dérivée d'un détecteur `organizationId` dans `schema.prisma` au build ? Trancher après 5+ modèles.
- **Bypass admin pour seeds/jobs** : `tenantStorage.run({ tenantId: null }, ...)` partout vs un helper dédié `runAsAdmin()` ? Décider quand on aura le premier vrai cas (job cron, support tool).
- **Hooks `@AfterCreate('user')` du template** : quels effets de bord par défaut ? Mail de bienvenue oui, mais création d'org par défaut vs invitation à créer la sienne ? Dépend du modèle SaaS visé.
- **OpenAPI public** : générer un doc OpenAPI depuis les contrats TS-Rest pour les clients tiers ? `@ts-rest/open-api` existe — à activer dans le template ou en option ?
