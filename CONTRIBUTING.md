# Contributing

Merci de contribuer. Quelques règles pour garder le repo propre.

## Setup

```sh
pnpm install
```

Voir le [README](./README.md) pour la suite (Docker compose, Prisma migrate, etc.).

## Branch model

- **Pas de commit direct sur `main`.** `main` est protégée et n'accepte que les merges via PR.
- Nommage des branches :
  - `feat/<slug>` — nouvelle feature
  - `fix/<slug>` — bug fix
  - `chore/<slug>` — maintenance, refacto, deps
  - `docs/<slug>` — doc uniquement
- 1 PR = 1 sujet. Si tu touches 3 choses, ouvre 3 PRs.

## Conventional commits

Format : `<type>(<scope>): <subject>` (header ≤ 100 chars).

Le hook `commit-msg` (commitlint + `@commitlint/config-conventional`) rejette tout commit qui ne suit pas la convention.

| Type     | Quand l'utiliser                                                  |
|----------|-------------------------------------------------------------------|
| `feat`   | Nouvelle fonctionnalité utilisateur                               |
| `fix`    | Correction de bug                                                 |
| `chore`  | Maintenance (deps, config, tooling) sans impact runtime           |
| `docs`   | Doc uniquement (README, CONTRIBUTING, JSDoc)                      |
| `refactor` | Refacto sans changement de comportement                         |
| `test`   | Ajout/modif de tests uniquement                                   |
| `ci`     | Workflows GitHub Actions, hooks, scripts CI                       |
| `perf`   | Amélioration de performance                                       |
| `build`  | Build system (Docker, tsconfig, bundlers)                         |
| `style`  | Formatage, pas de changement de logique                           |

Exemples :

```
feat(auth): add password reset endpoint
fix(posts): prevent cross-org leak in list query
chore(deps): bump @nestjs/* to 11.2
docs(readme): document SENTRY_DSN setup
```

## Hooks Husky

Trois hooks tournent automatiquement :

| Hook         | Action                                          | Quand                  |
|--------------|-------------------------------------------------|------------------------|
| `pre-commit` | `lint-staged` (Biome) + `pnpm typecheck`        | `git commit`           |
| `commit-msg` | `commitlint --edit $1`                          | `git commit`           |
| `pre-push`   | `pnpm typecheck && pnpm test` (Testcontainers)  | `git push`             |

Le `pre-push` lance les tests e2e — comptez 30-60s par push. Daemon Docker requis (Testcontainers démarre Postgres).

**Bypass en dernier recours** (hotfix uniquement) :

```sh
git commit --no-verify -m "fix: emergency rollback"
git push --no-verify
```

CI rattrapera quand même via `ci-api.yml`.

## Review

- 1 reviewer minimum via `CODEOWNERS` (assignation automatique).
- CI verte requise avant merge (`check`, `test`, `build`, `audit`).
- Squash & merge par défaut — garde l'historique `main` linéaire.
