# Modifications pour App Lite dédiée à Lisk

Ce document résume les modifications apportées pour transformer l'application Morpho Lite en une application dédiée exclusivement à la chaîne Lisk.

## Résumé des changements

L'application a été modifiée pour :
- **Supprimer la sélection de chaînes** - L'app est maintenant dédiée uniquement à Lisk
- **Simplifier les URLs** - Plus de paramètre `:chain` dans les routes
- **Optimiser la configuration** - Seule la chaîne Lisk est supportée
- **Conserver le code original** - Tout est commenté pour permettre un rollback

## Fichiers modifiés

### 1. `/src/lib/constants.tsx`
- **DEFAULT_CHAIN** : Changé de `plumeMainnet` vers `lisk`
- **BANNERS** : Ajout d'une bannière spécifique pour Lisk
- **Imports** : Nettoyage des imports inutilisés

### 2. `/src/main.tsx`
- **Routing** : Suppression du paramètre `:chain` des routes
- **Navigation** : Redirection directe vers `/dashboard` au lieu de `/{chain}/dashboard`
- **Imports** : Nettoyage des imports inutilisés

### 3. `/src/app/dashboard/page.tsx`
- **Chain Selection** : Désactivation du `WalletMenu` avec sélection de chaînes
- **Chain Logic** : Utilisation forcée de Lisk au lieu du paramètre URL
- **Navigation** : Simplification des URLs sans paramètre de chaîne
- **Imports** : Nettoyage des imports inutilisés

### 4. `/src/components/header.tsx`
- **Navigation Links** : URLs simplifiées sans paramètre de chaîne
  - `/dashboard` au lieu de `/{chain}/dashboard`
  - `/earn` au lieu de `/{chain}/earn`
  - `/borrow` au lieu de `/{chain}/borrow`

### 5. `/src/lib/wagmi-config.ts`
- **Chains** : Seule la chaîne Lisk est configurée
- **Transports** : Seul le transport Lisk est conservé
- **Imports** : Nettoyage des imports inutilisés

### 6. `/src/components/earn-table.tsx`
- **Links** : URLs simplifiées vers `/vault/{address}` au lieu de `/{chain}/vault/{address}`
- **Imports** : Nettoyage des imports inutilisés

### 7. `/src/components/borrow-table.tsx`
- **Links** : URLs simplifiées vers `/market/{id}` au lieu de `/{chain}/market/{id}`
- **Imports** : Nettoyage des imports inutilisés

### 8. `/src/app/vault-market/vault-subpage.tsx`
- **Back Link** : Simplifié vers `/earn` au lieu de `/{chain}/earn`
- **Market Links** : URLs simplifiées vers `/market/{id}`
- **Imports** : Nettoyage des imports inutilisés

### 9. `/src/app/vault-market/market-subpage.tsx`
- **Back Link** : Simplifié vers `/borrow` au lieu de `/{chain}/borrow`
- **Vault Links** : URLs simplifiées vers `/vault/{address}`
- **Imports** : Nettoyage des imports inutilisés

## Structure des URLs

### Avant (Multi-chaînes)
```
/                           → Redirect vers /{defaultChain}
/{chain}/                   → Redirect vers /{chain}/dashboard
/{chain}/dashboard          → Dashboard
/{chain}/earn              → Page Earn
/{chain}/borrow            → Page Borrow
/{chain}/vault/{address}   → Détails Vault
/{chain}/market/{id}       → Détails Market
```

### Après (Lisk uniquement)
```
/                    → Redirect vers /dashboard
/dashboard          → Dashboard (Lisk)
/earn              → Page Earn (Lisk)
/borrow            → Page Borrow (Lisk)
/vault/{address}   → Détails Vault (Lisk)
/market/{id}       → Détails Market (Lisk)
```

## Rollback

Pour revenir à la version multi-chaînes :

1. **Décommenter** tous les blocs marqués `/* ORIGINAL ... - commented for rollback */`
2. **Commenter** tous les blocs marqués `// LITE APP: ...`
3. **Restaurer** les imports originaux
4. **Remettre** `DEFAULT_CHAIN = plumeMainnet` dans `constants.tsx`

## Tests

- ✅ Compilation TypeScript réussie
- ✅ Build de production réussie
- ✅ Application démarrée en mode développement

L'application est maintenant entièrement dédiée à la chaîne Lisk avec des URLs simplifiées et sans possibilité de sélectionner d'autres chaînes.