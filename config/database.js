const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    // Configuration différente selon l'environnement
    let mongoURI;
    
    if (process.env.NODE_ENV === 'production') {
      // Production avec authentification
      mongoURI = process.env.MONGODB_URI || 'mongodb://admin:password123@localhost:27017/planning-poker?authSource=admin';
    } else {
      // Développement sans authentification
      mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/planning-poker';
    }

    const conn = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Timeout après 5 secondes
      socketTimeoutMS: 45000, // Close sockets après 45 secondes d'inactivité
    });

    logger.info(`✅ MongoDB connecté: ${conn.connection.host}`, {
      database: conn.connection.name,
      environment: process.env.NODE_ENV || 'development'
    });
    
  } catch (error) {
    logger.error('❌ Erreur de connexion à MongoDB:', error);
    
    // 🔧 MODE CI/TEST : Ne pas arrêter le serveur si MongoDB n'est pas disponible
    if (process.env.NODE_ENV === 'test' || process.env.CI === 'true') {
      logger.info('💡 Pour démarrer MongoDB localement:', {
        docker: 'docker run -d -p 27017:27017 --name mongodb mongo:7.0',
        message: 'Ou installez MongoDB localement'
      });
      logger.warn('⚠️ Mode CI/Test: Serveur démarré sans MongoDB');
      return; // Continue sans MongoDB en mode test
    }
    
    // En développement, donner des conseils mais arrêter
    if (process.env.NODE_ENV !== 'production') {
      logger.info('💡 Pour démarrer MongoDB localement:', {
        docker: 'docker run -d -p 27017:27017 --name mongodb mongo:7.0',
        message: 'Ou installez MongoDB localement'
      });
    }
    
    process.exit(1);
  }
};

module.exports = connectDB; 