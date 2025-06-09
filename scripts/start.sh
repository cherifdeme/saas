#!/bin/bash

# Planning Poker - Script de démarrage
echo "🚀 Démarrage de Planning Poker..."

# Vérifier si Docker est installé
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé. Veuillez installer Docker pour continuer."
    exit 1
fi

# Vérifier si Docker Compose est installé
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose n'est pas installé. Veuillez installer Docker Compose pour continuer."
    exit 1
fi

# Créer le fichier .env s'il n'existe pas
if [ ! -f .env ]; then
    echo "📝 Création du fichier .env..."
    cp config/env.example .env
    echo "✅ Fichier .env créé. Vous pouvez le modifier selon vos besoins."
fi

# Arrêter les conteneurs existants
echo "🛑 Arrêt des conteneurs existants..."
docker-compose down

# Construire et démarrer les services
echo "🔨 Construction et démarrage des services..."
docker-compose up --build -d

# Attendre que les services soient prêts
echo "⏳ Attente du démarrage des services..."
sleep 10

# Vérifier l'état des services
echo "🔍 Vérification de l'état des services..."
docker-compose ps

# Afficher les logs
echo "📋 Affichage des logs récents..."
docker-compose logs --tail=20

echo ""
echo "🎉 Planning Poker est maintenant disponible !"
echo "🌐 Application: http://localhost:5000"
echo "🗄️  MongoDB: localhost:27017"
echo ""
echo "👥 Utilisateurs de test disponibles:"
echo "   - AmySy / test1234"
echo "   - JonDoe / test1234" 
echo "   - AdminTest / test1234"
echo "   - ScrumMaster / test1234"
echo ""
echo "📚 Commandes utiles:"
echo "   - Voir les logs: docker-compose logs -f"
echo "   - Arrêter: docker-compose down"
echo "   - Redémarrer: docker-compose restart"
echo "" 