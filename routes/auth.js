const express = require('express');
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { generateToken, createTokenCookie, clearTokenCookie } = require('../utils/jwt');
const { authenticate } = require('../middleware/auth');
const connectionManager = require('../services/connectionManager');
const { secureLog } = require('../middleware/sanitizeLogging');

const router = express.Router();

// Validation schemas
const registerSchema = Joi.object({
  username: Joi.string().min(3).max(30).required(),
  password: Joi.string().min(6).optional(),
  passwordHash: Joi.string().optional(),
  clientHash: Joi.boolean().optional()
});

const loginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().optional(),
  passwordHash: Joi.string().optional(),
  clientHash: Joi.boolean().optional()
});

// 🔐 UTILITAIRE : Fonction de vérification de mot de passe hybride
const verifyPasswordHybrid = async (user, inputPassword, isClientHash = false) => {
  try {
    if (isClientHash) {
      // Pour les hash côté client, essayer d'abord la comparaison directe
      const directMatch = await bcrypt.compare(inputPassword, user.passwordHash);
      if (directMatch) {
        return true;
      }
      
      // Si pas de match direct, essayer avec le hash côté client stocké
      // (pour les utilisateurs créés avec le nouveau système)
      return inputPassword === user.passwordHash;
    } else {
      // Méthode classique pour les mots de passe en clair
      return await bcrypt.compare(inputPassword, user.passwordHash);
    }
  } catch (error) {
    secureLog('error', 'Erreur lors de la vérification du mot de passe', error);
    return false;
  }
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', async (req, res) => {
  try {
    // Validate input
    const { error } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { username, password, passwordHash, clientHash } = req.body;
    
    // 🔐 SÉCURITÉ: Déterminer le mot de passe à utiliser
    let finalPassword;
    let storeDirectly = false; // Pour les hash côté client
    
    if (clientHash && passwordHash) {
      // Mot de passe déjà chiffré côté client - stocker directement
      finalPassword = passwordHash;
      storeDirectly = true;
    } else if (password) {
      // Mot de passe en clair - sera hashé par le pre-save hook
      finalPassword = password;
    } else {
      return res.status(400).json({ message: 'Mot de passe requis' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Un utilisateur avec ce nom existe déjà' });
    }

    // Create new user
    const user = new User({
      username,
      passwordHash: finalPassword
    });
    
    // Si c'est un hash côté client, ne pas le re-hasher
    if (storeDirectly) {
      user.passwordHash = finalPassword;
      await user.save({ validateBeforeSave: false });
    } else {
      // Laisser le pre-save hook hasher le mot de passe
      await user.save();
    }

    // 🔐 SÉCURITÉ: Enregistrer la connexion pour le nouvel utilisateur
    connectionManager.registerConnection(username, user._id.toString());

    // Generate token and set cookie
    const token = generateToken(user._id);
    createTokenCookie(res, token);

    // Log de création et connexion (sans mot de passe)
    secureLog('info', `Nouvel utilisateur "${username}" créé et connecté.`, { 
      userId: user._id.toString(),
      ip: req.ip,
      clientHash: Boolean(clientHash)
    });

    res.status(201).json({
      message: 'Utilisateur créé avec succès',
      user: {
        id: user._id,
        username: user.username
      }
    });
  } catch (error) {
    secureLog('error', 'Erreur lors de la création du compte', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Un utilisateur avec ce nom existe déjà' });
    }
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res) => {
  try {
    // Validate input
    const { error } = loginSchema.validate(req.body);
    if (error) {
      secureLog('warn', 'Tentative de connexion avec données invalides', { 
        error: error.details[0].message,
        ip: req.ip 
      });
      return res.status(400).json({ message: error.details[0].message });
    }

    const { username, password, passwordHash, clientHash } = req.body;
  
    // 🔐 SÉCURITÉ: Déterminer le mot de passe à utiliser
    let finalPassword;
    let isClientHashAuth = false;
    
    if (clientHash && passwordHash) {
      // Mot de passe déjà chiffré côté client
      finalPassword = passwordHash;
      isClientHashAuth = true;
    } else if (password) {
      // Mot de passe en clair - pour compatibilité descendante
      finalPassword = password;
    } else {
      secureLog('warn', 'Tentative de connexion sans mot de passe', { 
        username, 
        ip: req.ip 
      });
      return res.status(400).json({ message: 'Mot de passe requis' });
    }

    // 🔐 SÉCURITÉ: Vérifier si l'utilisateur est déjà connecté
    if (connectionManager.isUserConnected(username)) {
      secureLog('warn', 'Tentative de double connexion refusée', { 
        username, 
        ip: req.ip,
        userAgent: req.get('User-Agent') 
      });
      return res.status(409).json({ 
        message: 'Utilisateur déjà connecté. Une seule session est autorisée par utilisateur.' 
      });
    }

    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      secureLog('warn', 'Tentative de connexion avec utilisateur inexistant', { 
        username, 
        ip: req.ip 
      });
      return res.status(401).json({ message: 'Nom d\'utilisateur ou mot de passe incorrect' });
    }

    // 🔐 VÉRIFICATION HYBRIDE : Compatibilité avec anciens et nouveaux utilisateurs
    let isPasswordValid = false;
    
    if (isClientHashAuth) {
      // 1. Essayer comparaison directe pour les utilisateurs créés avec le nouveau système
      if (finalPassword === user.passwordHash) {
        isPasswordValid = true;
      } else {
        // 2. Essayer avec bcrypt pour les anciens utilisateurs
        try {
          isPasswordValid = await bcrypt.compare(finalPassword, user.passwordHash);
        } catch (bcryptError) {
          // 3. Si bcrypt échoue, essayer une comparaison simple (utilisateurs de test)
          isPasswordValid = (finalPassword === user.passwordHash);
        }
      }
    } else {
      // Méthode classique pour les mots de passe en clair
      isPasswordValid = await verifyPasswordHybrid(user, finalPassword, false);
    }
    
    if (!isPasswordValid) {
      secureLog('warn', 'Tentative de connexion avec mot de passe incorrect', { 
        username, 
        ip: req.ip,
        authMethod: isClientHashAuth ? 'clientHash' : 'plaintext'
      });
      return res.status(401).json({ message: 'Nom d\'utilisateur ou mot de passe incorrect' });
    }

    // 🔐 SÉCURITÉ: Enregistrer la connexion avant de créer le token
    const connectionRegistered = connectionManager.registerConnection(username, user._id.toString());
    if (!connectionRegistered) {
      // Race condition: quelqu'un s'est connecté entre temps
      secureLog('warn', 'Race condition détectée lors de la connexion', { 
        username, 
        ip: req.ip 
      });
      return res.status(409).json({ 
        message: 'Utilisateur déjà connecté. Une seule session est autorisée par utilisateur.' 
      });
    }

    // Generate token and set cookie
    const token = generateToken(user._id);
    createTokenCookie(res, token);

    // Log de connexion réussie (sans mot de passe)
    secureLog('info', `Utilisateur "${username}" connecté.`, { 
      userId: user._id.toString(),
      ip: req.ip,
      authMethod: isClientHashAuth ? 'clientHash' : 'plaintext'
    });

    res.json({
      message: 'Connexion réussie',
      user: {
        id: user._id,
        username: user.username
      }
    });
  } catch (error) {
    secureLog('error', 'Erreur lors de la connexion', error, { 
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', authenticate, (req, res) => {
  try {
    const username = req.user.username;
    
    // 🔐 SÉCURITÉ: Supprimer la connexion du gestionnaire
    connectionManager.removeConnectionByUsername(username);
    
    // Nettoyer le cookie
    clearTokenCookie(res);
    
    // Log de déconnexion
    secureLog('info', `Utilisateur "${username}" déconnecté.`, { 
      userId: req.user._id.toString(),
      ip: req.ip 
    });
    
    res.json({ message: 'Déconnexion réussie' });
  } catch (error) {
    secureLog('error', 'Erreur lors de la déconnexion', error, { 
      ip: req.ip 
    });
    res.status(500).json({ message: 'Erreur lors de la déconnexion' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', authenticate, (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      username: req.user.username
    }
  });
});

module.exports = router; 