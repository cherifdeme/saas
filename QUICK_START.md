# 🚀 Guide de Démarrage Rapide - Planning Poker

## Démarrage en 2 minutes avec Docker

### Prérequis
- Docker installé sur votre machine
- Docker Compose installé

### Étapes

1. **Cloner le projet**
   ```bash
   git clone <repository-url>
   cd planning-poker
   ```

2. **Démarrer l'application**
   
   **Sur Linux/Mac:**
   ```bash
   chmod +x scripts/start.sh
   ./scripts/start.sh
   ```
   
   **Sur Windows (PowerShell):**
   ```powershell
   .\scripts\start.ps1
   ```
   
   **Ou manuellement:**
   ```bash
   docker-compose up --build -d
   ```

3. **Accéder à l'application**
   - Ouvrez votre navigateur sur http://localhost:5000

4. **Se connecter avec un utilisateur de test**
   - Utilisateur: `AmySy`
   - Mot de passe: `test1234`

## 🎮 Test rapide

1. **Créer une session**
   - Cliquez sur "Créer une session"
   - Donnez un nom à votre session
   - Vous êtes maintenant admin de cette session

2. **Ouvrir un second onglet**
   - Connectez-vous avec un autre utilisateur (`JonDoe` / `test1234`)
   - Rejoignez la session créée

3. **Voter**
   - Chaque utilisateur sélectionne une carte
   - L'admin peut révéler les votes
   - L'admin peut réinitialiser pour un nouveau tour

## 🛑 Arrêter l'application

```bash
docker-compose down
```

## 📋 Logs et Debug

```bash
# Voir les logs en temps réel
docker-compose logs -f

# Voir les logs d'un service spécifique
docker-compose logs -f app
docker-compose logs -f mongodb
```

## 🔧 Problèmes courants

### Port 5000 déjà utilisé
```bash
# Changer le port dans docker-compose.yml
ports:
  - "3001:5000"  # Utiliser le port 3001 au lieu de 5000
```

### Problème de permissions (Linux/Mac)
```bash
sudo chmod +x scripts/start.sh
```

### MongoDB ne démarre pas
```bash
# Supprimer les volumes et redémarrer
docker-compose down -v
docker-compose up --build -d
```

## 🎯 Prochaines étapes

- Consultez le [README.md](README.md) pour la documentation complète
- Explorez les fonctionnalités temps réel
- Testez avec plusieurs utilisateurs
- Personnalisez la configuration dans `.env` 