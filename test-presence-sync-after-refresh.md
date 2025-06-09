# Test Guide: Présence Utilisateur Après Refresh

## 🎯 Objectif
Valider que tous les utilisateurs restent marqués comme "en ligne" après un refresh de page dans une session Planning Poker.

## 🛠️ Corrections Implémentées

### 1. **Amélioration Côté Client (SessionPage.js)**
- ✅ Ajout de logs pour débugger les événements de présence
- ✅ Garantie que l'utilisateur actuel est toujours marqué comme en ligne
- ✅ Synchronisation initiale lors du chargement de session
- ✅ Demande de synchronisation de présence après joinSession

### 2. **Amélioration Côté Serveur (socketHandlers.js)**
- ✅ Réorganisation de l'ordre des événements lors du join
- ✅ Envoi de `sessionUsers` AVANT `userConnected` pour éviter les race conditions
- ✅ Nettoyage des sessions précédentes pour éviter les conflits
- ✅ Nouveau handler `requestPresenceSync` pour synchronisation à la demande

### 3. **Nouveau Contexte Socket (SocketContext.js)**
- ✅ Fonction `requestPresenceSync` pour demander une mise à jour de présence

## 📋 Protocole de Test

### Test 1: Présence Initiale
1. **Setup:**
   - Ouvrir 2 onglets différents (Utilisateur A et B)
   - Se connecter avec AmySy et JonDoe
   - Créer une session avec AmySy
   - Rejoindre la session avec JonDoe

2. **Vérification:**
   - ✅ Les deux utilisateurs apparaissent en ligne
   - ✅ Participant count = 2

### Test 2: Refresh Utilisateur Non-Admin
1. **Action:**
   - Dans l'onglet JonDoe, appuyer sur F5
   - Attendre la reconnexion (≈2-3 secondes)

2. **Résultats Attendus:**
   - ✅ JonDoe redevient automatiquement en ligne
   - ✅ AmySy reste marquée en ligne
   - ✅ Aucun utilisateur n'apparaît offline
   - ✅ Participant count reste à 2

### Test 3: Refresh Utilisateur Admin
1. **Action:**
   - Dans l'onglet AmySy (admin), appuyer sur F5
   - Attendre la reconnexion

2. **Résultats Attendus:**
   - ✅ AmySy redevient automatiquement en ligne
   - ✅ JonDoe reste marqué en ligne
   - ✅ Statut admin préservé
   - ✅ Boutons admin toujours visibles

### Test 4: Refresh Multiple Simultané
1. **Action:**
   - Refresh simultané des deux onglets (F5 en même temps)
   - Attendre la reconnexion complète

2. **Résultats Attendus:**
   - ✅ Les deux utilisateurs redeviennent en ligne
   - ✅ Aucune confusion dans l'état de présence
   - ✅ Participant count exact (2)

### Test 5: Refresh Pendant Vote
1. **Setup:**
   - AmySy démarre un vote
   - JonDoe vote (ex: carte "5")
   - JonDoe refresh avant révélation

2. **Vérifications:**
   - ✅ JonDoe redevient en ligne après refresh
   - ✅ Son vote précédent est conservé
   - ✅ AmySy peut toujours révéler les votes
   - ✅ Vote de JonDoe affiché correctement

## 🔍 Points de Contrôle Techniques

### Logs à Surveiller (Console Navigateur)
```
Updated online users: [userId1, userId2]
User connected: userId, Online users: [...]
Synchronisation de présence demandée pour la session...
```

### Logs à Surveiller (Console Serveur)
```
AmySy a rejoint la session sessionId (2 utilisateurs connectés)
Utilisateurs en ligne dans la session sessionId: [userId1, userId2]
Synchronisation de présence demandée pour la session sessionId: [...]
```

### Vérifications UI
- **Indicateur de présence:** Point vert à côté du nom
- **Compteur participants:** Nombre exact affiché
- **Liste utilisateurs:** Pas d'utilisateurs "fantômes"
- **Statuts votes:** Cohérents avec la présence

## 🚨 Cas d'Échec à Signaler

1. **Utilisateur apparaît offline après refresh** → Problème de synchronisation
2. **Participant count incorrect** → Problème de tracking côté serveur
3. **Utilisateur dupliqué** → Problème de nettoyage des sessions
4. **Perte de statut admin** → Problème de récupération de rôle
5. **Vote perdu après refresh** → Problème de persistance state

## ⚡ Tests de Performance

### Temps de Reconnexion
- **Attendu:** < 2 secondes pour redevenir online
- **Maximum Acceptable:** < 5 secondes

### Stabilité WebSocket
- Refresh multiples (5x) sans problème
- Aucune fuite mémoire côté client
- Aucune connexion fantôme côté serveur

## ✅ Critères de Succès

**Le fix est validé si:**
1. ✅ 100% des refresh testés maintiennent la présence correcte
2. ✅ Aucun cas de "tous offline" après refresh
3. ✅ Participant counts toujours exacts
4. ✅ Workflow de vote non impacté
5. ✅ Performance de reconnexion < 2 secondes

---

**URL de Test:** http://localhost:5000  
**Utilisateurs Test:** AmySy / JonDoe (mot de passe: test1234) 