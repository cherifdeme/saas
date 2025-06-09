import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { sessionService } from '../services/api';
import { toast } from 'react-hot-toast';
import { 
  Plus, 
  Users, 
  Calendar, 
  LogOut, 
  Trash2, 
  ExternalLink,
  Wifi,
  WifiOff
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

function DashboardPage() {
  const { user, logout } = useAuth();
  const { connected, on, off } = useSocket();
  const navigate = useNavigate();
  
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [sessionParticipantCounts, setSessionParticipantCounts] = useState({});

  useEffect(() => {
    loadSessions();
    
    // Listen for real-time session updates
    on('sessionCreated', handleSessionCreated);
    on('sessionDeleted', handleSessionDeleted);
    on('sessionParticipantUpdate', handleSessionParticipantUpdate);
    on('sessionParticipantCounts', handleSessionParticipantCounts);
    
    return () => {
      off('sessionCreated', handleSessionCreated);
      off('sessionDeleted', handleSessionDeleted);
      off('sessionParticipantUpdate', handleSessionParticipantUpdate);
      off('sessionParticipantCounts', handleSessionParticipantCounts);
    };
  }, [on, off]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const response = await sessionService.getSessions();
      setSessions(response.data);
    } catch (error) {
      toast.error('Erreur lors du chargement des sessions');
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSessionCreated = (newSession) => {
    setSessions(prev => [newSession, ...prev]);
    toast.success(`Nouvelle session créée: ${newSession.name}`);
  };

  const handleSessionDeleted = (data) => {
    setSessions(prev => prev.filter(session => session._id !== data.sessionId));
    setSessionParticipantCounts(prev => {
      const updated = { ...prev };
      delete updated[data.sessionId];
      return updated;
    });
    toast.success('Session supprimée');
  };

  const handleSessionParticipantUpdate = (data) => {
    setSessionParticipantCounts(prev => ({
      ...prev,
      [data.sessionId]: data.participantCount
    }));
  };

  const handleSessionParticipantCounts = (counts) => {
    setSessionParticipantCounts(counts);
  };

  const createSession = async (e) => {
    e.preventDefault();
    if (!newSessionName.trim()) return;

    try {
      setIsCreating(true);
      const response = await sessionService.createSession({ name: newSessionName });
      setNewSessionName('');
      setShowCreateModal(false);
      toast.success('Session créée avec succès !');
      
      // Navigate to the new session
      navigate(`/session/${response.data._id}`);
    } catch (error) {
      toast.error('Erreur lors de la création de la session');
      console.error('Error creating session:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const joinSession = async (sessionId) => {
    try {
      await sessionService.joinSession(sessionId);
      navigate(`/session/${sessionId}`);
    } catch (error) {
      toast.error('Erreur lors de la participation à la session');
      console.error('Error joining session:', error);
    }
  };

  const deleteSession = async (sessionId, sessionName) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer la session "${sessionName}" ?`)) {
      return;
    }

    try {
      await sessionService.deleteSession(sessionId);
      toast.success('Session supprimée avec succès');
    } catch (error) {
      toast.error('Erreur lors de la suppression de la session');
      console.error('Error deleting session:', error);
    }
  };

  const handleLogout = async () => {
    await logout();
    toast.success('Déconnexion réussie');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const userSessions = sessions.filter(session => session.createdBy._id === user?.id);
  const publicSessions = sessions.filter(session => 
    session.createdBy._id !== user?.id && session.isPublic
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-primary-600 rounded-lg flex items-center justify-center mr-3">
                <Users className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900">Planning Poker</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Connection status */}
              <div className="flex items-center space-x-2">
                {connected ? (
                  <Wifi className="h-5 w-5 text-green-500" />
                ) : (
                  <WifiOff className="h-5 w-5 text-red-500" />
                )}
                <span className={`text-sm ${connected ? 'text-green-600' : 'text-red-600'}`}>
                  {connected ? 'Connecté' : 'Déconnecté'}
                </span>
              </div>
              
              {/* User info */}
              <div className="flex items-center space-x-3">
                <div className="user-avatar">
                  {user?.username?.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-gray-700">{user?.username}</span>
                <button
                  onClick={handleLogout}
                  className="btn-secondary flex items-center"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Déconnexion
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Tableau de bord</h2>
          <p className="text-gray-600">Gérez vos sessions d'estimation Planning Poker</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* My Sessions */}
          <div className="card">
            <div className="card-header flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Mes sessions</h3>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary flex items-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                Créer une session
              </button>
            </div>
            <div className="card-body">
              {userSessions.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">Aucune session créée</p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="btn-primary"
                  >
                    Créer votre première session
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {userSessions.map((session) => (
                    <div
                      key={session._id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{session.name}</h4>
                        <p className="text-sm text-gray-500">
                          Créée le {formatDate(session.createdAt)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {sessionParticipantCounts[session._id] || 0} participant(s) connecté(s)
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => navigate(`/session/${session._id}`)}
                          className="btn-primary flex items-center"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Ouvrir
                        </button>
                        <button
                          onClick={() => deleteSession(session._id, session.name)}
                          className="btn-danger flex items-center"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Public Sessions */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Sessions publiques</h3>
            </div>
            <div className="card-body">
              {publicSessions.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Aucune session publique disponible</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {publicSessions.map((session) => (
                    <div
                      key={session._id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{session.name}</h4>
                        <p className="text-sm text-gray-500">
                          Par {session.createdBy.username}
                        </p>
                        <p className="text-sm text-gray-500">
                          {sessionParticipantCounts[session._id] || 0} participant(s) connecté(s)
                        </p>
                      </div>
                      <button
                        onClick={() => joinSession(session._id)}
                        className="btn-primary flex items-center"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Rejoindre
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Create Session Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="card max-w-md w-full">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Créer une nouvelle session</h3>
            </div>
            <div className="card-body">
              <form onSubmit={createSession}>
                <div className="mb-4">
                  <label htmlFor="sessionName" className="block text-sm font-medium text-gray-700 mb-2">
                    Nom de la session
                  </label>
                  <input
                    id="sessionName"
                    type="text"
                    className="input"
                    placeholder="Ex: Sprint Planning - Équipe Alpha"
                    value={newSessionName}
                    onChange={(e) => setNewSessionName(e.target.value)}
                    required
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="btn-secondary"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="btn-primary flex items-center"
                  >
                    {isCreating ? (
                      <LoadingSpinner size="small" />
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Créer
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardPage; 