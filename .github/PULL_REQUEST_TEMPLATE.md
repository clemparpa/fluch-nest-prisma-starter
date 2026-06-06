## Quoi
<!-- 1-3 bullets : ce que la PR change -->

## Pourquoi
<!-- contexte business / technique -->

## Comment tester
<!-- étapes reproductibles -->

## Checklist
- [ ] Tests e2e ajoutés/mis à jour
- [ ] Migration Prisma incluse si `schema.prisma` touché
- [ ] Contrats TS-Rest (`packages/api-contracts/`) à jour si surface API modifiée
- [ ] Pas de secret committé
- [ ] Modèle tenant-scoped ? `organizationId` présent + indexé
- [ ] Service métier ? N'importe **pas** `UnsafePrismaService` (utiliser `@InjectPrisma()`)
