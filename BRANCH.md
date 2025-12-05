# Feature: Minor Fixes and Improvements

## Objective
Implémenter les corrections mineures et améliorations identifiées dans TODO.md (lignes 47-101).

## Status
- **Progress**: 9/20 tâches complétées
- **Current**: Feat 4 complété (édition multiline du titre avec layouts différenciés)
- **Next**: Retravailler Fix WebAuthn pour login smartphone en localhost dev

## Commits
- [x] **Commit 1**: Fix 404 sur refresh GitHub Pages - activation du fallback 404.html
- [x] **Commit 2**: Fix comptage dans matrix - calcul et affichage du nombre de cas par seuil
- [x] **Commit 3**: Fix auto-save des seuils et recalcul automatique des comptages
- [x] **Commit 4**: Fix NavigationGuard - sauvegarde automatique au lieu d'afficher un dialogue
- [ ] **Commit 5**: Fix WebAuthn - accepter les IPs locales pour login smartphone en localhost dev (reverté, à retravailler)
- [x] **Commit 6**: Feat ajout/suppression d'axes dans matrice
- [x] **Commit 7**: Feat tronquer taille dans fiches entreprise
- [x] **Commit 8**: Feat EditableInput markdown avec bordure orange et hover bord gauche gris
- [x] **Commit 9**: Feat édition du titre/nom du usecase avec EditableInput
- [x] **Commit 10**: Feat multiline title editing avec layout 50/50 pour entreprises

## Plan d'évolution des tests

### Tests à implémenter

#### 1. Tests E2E - Édition de titre (multiline)
**Fichiers concernés** : `e2e/tests/workflow.spec.ts`, `e2e/tests/companies.spec.ts`, `e2e/tests/companies-detail.spec.ts`

**Actions** :
- Mettre à jour les sélecteurs : `h1 input.editable-input` → `h1 textarea.editable-textarea, h1 input.editable-input`
- Tester l'édition multiline (retours à la ligne)
- Vérifier que le textarea s'ajuste automatiquement en hauteur

#### 2. Tests E2E - Matrice (ajout/suppression d'axes, comptage, auto-save)
**Fichier concerné** : `e2e/tests/matrix.spec.ts`

**Actions** :
- Ajouter test pour boutons "Ajouter axe de valeur" / "Ajouter axe de complexité"
- Ajouter test pour boutons de suppression d'axes
- Vérifier que le comptage se met à jour après modification des seuils
- Vérifier l'auto-save (attendre 5s après modification)
