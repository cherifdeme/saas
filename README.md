# Planning Poker - Application Collaborative

Une application Planning Poker moderne et collaborative pour l'estimation agile en temps réel, construite avec React, Node.js, Socket.IO et MongoDB.

## 🚀 Fonctionnalités

### 🔐 Authentification
- Inscription et connexion sécurisées avec JWT
- Mots de passe hachés avec bcrypt
- Cookies HTTP-only pour la sécurité
- Utilisateurs de test pré-configurés

### 🏠 Tableau de bord
- Création de nouvelles sessions d'estimation
- Liste des sessions créées par l'utilisateur
- Liste des sessions publiques disponibles
- Mises à jour en temps réel via WebSocket

### 🗂️ Gestion des sessions
- Sessions avec nom personnalisé
- Rôles admin/participant avec permissions
- Suppression de sessions (admin uniquement)
- Participation libre aux sessions publiques

### 🗳️ Système de vote
- Cartes Planning Poker standard : 1, 2, 3, 5, 8, 13, 21, 40, ∞, ?
- Votes cachés jusqu'à révélation par l'admin
- Actions admin : révéler votes, réinitialiser votes
- Statistiques automatiques (moyenne, min, max, consensus)

### 📡 Temps réel
- Synchronisation instantanée via Socket.IO
- Notifications de création/suppression de sessions
- Mises à jour des votes en direct
- Indicateurs de présence des utilisateurs

### 🧩 Intégration Jira (Optionnelle)
- Sélection manuelle de tickets Jira
- Affichage des détails du ticket
- Possibilité d'estimation libre sans Jira

## 🛠️ Stack Technique

### Backend
- **Node.js** + **Express** - Serveur API REST
- **Socket.IO** - Communication temps réel
- **MongoDB** + **Mongoose** - Base de données
- **JWT** + **bcrypt** - Authentification sécurisée
- **Joi** - Validation des données

### Frontend
- **React 18** - Interface utilisateur
- **TailwindCSS** - Styles modernes
- **React Router** - Navigation
- **Axios** - Requêtes HTTP
- **React Hot Toast** - Notifications
- **Lucide React** - Icônes

### DevOps
- **Docker** - Conteneurisation
- **Docker Compose** - Orchestration locale

## 🚀 Installation et Démarrage

### Prérequis
- Node.js 18+
- MongoDB (ou Docker)
- npm ou yarn

### Option 1: Avec Docker (Recommandé)

1. **Cloner le projet**
   ```bash
   git clone <repository-url>
   cd planning-poker
   ```

2. **Démarrer avec Docker Compose**
   ```bash
   docker-compose up -d
   ```

3. **Accéder à l'application**
   - Application : http://localhost:5000
   - MongoDB : localhost:27017

### Option 2: Installation manuelle

1. **Cloner et installer les dépendances backend**
   ```bash
   git clone <repository-url>
   cd planning-poker
   npm install
   ```

2. **Installer les dépendances frontend**
   ```bash
   cd client
   npm install
   cd ..
   ```

3. **Configurer l'environnement**
   ```bash
   cp config/env.example .env
   # Éditer .env avec vos configurations
   ```

4. **Démarrer MongoDB**
   ```bash
   # Avec Docker
   docker run -d -p 27017:27017 --name mongodb mongo:7.0
   
   # Ou installer MongoDB localement
   ```

5. **Démarrer le backend**
   ```bash
   npm run dev
   ```

6. **Démarrer le frontend (nouveau terminal)**
   ```bash
   cd client
   npm start
   ```

7. **Accéder à l'application**
   - Frontend : http://localhost:3000
   - Backend : http://localhost:5000

## 👥 Utilisateurs de test

L'application crée automatiquement ces utilisateurs de test :

| Nom d'utilisateur | Mot de passe | Rôle suggéré |
|-------------------|--------------|--------------|
| `AmySy` | `test1234` | Développeur |
| `JonDoe` | `test1234` | Développeur |
| `AdminTest` | `test1234` | Admin |
| `ScrumMaster` | `test1234` | Scrum Master |

## 🎮 Guide d'utilisation

### 1. Connexion
- Utilisez un des comptes de test ou créez un nouveau compte
- Cliquez sur un utilisateur de test pour remplir automatiquement le formulaire

### 2. Créer une session
- Cliquez sur "Créer une session" dans le tableau de bord
- Donnez un nom à votre session
- Vous êtes automatiquement admin de cette session

### 3. Rejoindre une session
- Cliquez sur "Rejoindre" pour une session publique
- Ou partagez l'URL de session avec votre équipe

### 4. Voter
- Sélectionnez une carte Planning Poker (1, 2, 3, 5, 8, 13, 21, 40, ∞, ?)
- Votre vote est enregistré mais reste caché
- L'admin peut révéler tous les votes

### 5. Actions admin
- **Révéler votes** : Affiche tous les votes et les statistiques
- **Reset votes** : Efface tous les votes pour un nouveau tour
- **Supprimer session** : Supprime définitivement la session

## 🔧 Configuration

### Variables d'environnement

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/planning-poker
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d
COOKIE_SECRET=your-cookie-secret-key-change-in-production

# Jira Integration (Optionnel)
JIRA_BASE_URL=
JIRA_USERNAME=
JIRA_API_TOKEN=
```

### Permissions par rôle

```json
{
  "admin": {
    "createSession": true,
    "deleteSession": true,
    "revealVotes": true,
    "resetVotes": true,
    "selectJiraTicket": true,
    "submitVote": true,
    "viewRevealedVotes": true
  },
  "participant": {
    "createSession": false,
    "deleteSession": false,
    "revealVotes": false,
    "resetVotes": false,
    "selectJiraTicket": false,
    "submitVote": true,
    "viewRevealedVotes": true
  }
}
```

## 🧪 Tests

```bash
# Tests backend
npm test

# Tests frontend
cd client
npm test
```

## 📦 Production

### Build de production
```bash
# Build frontend
cd client
npm run build

# Démarrer en production
cd ..
NODE_ENV=production npm start
```

### Déploiement Docker
```bash
# Build image
docker build -t planning-poker .

# Run container
docker run -d -p 5000:5000 \
  -e MONGODB_URI=mongodb://your-mongo-host:27017/planning-poker \
  -e JWT_SECRET=your-production-secret \
  planning-poker
```

## 🔒 Sécurité

- Mots de passe hachés avec bcrypt (salt rounds: 12)
- JWT stockés dans des cookies HTTP-only
- Validation des données avec Joi
- Rate limiting sur les API
- Helmet.js pour les headers de sécurité
- CORS configuré correctement

## 🤝 Contribution

1. Fork le projet
2. Créez une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request

## 📝 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## 🆘 Support

Pour toute question ou problème :
1. Vérifiez les logs avec `docker-compose logs`
2. Consultez la documentation des API à `/api/health`
3. Ouvrez une issue sur GitHub

## 🎯 Roadmap

- [ ] Chat intégré dans les sessions
- [ ] Historique des votes
- [ ] Export des résultats
- [ ] Intégration Jira complète
- [ ] Thèmes personnalisables
- [ ] Mode hors ligne
- [ ] Application mobile 