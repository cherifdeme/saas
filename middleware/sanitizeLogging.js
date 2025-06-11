/**
 * Middleware de masquage automatique des champs sensibles
 * Empêche l'affichage des mots de passe dans les logs et traces
 */

const logger = require('../utils/logger');

// Liste exhaustive des champs sensibles - AUCUN ne doit être visible
const SENSITIVE_FIELDS = [
  'password',
  'pwd',
  'pass',
  'passwd',
  'motdepasse',
  'mot_de_passe',
  'passwordHash',
  'password_hash',
  'hash',
  'confirmPassword',
  'confirm_password',
  'newPassword',
  'new_password',
  'oldPassword',
  'old_password',
  'currentPassword',
  'current_password',
  'token',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'secret',
  'secret_key',
  'apiKey',
  'api_key',
  'apiSecret',
  'api_secret',
  'privateKey',
  'private_key',
  'auth',
  'authorization',
  'credential',
  'credentials'
];

/**
 * Masque récursivement les champs sensibles dans un objet
 * @param {any} obj - Objet à masquer
 * @param {string} maskValue - Valeur de masquage (par défaut '********')
 * @returns {any} Objet avec champs sensibles masqués
 */
const maskSensitiveData = (obj, maskValue = '********') => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Si c'est une primitive, retourner telle quelle
  if (typeof obj !== 'object') {
    return obj;
  }

  // Si c'est un array, traiter chaque élément
  if (Array.isArray(obj)) {
    return obj.map(item => maskSensitiveData(item, maskValue));
  }

  // Traiter l'objet
  const maskedObj = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    // 🔐 PROTECTION ULTRA-STRICTE : Vérifier si c'est un champ sensible
    const isSensitive = SENSITIVE_FIELDS.some(field => 
      lowerKey.includes(field.toLowerCase())
    );
    
    // 🔐 PROTECTION SUPPLÉMENTAIRE : Pattern exact pour "password"
    const isPasswordField = lowerKey === 'password' || 
                           lowerKey === 'pwd' || 
                           lowerKey === 'pass' || 
                           lowerKey.includes('password') ||
                           lowerKey.includes('motdepasse');
    
    if ((isSensitive || isPasswordField) && value !== undefined && value !== null) {
      maskedObj[key] = maskValue;
    } else if (typeof value === 'object') {
      maskedObj[key] = maskSensitiveData(value, maskValue);
    } else {
      maskedObj[key] = value;
    }
  }
  
  return maskedObj;
};

/**
 * Middleware Express pour masquer les données sensibles dans req.body et req.query
 */
const sanitizeLoggingMiddleware = (req, res, next) => {
  // Sauvegarder les données originales
  const originalBody = req.body;
  const originalQuery = req.query;
  
  // Créer des versions masquées pour les logs
  req._maskedBody = maskSensitiveData(originalBody);
  req._maskedQuery = maskSensitiveData(originalQuery);
  
  // Override console methods pour cette requête si besoin
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  
  // Intercepter les console.log qui pourraient logger req.body
  const createSafeLogger = (originalMethod) => {
    return (...args) => {
      const safeArgs = args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
          return maskSensitiveData(arg);
        }
        return arg;
      });
      originalMethod.apply(console, safeArgs);
    };
  };
  
  // Pas besoin d'override console ici car on va nettoyer les logs
  // console.log = createSafeLogger(originalConsoleLog);
  // console.error = createSafeLogger(originalConsoleError);
  // console.warn = createSafeLogger(originalConsoleWarn);
  
  // Restaurer à la fin de la requête
  res.on('finish', () => {
    // console.log = originalConsoleLog;
    // console.error = originalConsoleError;
    // console.warn = originalConsoleWarn;
  });
  
  next();
};

/**
 * Fonction utilitaire pour logger de manière sécurisée
 * @param {string} level - Niveau de log (info, error, warn, debug)
 * @param {string} message - Message à logger
 * @param {Object} data - Données à logger (seront masquées automatiquement)
 */
const secureLog = (level, message, data = {}) => {
  const maskedData = maskSensitiveData(data);
  
  if (logger && typeof logger[level] === 'function') {
    logger[level](message, maskedData);
  } else {
    // Fallback si winston n'est pas disponible
    const logMessage = data && Object.keys(data).length > 0 
      ? `${message} ${JSON.stringify(maskedData, null, 2)}`
      : message;
    
    switch (level) {
      case 'error':
        console.error(`❌ ${logMessage}`);
        break;
      case 'warn':
        console.warn(`⚠️ ${logMessage}`);
        break;
      case 'info':
        console.log(`ℹ️ ${logMessage}`);
        break;
      case 'debug':
        if (process.env.NODE_ENV === 'development') {
          console.log(`🐛 ${logMessage}`);
        }
        break;
      default:
        console.log(logMessage);
    }
  }
};

/**
 * Fonction pour masquer les données sensibles dans une requête pour l'affichage
 * @param {Object} req - Objet de requête Express
 * @returns {Object} Objet de requête avec données sensibles masquées
 */
const getSafeRequestData = (req) => {
  return {
    method: req.method,
    url: req.url,
    headers: maskSensitiveData(req.headers),
    body: req._maskedBody || maskSensitiveData(req.body),
    query: req._maskedQuery || maskSensitiveData(req.query),
    params: req.params,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  };
};

/**
 * Middleware de logging sécurisé des requêtes
 */
const secureRequestLogging = (req, res, next) => {
  const start = Date.now();
  
  // Logger uniquement les routes sensibles
  const shouldLog = req.path.includes('/auth') || req.path.includes('/login') || req.path.includes('/register');
  
  if (shouldLog) {
    const safeReqData = getSafeRequestData(req);
    secureLog('info', `Requête reçue: ${req.method} ${req.path}`, {
      url: safeReqData.url,
      body: safeReqData.body,
      query: safeReqData.query,
      ip: safeReqData.ip
    });
  }
  
  // Logger la réponse
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    if (shouldLog) {
      secureLog('info', `Requête terminée: ${req.method} ${req.path}`, {
        statusCode: res.statusCode,
        duration: `${duration}ms`
      });
    }
  });
  
  next();
};

module.exports = {
  sanitizeLoggingMiddleware,
  secureLog,
  maskSensitiveData,
  getSafeRequestData,
  secureRequestLogging,
  SENSITIVE_FIELDS
};