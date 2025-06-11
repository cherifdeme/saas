/**
 * Utilitaires de chiffrement côté client
 * SÉCURITÉ CRITIQUE : Chiffre les mots de passe avant envoi au serveur
 */

/**
 * Chiffre un mot de passe avec un salt côté client
 * @param {string} password - Mot de passe en clair
 * @param {string} username - Nom d'utilisateur (utilisé comme salt)
 * @returns {string} - Mot de passe chiffré
 */
export const hashPasswordClient = async (password, username) => {
  try {
    // Utilisation de Web Crypto API pour un hachage sécurisé
    const encoder = new TextEncoder();
    
    // Créer un salt basé sur le username et un salt statique
    const saltBase = `planning-poker-salt-${username}-secure-2024`;
    const salt = await crypto.subtle.digest('SHA-256', encoder.encode(saltBase));
    
    // Combiner le mot de passe avec le salt
    const passwordWithSalt = password + new Uint8Array(salt.slice(0, 16)).join('');
    
    // Hacher avec SHA-256
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(passwordWithSalt));
    
    // Convertir en hexadécimal
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;
  } catch (error) {
    console.error('Erreur lors du chiffrement:', error);
    // Fallback simple si Web Crypto API échoue
    return btoa(password + username).replace(/[^a-zA-Z0-9]/g, '');
  }
};

/**
 * Prépare les données de connexion de manière sécurisée
 * @param {Object} credentials - {username, password}
 * @returns {Object} - Credentials avec mot de passe chiffré
 */
export const prepareSecureCredentials = async (credentials) => {
  if (!credentials.password || !credentials.username) {
    throw new Error('Username et password requis');
  }
  
  const hashedPassword = await hashPasswordClient(credentials.password, credentials.username);
  
  return {
    username: credentials.username,
    passwordHash: hashedPassword, // Envoie passwordHash au lieu de password
    clientHash: true // Indique que c'est déjà hashé côté client
  };
};

/**
 * Nettoie les données sensibles d'un objet
 * @param {Object} obj - Objet à nettoyer
 * @returns {Object} - Objet nettoyé
 */
export const sanitizeForLogging = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  
  const cleaned = { ...obj };
  
  // Liste des champs à masquer
  const sensitiveFields = ['password', 'passwordHash', 'token', 'auth'];
  
  sensitiveFields.forEach(field => {
    if (cleaned[field]) {
      cleaned[field] = '********';
    }
  });
  
  return cleaned;
}; 