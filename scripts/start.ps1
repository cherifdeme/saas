# Planning Poker - Script de démarrage PowerShell
Write-Host "🚀 Démarrage de Planning Poker..." -ForegroundColor Green

# Vérifier si Docker est installé
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Docker n'est pas installé. Veuillez installer Docker Desktop pour continuer." -ForegroundColor Red
    exit 1
}

# Vérifier si Docker Compose est installé
if (-not (Get-Command docker-compose -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Docker Compose n'est pas installé. Veuillez installer Docker Compose pour continuer." -ForegroundColor Red
    exit 1
}

# Créer le fichier .env s'il n'existe pas
if (-not (Test-Path .env)) {
    Write-Host "📝 Création du fichier .env..." -ForegroundColor Yellow
    Copy-Item config/env.example .env
    Write-Host "✅ Fichier .env créé. Vous pouvez le modifier selon vos besoins." -ForegroundColor Green
}

# Arrêter les conteneurs existants
Write-Host "🛑 Arrêt des conteneurs existants..." -ForegroundColor Yellow
docker-compose down

# Construire et démarrer les services
Write-Host "🔨 Construction et démarrage des services..." -ForegroundColor Yellow
docker-compose up --build -d

# Attendre que les services soient prêts
Write-Host "⏳ Attente du démarrage des services..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Vérifier l'état des services
Write-Host "🔍 Vérification de l'état des services..." -ForegroundColor Yellow
docker-compose ps

# Afficher les logs
Write-Host "📋 Affichage des logs récents..." -ForegroundColor Yellow
docker-compose logs --tail=20

Write-Host ""
Write-Host "🎉 Planning Poker est maintenant disponible !" -ForegroundColor Green
Write-Host "🌐 Application: http://localhost:5000" -ForegroundColor Cyan
Write-Host "🗄️  MongoDB: localhost:27017" -ForegroundColor Cyan
Write-Host ""
Write-Host "👥 Utilisateurs de test disponibles:" -ForegroundColor Yellow
Write-Host "   - AmySy / test1234" -ForegroundColor White
Write-Host "   - JonDoe / test1234" -ForegroundColor White
Write-Host "   - AdminTest / test1234" -ForegroundColor White
Write-Host "   - ScrumMaster / test1234" -ForegroundColor White
Write-Host ""
Write-Host "📚 Commandes utiles:" -ForegroundColor Yellow
Write-Host "   - Voir les logs: docker-compose logs -f" -ForegroundColor White
Write-Host "   - Arrêter: docker-compose down" -ForegroundColor White
Write-Host "   - Redémarrer: docker-compose restart" -ForegroundColor White
Write-Host "" 