// Workaround pnpm bug : `auto-install-peers=true` (default) installe AUSSI
// les optional peers, contrairement à la doc qui promet l'inverse.
// → https://github.com/pnpm/pnpm/issues/11155
//
// Conséquence concrète sans ce hook : `better-auth` déclare 19 optional peers
// (`prisma`, `react`, `react-dom`, `drizzle-kit`, `mongodb`, `vue`, `svelte`…)
// et pnpm les installe TOUS. Idem `@prisma/client`, `@better-auth/prisma-adapter`.
// Résultat dans le bundle prod : ~170 MB de packages jamais require.
//
// Philosophie peer optional : la lib fonctionne SANS. Si l'app a besoin du peer,
// elle doit le déclarer en deps directes — c'est ce qu'on fait (`@prisma/client`,
// `pg` dans apps/api/package.json). Donc strip-all est sûr.
function readPackage(pkg) {
  if (pkg.peerDependenciesMeta) {
    for (const [name, meta] of Object.entries(pkg.peerDependenciesMeta)) {
      if (meta?.optional) {
        delete pkg.peerDependenciesMeta[name]
        if (pkg.peerDependencies) {
          delete pkg.peerDependencies[name]
        }
      }
    }
  }
  // `typescript` est un build-tool, jamais require au runtime. Plusieurs libs
  // le déclarent peer non-optional (ex: @thallesp/nestjs-better-auth) → pnpm
  // le pull comme prod-dep transitive (22 MB). On le retire des peers : il
  // reste dispo en devDep root pour le typecheck dev/build.
  if (pkg.peerDependencies?.typescript) {
    delete pkg.peerDependencies.typescript
  }
  return pkg
}

module.exports = {
  hooks: { readPackage },
}
