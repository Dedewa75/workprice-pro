# WORKPRICE PRO

Logiciel de calcul de tarifs, devis, factures et CRM pour indépendants et entreprises.

## Fonctionnalités
- Calculateur universel : 6 méthodes (horaire, forfait, unité, quantité/paliers, abonnement, personnalisée), difficulté, frais, déplacements, modifications, urgence, marge sur coût ou sur prix de vente, remise, TVA, charges, prix conseillé, alertes de vente à perte.
- Métiers : prestations enregistrées, packs/abonnements, options, coûts associés, 8 modèles préconfigurés.
- Clients (CRM) : fiche, recherche, filtres, historique devis / factures / prestations.
- Devis : numérotation automatique, catalogue, statuts, PDF (3 modèles), transformation en facture.
- Factures : brouillon → émission (numéro définitif, contenu verrouillé), paiements partiels, retards, annulation, PDF.
- Tableau de bord : KPI, filtres par période, graphiques interactifs, statistiques mensuelles.
- Paramètres : entreprise, logo, pays, devise, TVA (taux saisis par l'utilisateur), numérotation, mentions, thème.
- Sauvegarde JSON exportable / restaurable.

## Données
Stockées dans le navigateur (localStorage, clé `workprice-pro:v1:default`). La couche `src/core/store.ts`
(interface `StorageAdapter`) permet de brancher une base distante (ex. Supabase) pour un vrai SaaS multi-utilisateurs.

## Technique
TypeScript, React 19, Tailwind CSS v4, pdf-lib. Build : `node scripts/build.mjs` → `dist/index.html` (fichier unique autonome).
Tests : `node --import tsx --test tests/core.test.ts` (moteur de calcul) et `python3 scripts/e2e.py` (navigateur, Playwright).

## Avertissement
Les calculs de TVA utilisent les taux saisis par l'utilisateur. Le logiciel ne garantit pas la conformité fiscale
des documents : vérifie les mentions obligatoires de ton pays avec un comptable.
