# Instructions projet

## Outils

- **Chrome DevTools MCP (`mcp__chrome-devtools__*`) : dernier recours uniquement.** Ces outils sont lents et coûteux en temps. Ne les utiliser que quand il n'y a vraiment pas d'alternative (bug visuel impossible à diagnostiquer autrement, comportement runtime navigateur inexplicable). Privilégier d'abord :
  - la lecture du code source,
  - les tests (`vitest`),
  - la vérification de types / le build,
  - le raisonnement sur le code.

  Ne jamais lancer le navigateur "pour vérifier que ça marche" par défaut — demander à l'utilisateur s'il veut une vérification visuelle en cas de doute.
