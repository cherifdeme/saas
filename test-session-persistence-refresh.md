# Test : Persistance de Session Après Refresh (F5)

## 🎯 Objectif
Valider que les utilisateurs peuvent automatiquement se reconnecter à leur session après un refresh de page (F5) sans perte de données ni de statut en ligne.

## 🛠️ Mécanisme Implémenté

### 1. **Persistance Automatique**
- `sessionStorage.setItem('currentSessionId', sessionId)`
- `sessionStorage.setItem('currentUserId', userId)`
- `sessionStorage.setItem('currentUsername', username)`

### 2. **Auto-reconnection WebSocket**
- Détection automatique au reconnect WebSocket
- Émission de `rejoinSession` avec données complètes
- Vérification d'autorisation côté serveur

### 3. **Gestion d'Erreurs**
- Session expirée → Redirection dashboard + notification
- Accès non autorisé → Nettoyage storage + redirection
- Session introuvable → Toast d'erreur + retour dashboard

### 4. **Préservation des Rôles**
- Admin reste admin après refresh
- Participant reste participant
- Permissions préservées

## 📋 Scénarios de Test

### **Test 1 : Refresh Simple (Admin)**
**Étapes :**
1. Connectez-vous comme `ScrumMaster` (admin)
2. Créez ou rejoignez une session
3. Vérifiez que vous êtes admin (boutons reveal/reset visibles)
4. **Actualisez la page (F5)**
5. Attendez 2-3 secondes

**Résultats Attendus :**
- ✅ Reconnection automatique à la session
- ✅ Statut admin préservé (boutons admin visibles)
- ✅ Toast "Reconnecté à la session"
- ✅ Autres participants voient toujours l'admin comme "en ligne"

### **Test 2 : Refresh Simple (Participant)**
**Étapes :**
1. Connectez-vous comme `AmySy` (participant)
2. Rejoignez une session existante
3. Vérifiez que vous êtes participant (pas de boutons admin)
4. **Actualisez la page (F5)**
5. Attendez 2-3 secondes

**Résultats Attendus :**
- ✅ Reconnection automatique à la session
- ✅ Statut participant préservé
- ✅ Toast "Reconnecté à la session"
- ✅ Admin et autres participants voient le participant comme "en ligne"

### **Test 3 : Refresh Multiple Utilisateurs**
**Étapes :**
1. **ScrumMaster** (admin) et **AmySy** (participant) dans même session
2. Les deux voient statut "en ligne" mutuel
3. **AmySy actualise (F5)**
4. **ScrumMaster** observe
5. **ScrumMaster actualise (F5)**
6. **AmySy** observe

**Résultats Attendus :**
- ✅ Chaque refresh : reconnection automatique
- ✅ Les autres utilisateurs voient toujours le statut "en ligne"
- ✅ Aucun doublon d'utilisateurs
- ✅ Liste des participants toujours synchronisée

### **Test 4 : Session Expirée**
**Étapes :**
1. Connectez-vous et rejoignez une session
2. **Côté serveur** : Supprimez manuellement la session de MongoDB
3. **Actualisez la page (F5)**

**Résultats Attendus :**
- ✅ Toast d'erreur "Session introuvable ou expirée"
- ✅ Redirection automatique vers `/dashboard`
- ✅ Storage nettoyé (`currentSessionId`, etc.)

### **Test 5 : Navigation Entre Sessions**
**Étapes :**
1. Rejoignez la session A
2. Vérifiez storage : `sessionStorage.getItem('currentSessionId')`
3. Naviguez vers session B
4. Vérifiez storage mis à jour pour session B
5. Actualisez (F5)

**Résultats Attendus :**
- ✅ Storage mis à jour à chaque changement de session
- ✅ Refresh reconnecte à la session B (pas A)
- ✅ Pas de confusion entre sessions

### **Test 6 : Sortie Propre de Session**
**Étapes :**
1. Rejoignez une session
2. Cliquez "Quitter la session"
3. Vérifiez le storage : `sessionStorage.getItem('currentSessionId')`
4. Actualisez `/dashboard` (F5)

**Résultats Attendus :**
- ✅ Storage complètement nettoyé après sortie
- ✅ Pas de reconnection automatique intempestive
- ✅ Utilisateur reste sur dashboard

## 🔧 Logs à Surveiller

### **Côté Client (Console Browser)**
```javascript
// Lors du refresh
✅ Connecté au serveur WebSocket
🔄 Auto-rejoin session après reconnection: {sessionId: "...", userId: "...", username: "..."}
✅ Successfully rejoined session after refresh: {sessionId: "...", userCount: 2, users: [...], isAdmin: true}
🔄 Updated online users from rejoinedSession: ["userId1", "userId2"]
```

### **Côté Serveur (Docker Logs)**
```bash
🔄 ScrumMaster rejoint la session 684718821a1d09879cd03158 après refresh
✅ ScrumMaster reconnecté à la session 684718821a1d09879cd03158: {userCount: 2, users: [...], isAdmin: true}
```

## ⚠️ Points d'Attention

1. **Performance** : Reconnection < 2 secondes
2. **Pas de doublons** : Un utilisateur = une entrée dans la liste
3. **Cohérence** : État synchronisé entre tous les clients
4. **Sécurité** : Vérification d'autorisation à chaque rejoin
5. **UX** : Messages d'erreur clairs et redirections appropriées

## 🎉 Critères de Succès

- ✅ **Reconnection automatique** après refresh
- ✅ **Préservation des rôles** (admin/participant)
- ✅ **Synchronisation temps réel** maintenue
- ✅ **Gestion d'erreurs** robuste
- ✅ **Performance** < 2s de reconnection
- ✅ **UX fluide** sans interruption du workflow

---

## 💡 Usage en Développement

### Vérifier le Storage
```javascript
// Dans la console du navigateur
console.log('Session ID:', sessionStorage.getItem('currentSessionId'));
console.log('User ID:', sessionStorage.getItem('currentUserId'));
console.log('Username:', sessionStorage.getItem('currentUsername'));
```

### Simuler une Session Expirée
1. Dans MongoDB Compass : Supprimez la session courante
2. Actualisez la page
3. Vérifiez la redirection et le nettoyage

### Tester la Robustesse
- Refresh rapides multiples (F5 x5)
- Changement de session puis refresh
- Fermeture onglet puis réouverture URL session 