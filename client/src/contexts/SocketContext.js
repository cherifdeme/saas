import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { toast } from 'react-hot-toast';

const SocketContext = createContext();

export function SocketProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const socketRef = useRef(null);

  useEffect(() => {
    if (isAuthenticated && !socketRef.current) {
      connectSocket();
    } else if (!isAuthenticated && socketRef.current) {
      disconnectSocket();
    }

    return () => {
      if (socketRef.current) {
        disconnectSocket();
      }
    };
  }, [isAuthenticated]);

  const connectSocket = () => {
    // For production, use the current domain; for development, use the configured URL
    let serverUrl = process.env.REACT_APP_SERVER_URL;
    
    if (!serverUrl) {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        serverUrl = 'http://localhost:5000';
      } else {
        // In production, use the same origin as the web app
        serverUrl = `${window.location.protocol}//${window.location.host}`;
      }
    }
    
    socketRef.current = io(serverUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    socketRef.current.on('connect', () => {
      setConnected(true);
      setSocket(socketRef.current);
      
      // Auto-rejoin session if there's one in sessionStorage
      const currentSessionId = sessionStorage.getItem('currentSessionId');
      const currentUserId = sessionStorage.getItem('currentUserId');
      const currentUsername = sessionStorage.getItem('currentUsername');
      
      if (currentSessionId && currentUserId && currentUsername) {       
        // Validation supplémentaire des données
        if (currentSessionId.length < 10 || currentUserId.length < 10) {
          sessionStorage.removeItem('currentSessionId');
          sessionStorage.removeItem('currentUserId');
          sessionStorage.removeItem('currentUsername');
          return;
        }
        
        setTimeout(() => {
          if (socketRef.current) {
            
            // Émettre leaveSession pour nettoyer côté serveur
            socketRef.current.emit('leaveSession', currentSessionId);
            
            // Nettoyer le sessionStorage
            sessionStorage.removeItem('currentSessionId');
            sessionStorage.removeItem('currentUserId');
            sessionStorage.removeItem('currentUsername');
            
            // Rediriger vers dashboard après un court délai
            setTimeout(() => {
              window.location.href = '/dashboard';
            }, 100);
          }
        }, 200); // Delay to ensure socket is ready
      } else {

      }
    });

    socketRef.current.on('disconnect', () => {
      setConnected(false);
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('Erreur de connexion WebSocket:', error);
      toast.error('Erreur de connexion temps réel');
    });

    socketRef.current.on('error', (error) => {
      console.error('Erreur WebSocket:', error);
      toast.error(error.message || 'Erreur WebSocket');
    });

    // Global event handlers
    socketRef.current.on('connected', (data) => {
    });

    socketRef.current.on('leftSession', (data) => {
      if (data.success) {
        console.log('✅ Sortie de session confirmée:', data.sessionId);
      } else {
        console.error('❌ Erreur lors de la sortie:', data.error);
      }
    });

    socketRef.current.on('userConnected', (data) => {
      setOnlineUsers(prev => new Set([...prev, data.userId]));
    });

    socketRef.current.on('userDisconnected', (data) => {
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.userId);
        return newSet;
      });
    });
  };

  const disconnectSocket = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
      setOnlineUsers(new Set());
    }
  };

  const joinSession = useCallback((sessionId, userInfo = {}) => {
    if (socketRef.current) {
      // Save session info for auto-rejoin on reconnect
      sessionStorage.setItem('currentSessionId', sessionId);
      if (userInfo.userId) sessionStorage.setItem('currentUserId', userInfo.userId);
      if (userInfo.username) sessionStorage.setItem('currentUsername', userInfo.username);
      
      socketRef.current.emit('joinSession', sessionId);
      console.log('🚀 Joining session:', sessionId, userInfo);
    }
  }, []);

  const leaveSession = useCallback((sessionId) => {
    if (socketRef.current) {
      // Clear all saved session data
      sessionStorage.removeItem('currentSessionId');
      sessionStorage.removeItem('currentUserId');
      sessionStorage.removeItem('currentUsername');
      socketRef.current.emit('leaveSession', sessionId);
      console.log('👋 Leaving session:', sessionId);
    }
  }, []);

  const emitVoteUpdate = useCallback((data) => {
    if (socketRef.current) {
      socketRef.current.emit('voteUpdate', data);
    }
  }, []);

  const emitAdminAction = useCallback((data) => {
    if (socketRef.current) {
      socketRef.current.emit('adminAction', data);
    }
  }, []);

  const on = useCallback((event, callback) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
  }, []);

  const off = useCallback((event, callback) => {
    if (socketRef.current) {
      socketRef.current.off(event, callback);
    }
  }, []);

  const requestPresenceSync = useCallback((sessionId) => {
    if (socketRef.current) {
      socketRef.current.emit('requestPresenceSync', sessionId);
    }
  }, []);

  const value = {
    socket,
    connected,
    onlineUsers,
    joinSession,
    leaveSession,
    emitVoteUpdate,
    emitAdminAction,
    on,
    off,
    requestPresenceSync
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket doit être utilisé dans un SocketProvider');
  }
  return context;
} 