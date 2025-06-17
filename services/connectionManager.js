/**
 * Service de gestion des connexions utilisateurs actives
 * Empêche les connexions multiples et synchronise WebSocket/Auth
 */

class ConnectionManager {
  constructor() {
    // Map username -> { socketId, userId, loginTime }
    this.activeConnections = new Map();
    
    // Map socketId -> username pour la déconnexion rapide
    this.socketToUser = new Map();
  }

  /**
   * Vérifie si un utilisateur est déjà connecté
   * @param {string} username - Nom d'utilisateur à vérifier
   * @returns {boolean} true si déjà connecté
   */
  isUserConnected(username) {
    return this.activeConnections.has(username);
  }

  /**
   * Enregistre une nouvelle connexion utilisateur
   * @param {string} username - Nom d'utilisateur
   * @param {string} userId - ID utilisateur
   * @param {string} socketId - ID du socket WebSocket (optionnel)
   * @returns {boolean} true si l'enregistrement a réussi, false si déjà connecté
   */
  registerConnection(username, userId, socketId = null) {
    if (this.isUserConnected(username)) {
      return false; // Utilisateur déjà connecté
    }

    const connectionInfo = {
      userId,
      socketId,
      loginTime: new Date(),
      lastActivity: new Date()
    };

    this.activeConnections.set(username, connectionInfo);
    
    if (socketId) {
      this.socketToUser.set(socketId, username);
    }

    return true;
  }

  /**
   * Met à jour le socketId d'une connexion existante
   * @param {string} username - Nom d'utilisateur
   * @param {string} socketId - Nouveau ID du socket
   */
  updateSocketId(username, socketId) {
    const connection = this.activeConnections.get(username);
    if (connection) {
      // Supprimer l'ancien mapping socket si existant
      if (connection.socketId) {
        this.socketToUser.delete(connection.socketId);
      }
      
      // Mettre à jour avec le nouveau socket
      connection.socketId = socketId;
      connection.lastActivity = new Date();
      this.socketToUser.set(socketId, username);
    }
  }

  /**
   * Supprime une connexion par nom d'utilisateur
   * @param {string} username - Nom d'utilisateur à déconnecter
   */
  removeConnectionByUsername(username) {
    const connection = this.activeConnections.get(username);
    if (connection && connection.socketId) {
      this.socketToUser.delete(connection.socketId);
    }
    this.activeConnections.delete(username);
  }

  /**
   * Supprime une connexion par socketId
   * @param {string} socketId - ID du socket déconnecté
   */
  removeConnectionBySocketId(socketId) {
    const username = this.socketToUser.get(socketId);
    if (username) {
      this.socketToUser.delete(socketId);
      this.activeConnections.delete(username);
    }
  }

  /**
   * Obtient les informations d'une connexion
   * @param {string} username - Nom d'utilisateur
   * @returns {Object|null} Informations de connexion ou null
   */
  getConnectionInfo(username) {
    return this.activeConnections.get(username) || null;
  }

  /**
   * Obtient la liste de tous les utilisateurs connectés
   * @returns {Array} Liste des noms d'utilisateurs connectés
   */
  getConnectedUsers() {
    return Array.from(this.activeConnections.keys());
  }

  /**
   * Obtient le nombre d'utilisateurs connectés
   * @returns {number} Nombre d'utilisateurs connectés
   */
  getConnectionCount() {
    return this.activeConnections.size;
  }

  /**
   * Nettoie les connexions inactives (plus de 50 minutes)
   * 🕒 TOLÉRANCE ÉTENDUE: Permet discussions longues avant vote
   */
  cleanupInactiveConnections() {
    const now = new Date();
    const timeout = 50 * 60 * 1000; // 50 minutes en millisecondes

    for (const [username, connection] of this.activeConnections.entries()) {
      if (now - connection.lastActivity > timeout) {
        this.removeConnectionByUsername(username);
      }
    }
  }

  /**
   * Met à jour l'activité d'un utilisateur
   * @param {string} username - Nom d'utilisateur
   */
  updateActivity(username) {
    const connection = this.activeConnections.get(username);
    if (connection) {
      connection.lastActivity = new Date();
    }
  }

  /**
   * Obtient des statistiques sur les connexions
   * @returns {Object} Statistiques détaillées
   */
  getStats() {
    const connections = Array.from(this.activeConnections.values());
    const now = new Date();
    
    return {
      totalConnections: this.activeConnections.size,
      connectionsWithSocket: connections.filter(c => c.socketId).length,
      averageSessionDuration: connections.length > 0 
        ? connections.reduce((acc, c) => acc + (now - c.loginTime), 0) / connections.length / 1000 / 60 // en minutes
        : 0,
      oldestConnection: connections.length > 0 
        ? Math.min(...connections.map(c => c.loginTime.getTime()))
        : null
    };
  }
}

// Instance singleton
const connectionManager = new ConnectionManager();

// 🕒 Nettoyage automatique toutes les 15 minutes (plus tolérant)
setInterval(() => {
  connectionManager.cleanupInactiveConnections();
}, 15 * 60 * 1000);

module.exports = connectionManager; 