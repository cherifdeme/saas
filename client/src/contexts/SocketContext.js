import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
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
    const serverUrl = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';
    
    socketRef.current = io(serverUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    socketRef.current.on('connect', () => {
      console.log('Connecté au serveur WebSocket');
      setConnected(true);
      setSocket(socketRef.current);
    });

    socketRef.current.on('disconnect', () => {
      console.log('Déconnecté du serveur WebSocket');
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
      console.log('WebSocket authentifié:', data);
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

  const joinSession = (sessionId) => {
    if (socketRef.current) {
      socketRef.current.emit('joinSession', sessionId);
    }
  };

  const leaveSession = (sessionId) => {
    if (socketRef.current) {
      socketRef.current.emit('leaveSession', sessionId);
    }
  };

  const emitVoteUpdate = (data) => {
    if (socketRef.current) {
      socketRef.current.emit('voteUpdate', data);
    }
  };

  const emitAdminAction = (data) => {
    if (socketRef.current) {
      socketRef.current.emit('adminAction', data);
    }
  };

  const on = (event, callback) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
  };

  const off = (event, callback) => {
    if (socketRef.current) {
      socketRef.current.off(event, callback);
    }
  };

  const value = {
    socket,
    connected,
    onlineUsers,
    joinSession,
    leaveSession,
    emitVoteUpdate,
    emitAdminAction,
    on,
    off
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