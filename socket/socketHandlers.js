const Session = require('../models/Session');
const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');
const connectionManager = require('../services/connectionManager');
const logger = require('../utils/logger');

// Track online users per session
const sessionConnections = new Map(); // sessionId -> Set of userIds

// Cleanup function to remove user from session participants in DB
const cleanupUserFromSession = async (sessionId, userId) => {
  try {
    const session = await Session.findById(sessionId);
    if (!session) return;

    // Don't remove the creator from their own session
    if (session.createdBy.toString() === userId) return;

    // Remove user from participants list if they were added
    const wasParticipant = session.participants.some(p => p.toString() === userId);
    if (wasParticipant) {
      session.participants = session.participants.filter(
        p => p.toString() !== userId
      );
      await session.save();
    }
  } catch (error) {
    logger.error('Error cleaning up user from session', error);
  }
};

const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.cookie?.split('token=')[1]?.split(';')[0];
    
    if (!token) {
      return next(new Error('Token d\'authentification requis'));
    }

    const decoded = verifyToken(token);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return next(new Error('Utilisateur non trouvé'));
    }

    socket.userId = user._id.toString();
    socket.username = user.username;
    next();
  } catch (error) {
    next(new Error('Token invalide'));
  }
};

const addUserToSession = (sessionId, userId) => {
  if (!sessionConnections.has(sessionId)) {
    sessionConnections.set(sessionId, new Set());
  }
  sessionConnections.get(sessionId).add(userId);
};

const removeUserFromSession = (sessionId, userId) => {
  if (sessionConnections.has(sessionId)) {
    sessionConnections.get(sessionId).delete(userId);
    if (sessionConnections.get(sessionId).size === 0) {
      sessionConnections.delete(sessionId);
    }
  }
};

const getSessionUserCount = (sessionId) => {
  return sessionConnections.has(sessionId) ? sessionConnections.get(sessionId).size : 0;
};

const getAllSessionCounts = () => {
  const counts = {};
  for (const [sessionId, users] of sessionConnections.entries()) {
    counts[sessionId] = users.size;
  }
  return counts;
};

// Get actually connected users from Socket.IO rooms (more reliable than sessionConnections)
const getConnectedUsersInSession = async (io, sessionId) => {
  try {
    const room = io.sockets.adapter.rooms.get(`session-${sessionId}`);
    if (!room) return [];
    
    const connectedUsers = [];
    for (const socketId of room) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket && socket.userId && socket.username) {
        // Avoid duplicates (same user might have multiple socket connections)
        const existingUser = connectedUsers.find(user => user.userId === socket.userId);
        if (!existingUser) {
          connectedUsers.push({
            userId: socket.userId,
            username: socket.username,
            socketId: socketId
          });
        }
      }
    }
    
    return connectedUsers;
  } catch (error) {
    logger.error('Erreur lors de la récupération des utilisateurs connectés', error);
    return [];
  }
};

// Sync sessionConnections with actual Socket.IO room state
const syncSessionConnections = async (io, sessionId) => {
  const actualUsers = await getConnectedUsersInSession(io, sessionId);
  const actualUserIds = actualUsers.map(u => u.userId);
  
  // Update sessionConnections to match reality
  if (actualUserIds.length > 0) {
    sessionConnections.set(sessionId, new Set(actualUserIds));
  } else {
    sessionConnections.delete(sessionId);
  }
  
  return actualUserIds;
};

const handleConnection = (io) => {
  io.use(socketAuth);

  io.on('connection', (socket) => {
    // 🔐 SÉCURITÉ: Synchroniser avec le gestionnaire de connexions
    connectionManager.updateSocketId(socket.username, socket.id);
    connectionManager.updateActivity(socket.username);

    // Join user to their personal room
    socket.join(`user-${socket.userId}`);

    // Log de connexion WebSocket (propre)
    logger.info(`WebSocket connecté pour "${socket.username}".`);

    // Handle joining a session room
    // Handler for regular session join
  socket.on('joinSession', async (sessionId) => {
      try {
        const session = await Session.findById(sessionId);
        if (!session) {
          socket.emit('error', { message: 'Session non trouvée' });
          return;
        }

        // Check if user can access this session
        const isCreator = session.createdBy.toString() === socket.userId;
        const isParticipant = session.participants.some(p => p.toString() === socket.userId);
        
        if (!session.isPublic && !isCreator && !isParticipant) {
          socket.emit('error', { message: 'Accès refusé à cette session' });
          return;
        }

        // Leave any previous session rooms to avoid conflicts
        if (socket.currentSessionId && socket.currentSessionId !== sessionId) {
          socket.leave(`session-${socket.currentSessionId}`);
          removeUserFromSession(socket.currentSessionId, socket.userId);
        }

        // Join the session room and wait for completion
        await new Promise((resolve) => {
          socket.join(`session-${sessionId}`, () => {
            resolve();
          });
        });
        
        socket.currentSessionId = sessionId;

        // Add user to session tracking AFTER joining room
        addUserToSession(sessionId, socket.userId);

        // Small delay to ensure socket is fully in the room
        await new Promise(resolve => setTimeout(resolve, 100));

        // Get comprehensive user info including usernames
        const connectedUsersInfo = await getConnectedUsersInSession(io, sessionId);
        const userIds = connectedUsersInfo.map(user => user.userId);
        
        // Update sessionConnections with actual state
        if (userIds.length > 0) {
          sessionConnections.set(sessionId, new Set(userIds));
        }


        // Step 1: Send current state to the joining user first
        socket.emit('sessionUsers', {
          sessionId,
          onlineUsers: userIds,
          connectedUsers: connectedUsersInfo
        });

        // Step 2: Broadcast to ALL users in session (including the joiner) the updated participant list
        io.to(`session-${sessionId}`).emit('participantsUpdated', {
          sessionId,
          onlineUsers: userIds,
          participantCount: userIds.length,
          connectedUsers: connectedUsersInfo  // Include full user info
        });

        // Step 3: Notify other participants about the specific new connection
        socket.to(`session-${sessionId}`).emit('userConnected', {
          userId: socket.userId,
          username: socket.username,
          sessionId
        });

        // Step 4: Global participant count update
        io.emit('sessionParticipantUpdate', {
          sessionId,
          participantCount: userIds.length
        });

        // Confirm to the joining user
        socket.emit('joinedSession', { 
          sessionId,
          userCount: userIds.length,
          users: connectedUsersInfo
        });
      } catch (error) {
        logger.error('Erreur lors de la jointure de session', error);
        socket.emit('error', { message: 'Erreur lors de la jointure de session' });
              }
    });

    // Handler for session rejoin (after page refresh)
    socket.on('rejoinSession', async (data) => {
        try {
            
            const { sessionId, userId, username, reconnect } = data;
            
            // Validation des données reçues
            if (!sessionId || !userId || !username) {
                socket.emit('error', { message: 'Données de session manquantes' });
                return;
            }
            
            
            // Verify session still exists
            const session = await Session.findById(sessionId);
            if (!session) {
                socket.emit('sessionNotFound', { sessionId });
                return;
            }
            

            
            // Verify user is still part of the session
            const isParticipant = session.participants.some(p => p.toString() === userId);
            const isAdmin = session.admin && session.admin.toString() === userId;
            
            if (!isParticipant && !isAdmin) {
                socket.emit('sessionNotAuthorized', { sessionId });
                return;
            }
            
            // Store user info in socket
            socket.userId = userId;
            socket.username = username;
            socket.sessionId = sessionId;
            
            // Add user to session connections
            if (!sessionConnections.has(sessionId)) {
                sessionConnections.set(sessionId, new Map());
            }
            sessionConnections.get(sessionId).set(userId, {
                socketId: socket.id,
                username: username,
                joinedAt: new Date()
            });
            
            // Add socket to room
            await new Promise((resolve) => {
                socket.join(`session-${sessionId}`, resolve);
            });
            
            // Small delay to ensure socket is in room
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Get current connected users
            const connectedUsersInfo = await getConnectedUsersInSession(sessionId);
            const userIds = connectedUsersInfo.map(u => u.userId);
            

            
            // Step 1: Send current state to the rejoining user
            socket.emit('sessionUsers', {
                sessionId,
                onlineUsers: userIds,
                connectedUsers: connectedUsersInfo
            });
            
            // Step 2: Emit participantsUpdated to ALL users in the room
            io.to(`session-${sessionId}`).emit('participantsUpdated', {
                sessionId,
                connectedUsers: connectedUsersInfo,
                onlineUsers: userIds
            });
            
            // Step 3: Notify other users of reconnection
            socket.to(`session-${sessionId}`).emit('userConnected', {
                sessionId,
                userId: userId,
                username: username,
                reconnect: true
            });
            
            // Step 4: Confirm to rejoining user
            socket.emit('rejoinedSession', {
                sessionId,
                userCount: userIds.length,
                users: userIds,
                isAdmin: isAdmin,
                connectedUsers: connectedUsersInfo
            });
            
        } catch (error) {
            logger.error('Erreur dans rejoinSession', error, { 
                data: data,
                socketId: socket.id 
            });
            
            // Envoyer une erreur plus spécifique selon le type
            if (error.name === 'CastError') {
                socket.emit('error', { message: 'ID de session invalide' });
            } else if (error.name === 'ValidationError') {
                socket.emit('error', { message: 'Données de session invalides' });
            } else {
                socket.emit('error', { message: `Erreur de reconnexion: ${error.message}` });
            }
        }
    });

    // Handle leaving a session room
    socket.on('leaveSession', async (sessionId) => {
      
      socket.leave(`session-${sessionId}`);
      
      // Remove user from session tracking
      removeUserFromSession(sessionId, socket.userId);
      
      // Clean up user from session participants in DB
      await cleanupUserFromSession(sessionId, socket.userId);
      
      // Sync with actual remaining users
      const remainingUserIds = await syncSessionConnections(io, sessionId);

      // Broadcast updated participant list to remaining users
      io.to(`session-${sessionId}`).emit('participantsUpdated', {
        sessionId,
        onlineUsers: remainingUserIds,
        participantCount: remainingUserIds.length
      });
      
      // Notify other participants that user left
      socket.to(`session-${sessionId}`).emit('userDisconnected', {
        userId: socket.userId,
        username: socket.username,
        sessionId
      });

      // Broadcast updated participant count to all users
      const userCount = getSessionUserCount(sessionId);
      io.emit('sessionParticipantUpdate', {
        sessionId,
        participantCount: userCount
      });

      if (socket.currentSessionId === sessionId) {
        socket.currentSessionId = null;
      }

      
      // Confirmer la sortie au client
      socket.emit('leftSession', { sessionId, success: true });
    });

    // Handle real-time voting updates
    socket.on('voteUpdate', (data) => {
      // Broadcast vote update to session participants (excluding sender)
      socket.to(`session-${data.sessionId}`).emit('voteSubmitted', {
        userId: socket.userId,
        username: socket.username,
        sessionId: data.sessionId,
        hasVoted: true
      });
    });

    // Handle admin actions
    socket.on('adminAction', async (data) => {
      try {
        const { sessionId, action, payload } = data;
        const session = await Session.findById(sessionId);

        if (!session) {
          socket.emit('error', { message: 'Session non trouvée' });
          return;
        }

        // Check if user is admin of this session
        if (session.createdBy.toString() !== socket.userId) {
          socket.emit('error', { message: 'Action non autorisée' });
          return;
        }

        // Broadcast admin action to all session participants
        io.to(`session-${sessionId}`).emit('adminActionExecuted', {
          action,
          payload,
          sessionId,
          adminUsername: socket.username
        });

      } catch (error) {
        logger.error('Erreur lors de l\'action admin', error);
        socket.emit('error', { message: 'Erreur lors de l\'action admin' });
      }
    });

    // Handle typing indicators (for chat if implemented)
    socket.on('typing', (data) => {
      socket.to(`session-${data.sessionId}`).emit('userTyping', {
        userId: socket.userId,
        username: socket.username,
        sessionId: data.sessionId
      });
    });

    socket.on('stopTyping', (data) => {
      socket.to(`session-${data.sessionId}`).emit('userStoppedTyping', {
        userId: socket.userId,
        username: socket.username,
        sessionId: data.sessionId
      });
    });

    // Handle presence sync requests
    socket.on('requestPresenceSync', async (sessionId) => {
      try {
        
        // Get real-time connected users
        const connectedUsersInfo = await getConnectedUsersInSession(io, sessionId);
        const userIds = connectedUsersInfo.map(user => user.userId);
        
        // Update sessionConnections with current reality
        if (userIds.length > 0) {
          sessionConnections.set(sessionId, new Set(userIds));
        } else {
          sessionConnections.delete(sessionId);
        }
        
        // Send updated list to requester first
        socket.emit('sessionUsers', {
          sessionId,
          onlineUsers: userIds,
          connectedUsers: connectedUsersInfo
        });

        // Broadcast comprehensive update to all users in session
        io.to(`session-${sessionId}`).emit('participantsUpdated', {
          sessionId,
          onlineUsers: userIds,
          participantCount: userIds.length,
          connectedUsers: connectedUsersInfo,
          syncType: 'presenceSync'
        });

      } catch (error) {
        logger.error('Erreur lors de la synchronisation de présence', error);
      }
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      // 🔐 SÉCURITÉ: Supprimer du gestionnaire de connexions
      connectionManager.removeConnectionBySocketId(socket.id);
      
      // Log de déconnexion WebSocket (propre)
      logger.info(`WebSocket déconnecté pour "${socket.username}".`);
      
      // Notify session participants if user was in a session
      if (socket.currentSessionId) {
        // Remove user from session tracking
        removeUserFromSession(socket.currentSessionId, socket.userId);
        
        // Clean up user from session participants in DB
        await cleanupUserFromSession(socket.currentSessionId, socket.userId);
        
        // Sync with actual remaining users
        const remainingUserIds = await syncSessionConnections(io, socket.currentSessionId);

        // Broadcast updated participant list to remaining users
        io.to(`session-${socket.currentSessionId}`).emit('participantsUpdated', {
          sessionId: socket.currentSessionId,
          onlineUsers: remainingUserIds,
          participantCount: remainingUserIds.length
        });
        
        socket.to(`session-${socket.currentSessionId}`).emit('userDisconnected', {
          userId: socket.userId,
          username: socket.username,
          sessionId: socket.currentSessionId
        });

        // Broadcast updated participant count to all users
        const userCount = getSessionUserCount(socket.currentSessionId);
        io.emit('sessionParticipantUpdate', {
          sessionId: socket.currentSessionId,
          participantCount: userCount
        });
      }
    });

    // Send welcome message
    socket.emit('connected', {
      message: 'Connexion WebSocket établie',
      userId: socket.userId,
      username: socket.username
    });

    // Send current session participant counts
    socket.emit('sessionParticipantCounts', getAllSessionCounts());
  });
};

module.exports = {
  handleConnection,
  socketAuth,
  getSessionUserCount,
  getAllSessionCounts,
  getConnectedUsersInSession,
  syncSessionConnections
}; 