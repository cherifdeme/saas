const Session = require('../models/Session');
const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');

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

        // Notify other participants that user joined
        socket.to(`session-${sessionId}`).emit('userConnected', {
          userId: socket.userId,
          username: socket.username,
          sessionId
        });

        socket.emit('joinedSession', { sessionId });
        console.log(`${socket.username} a rejoint la session ${sessionId}`);
      } catch (error) {
        console.error('Erreur lors de la jointure de session:', error);
        socket.emit('error', { message: 'Erreur lors de la jointure de session' });
      }
    });

    // Handle leaving a session room
    socket.on('leaveSession', (sessionId) => {
      socket.leave(`session-${sessionId}`);
      
      // Notify other participants that user left
      socket.to(`session-${sessionId}`).emit('userDisconnected', {
        userId: socket.userId,
        username: socket.username,
        sessionId
      });

      if (socket.currentSessionId === sessionId) {
        socket.currentSessionId = null;
      }

      console.log(`${socket.username} a quitté la session ${sessionId}`);
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
    socket.on('disconnect', () => {
      console.log(`Utilisateur déconnecté: ${socket.username} (${socket.userId})`);
      
      // Notify session participants if user was in a session
      if (socket.currentSessionId) {
        socket.to(`session-${socket.currentSessionId}`).emit('userDisconnected', {
          userId: socket.userId,
          username: socket.username,
          sessionId: socket.currentSessionId
        });
      }
    });

    // Send welcome message
    socket.emit('connected', {
      message: 'Connexion WebSocket établie',
      userId: socket.userId,
      username: socket.username
    });
  });
};

module.exports = {
  handleConnection,
  socketAuth
}; 