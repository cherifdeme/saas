const Session = require('../models/Session');
const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');

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
      console.log(`Cleaned up user ${userId} from session ${sessionId} participants list`);
    }
  } catch (error) {
    console.error('Error cleaning up user from session:', error);
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

const handleConnection = (io) => {
  io.use(socketAuth);

  io.on('connection', (socket) => {
    console.log(`Utilisateur connecté: ${socket.username} (${socket.userId})`);

    // Join user to their personal room
    socket.join(`user-${socket.userId}`);

    // Handle joining a session room
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

        socket.join(`session-${sessionId}`);
        socket.currentSessionId = sessionId;

        // Add user to session tracking
        addUserToSession(sessionId, socket.userId);

        // Notify ALL participants (including the user who joined) about the connection
        io.to(`session-${sessionId}`).emit('userConnected', {
          userId: socket.userId,
          username: socket.username,
          sessionId
        });

        // Send current online users to the user who just joined
        const currentUsers = sessionConnections.get(sessionId) || new Set();
        socket.emit('sessionUsers', {
          sessionId,
          onlineUsers: Array.from(currentUsers)
        });

        // Broadcast updated participant count to all users
        const userCount = getSessionUserCount(sessionId);
        io.emit('sessionParticipantUpdate', {
          sessionId,
          participantCount: userCount
        });

        socket.emit('joinedSession', { sessionId });
        console.log(`${socket.username} a rejoint la session ${sessionId} (${userCount} utilisateurs connectés)`);
      } catch (error) {
        console.error('Erreur lors de la jointure de session:', error);
        socket.emit('error', { message: 'Erreur lors de la jointure de session' });
      }
    });

    // Handle leaving a session room
    socket.on('leaveSession', async (sessionId) => {
      socket.leave(`session-${sessionId}`);
      
      // Remove user from session tracking
      removeUserFromSession(sessionId, socket.userId);
      
      // Clean up user from session participants in DB
      await cleanupUserFromSession(sessionId, socket.userId);
      
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

      console.log(`${socket.username} a quitté la session ${sessionId} (${userCount} utilisateurs connectés)`);
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

        console.log(`Action admin ${action} exécutée par ${socket.username} dans la session ${sessionId}`);
      } catch (error) {
        console.error('Erreur lors de l\'action admin:', error);
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

    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log(`Utilisateur déconnecté: ${socket.username} (${socket.userId})`);
      
      // Notify session participants if user was in a session
      if (socket.currentSessionId) {
        // Remove user from session tracking
        removeUserFromSession(socket.currentSessionId, socket.userId);
        
        // Clean up user from session participants in DB
        await cleanupUserFromSession(socket.currentSessionId, socket.userId);
        
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

        console.log(`${socket.username} déconnecté de la session ${socket.currentSessionId} (${userCount} utilisateurs restants)`);
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
  getAllSessionCounts
}; 