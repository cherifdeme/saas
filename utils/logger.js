/**
 * Logger professionnel Winston
 * Remplace les console.log de développement
 */

const winston = require('winston');
const path = require('path');

// Créer le répertoire des logs s'il n'existe pas
const logsDir = path.join(__dirname, '..', 'logs');

// Configuration des formats
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Format pour la console en développement
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    let logMessage = `${timestamp} [${level}]: ${message}`;
    
    // Ajouter les métadonnées si présentes
    if (Object.keys(meta).length > 0) {
      logMessage += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return logMessage;
  })
);

// Configuration des transports
const transports = [];

// Console en développement avec format coloré
if (process.env.NODE_ENV === 'development') {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      level: 'debug'
    })
  );
} else {
  // Console en production avec format JSON
  transports.push(
    new winston.transports.Console({
      format: logFormat,
      level: 'info'
    })
  );
}

// Fichiers de logs pour tous les environnements
transports.push(
  // Logs d'erreurs uniquement
  new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    format: logFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  
  // Tous les logs
  new winston.transports.File({
    filename: path.join(logsDir, 'combined.log'),
    format: logFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  })
);

// Créer le logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: logFormat,
  transports,
  
  // Ne pas quitter sur les erreurs non gérées
  exitOnError: false,
  
  // Gestion des exceptions non capturées
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      format: logFormat
    })
  ],
  
  // Gestion des rejections non capturées
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      format: logFormat
    })
  ]
});

// Méthodes de log simplifiées et sécurisées
const secureLogger = {
  /**
   * Log d'information
   */
  info: (message, meta = {}) => {
    logger.info(message, meta);
  },

  /**
   * Log d'erreur
   */
  error: (message, error = null, meta = {}) => {
    const errorMeta = { ...meta };
    
    if (error) {
      if (error instanceof Error) {
        errorMeta.error = {
          message: error.message,
          stack: error.stack,
          name: error.name
        };
      } else {
        errorMeta.error = error;
      }
    }
    
    logger.error(message, errorMeta);
  },

  /**
   * Log de warning
   */
  warn: (message, meta = {}) => {
    logger.warn(message, meta);
  },

  /**
   * Log de debug (uniquement en développement)
   */
  debug: (message, meta = {}) => {
    if (process.env.NODE_ENV === 'development') {
      logger.debug(message, meta);
    }
  },

  /**
   * Log de connexion utilisateur
   */
  userConnected: (username) => {
    logger.info(`Utilisateur "${username}" connecté.`);
  },

  /**
   * Log de déconnexion utilisateur
   */
  userDisconnected: (username) => {
    logger.info(`Utilisateur "${username}" déconnecté.`);
  },

  /**
   * Log de création de session
   */
  sessionCreated: (sessionId, username) => {
    logger.info(`Session créée par "${username}".`, { sessionId });
  },

  /**
   * Log de suppression de session
   */
  sessionDeleted: (sessionId, username) => {
    logger.info(`Session supprimée par "${username}".`, { sessionId });
  },

  /**
   * Log de démarrage du serveur
   */
  serverStarted: (port, environment) => {
    logger.info(`🚀 Serveur démarré sur le port ${port}`, { 
      port, 
      environment,
      timestamp: new Date().toISOString()
    });
  },

  /**
   * Log d'arrêt du serveur
   */
  serverStopped: () => {
    logger.info('Serveur fermé.');
  },

  /**
   * Log d'erreur critique
   */
  critical: (message, error = null, meta = {}) => {
    const errorMeta = { ...meta, level: 'CRITICAL' };
    
    if (error) {
      if (error instanceof Error) {
        errorMeta.error = {
          message: error.message,
          stack: error.stack,
          name: error.name
        };
      } else {
        errorMeta.error = error;
      }
    }
    
    logger.error(`🚨 CRITIQUE: ${message}`, errorMeta);
  }
};

// Créer le répertoire des logs si nécessaire
const fs = require('fs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

module.exports = secureLogger; 