import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { sessionService, voteService } from '../services/api';
import { toast } from 'react-hot-toast';
import { 
  ArrowLeft, 
  Eye, 
  RotateCcw, 
  Users, 
  Crown,
  CheckCircle,
  Clock,
  BarChart3,
  ExternalLink
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

const POKER_CARDS = ['1', '2', '3', '5', '8', '13', '21', '40', '∞', '?'];

function SessionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { joinSession, leaveSession, on, off, requestPresenceSync } = useSocket();
  
  const [session, setSession] = useState(null);
  const [votes, setVotes] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [votesRevealed, setVotesRevealed] = useState(false);
  const [stats, setStats] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  // Load session data only once on mount
  useEffect(() => {
    loadSession();
  }, [id]); // Only depend on id

  // Setup socket listeners and join session
  useEffect(() => {
    // Join the session room
    joinSession(id);
    
    // Request presence sync after a short delay to ensure connection is established
    const syncTimer = setTimeout(() => {
      console.log('🔄 Requesting initial presence sync...');
      requestPresenceSync(id);
    }, 500);  // Reduced from 1000ms to 500ms for faster response
    
    // Listen for real-time updates
    on('voteSubmitted', handleVoteSubmitted);
    on('votesRevealed', handleVotesRevealed);
    on('votesReset', handleVotesReset);
    on('userJoined', handleUserJoined);
    on('userLeft', handleUserLeft);
    on('userConnected', handleUserConnected);
    on('userDisconnected', handleUserDisconnected);
    on('sessionUsers', handleSessionUsers);
    on('participantsUpdated', handleParticipantsUpdated);
    on('joinedSession', handleJoinedSession);
    on('ticketUpdated', handleTicketUpdated);
    
    return () => {
      clearTimeout(syncTimer);
      leaveSession(id);
      off('voteSubmitted', handleVoteSubmitted);
      off('votesRevealed', handleVotesRevealed);
      off('votesReset', handleVotesReset);
      off('userJoined', handleUserJoined);
      off('userLeft', handleUserLeft);
      off('userConnected', handleUserConnected);
      off('userDisconnected', handleUserDisconnected);
      off('sessionUsers', handleSessionUsers);
      off('participantsUpdated', handleParticipantsUpdated);
      off('joinedSession', handleJoinedSession);
      off('ticketUpdated', handleTicketUpdated);
    };
  }, [id, joinSession, leaveSession, on, off, requestPresenceSync]); // Keep socket dependencies

  const loadSession = async () => {
    try {
      setLoading(true);
      const [sessionResponse, votesResponse] = await Promise.all([
        sessionService.getSession(id),
        voteService.getVotes(id)
      ]);
      
      setSession(sessionResponse.data);
      setVotes(votesResponse.data.votes || []);
      setVotesRevealed(votesResponse.data.revealed || false);
      
      // Find user's current vote
      const userVote = votesResponse.data.votes?.find(vote => 
        vote.userId === user?.id || vote.userId?._id === user?.id
      );
      if (userVote && userVote.value) {
        setSelectedCard(userVote.value);
      }

      // Initialize current user as online since they're loading the session
      if (user?.id) {
        setOnlineUsers(prev => new Set([...prev, user.id]));
      }
    } catch (error) {
      toast.error('Erreur lors du chargement de la session');
      console.error('Error loading session:', error);
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleVoteSubmitted = useCallback((data) => {
    if (data.sessionId === id) {
      setVotes(prev => {
        const existingIndex = prev.findIndex(vote => 
          (vote.userId === data.userId || vote.userId?._id === data.userId)
        );
        
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = { ...updated[existingIndex], hasVoted: true };
          return updated;
        } else {
          return [...prev, { userId: data.userId, username: data.username, hasVoted: true }];
        }
      });
    }
  }, [id]);

  const handleVotesRevealed = useCallback((data) => {
    if (data.sessionId === id) {
      setVotes(data.votes);
      setVotesRevealed(true);
      setStats(data.stats);
      toast.success('Votes révélés !');
    }
  }, [id]);

  const handleVotesReset = useCallback((data) => {
    if (data.sessionId === id) {
      setVotes([]);
      setVotesRevealed(false);
      setSelectedCard(null);
      setStats(null);
      toast.success('Votes réinitialisés !');
    }
  }, [id]);

  const handleUserJoined = useCallback((data) => {
    if (data.sessionId === id) {
      toast.success(`${data.user.username} a rejoint la session`);
    }
  }, [id]);

  const handleUserLeft = useCallback((data) => {
    if (data.sessionId === id) {
      toast.info(`${data.user.username} a quitté la session`);
      // Refresh session data to update participant list
      loadSession();
    }
  }, [id]);

  const handleUserConnected = useCallback((data) => {
    if (data.sessionId === id) {
      setOnlineUsers(prev => {
        const newSet = new Set([...prev, data.userId]);
        console.log('User connected:', data.userId, 'Online users:', Array.from(newSet));
        return newSet;
      });
    }
  }, [id]);

  const handleSessionUsers = useCallback((data) => {
    if (data.sessionId === id) {
      const newOnlineUsers = new Set(data.onlineUsers);
      // Always ensure current user is marked as online if they're in the session
      if (user?.id) {
        newOnlineUsers.add(user.id);
      }
      setOnlineUsers(newOnlineUsers);
      console.log('🔄 Updated online users from sessionUsers:', Array.from(newOnlineUsers));
      
      // Also update session.connectedUsers to ensure getActiveParticipants has the right data
      if (data.connectedUsers && Array.isArray(data.connectedUsers)) {
        setSession(prev => prev ? {
          ...prev,
          connectedUsers: data.connectedUsers
        } : null);
        console.log('🔄 Updated session.connectedUsers from sessionUsers:', data.connectedUsers);
      }
    }
  }, [id, user?.id]);

  const handleUserDisconnected = useCallback((data) => {
    if (data.sessionId === id) {
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.userId);
        return newSet;
      });
    }
  }, [id]);

  const handleTicketUpdated = useCallback((data) => {
    if (data.sessionId === id) {
      setSession(prev => ({ ...prev, currentTicket: data.ticket }));
      toast.success('Ticket mis à jour');
    }
  }, [id]);

  const handleParticipantsUpdated = useCallback((data) => {
    if (data.sessionId === id) {
      // Replace entire online users list with the authoritative server list
      const newOnlineUsers = new Set(data.onlineUsers);
      
      // Always ensure current user is included if they're in the session
      if (user?.id) {
        newOnlineUsers.add(user.id);
      }
      
      setOnlineUsers(newOnlineUsers);
      
      console.log('🔄 Participants updated from server:', {
        sessionId: data.sessionId,
        onlineUsers: data.onlineUsers,
        participantCount: data.participantCount,
        connectedUsers: data.connectedUsers,
        newOnlineUsersSet: Array.from(newOnlineUsers)
      });
      
      // Update session data if we have connected users info
      if (data.connectedUsers && data.connectedUsers.length > 0) {
        setSession(prev => prev ? {
          ...prev,
          connectedUsers: data.connectedUsers
        } : null);
      }
    }
  }, [id, user?.id]);

  const handleJoinedSession = useCallback((data) => {
    if (data.sessionId === id) {
      console.log('✅ Successfully joined session:', {
        sessionId: data.sessionId,
        userCount: data.userCount,
        users: data.users
      });
      
      // Ensure current user is marked as online
      if (user?.id) {
        setOnlineUsers(prev => new Set([...prev, user.id]));
      }
      
      // Force a presence sync to ensure we have the latest state
      setTimeout(() => {
        requestPresenceSync(id);
      }, 500);
    }
  }, [id, user?.id, requestPresenceSync]);

  // Create dynamic participants list combining session data with real-time online status
  const getActiveParticipants = useCallback(() => {
    if (!session?.participants) return [];
    
    // Get base participants from session
    const baseParticipants = session.participants || [];
    
    // Get additional online users who might not be in session.participants yet
    const connectedUsersInfo = session.connectedUsers || [];
    
    // Create a map of existing participants
    const participantsMap = new Map();
    
    // Add session participants first
    baseParticipants.forEach(participant => {
      participantsMap.set(participant._id, {
        ...participant,
        isOnline: onlineUsers.has(participant._id),
        source: 'session'
      });
    });
    
    // Add/update with real-time connected users
    connectedUsersInfo.forEach(connectedUser => {
      if (participantsMap.has(connectedUser.userId)) {
        // Update existing participant - mark as online based on being in connectedUsersInfo
        const existing = participantsMap.get(connectedUser.userId);
        participantsMap.set(connectedUser.userId, {
          ...existing,
          isOnline: true, // Force online if in connectedUsersInfo
          source: 'both'
        });
      } else {
        // Add new connected user (might not be in session.participants yet)
        participantsMap.set(connectedUser.userId, {
          _id: connectedUser.userId,
          username: connectedUser.username,
          isOnline: true, // Force online if in connectedUsersInfo
          source: 'realtime'
        });
      }
    });
    
    // Ensure current user is included if online
    if (user?.id && onlineUsers.has(user.id) && !participantsMap.has(user.id)) {
      participantsMap.set(user.id, {
        _id: user.id,
        username: user.username,
        isOnline: true,
        source: 'current'
      });
    }
    
    const result = Array.from(participantsMap.values());
    console.log('🔄 Active participants calculated:', {
      sessionParticipants: baseParticipants.length,
      connectedUsers: connectedUsersInfo.length,
      onlineUsers: Array.from(onlineUsers),
      finalList: result.map(p => ({ username: p.username, isOnline: p.isOnline, source: p.source }))
    });
    
    return result;
  }, [session?.participants, session?.connectedUsers, onlineUsers, user]);

  const activeParticipants = getActiveParticipants();

  const submitVote = async (cardValue) => {
    if (votesRevealed) {
      toast.error('Les votes ont déjà été révélés pour ce tour');
      return;
    }

    try {
      await voteService.submitVote(id, { value: cardValue });
      setSelectedCard(cardValue);
      toast.success('Vote enregistré !');
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement du vote');
      console.error('Error submitting vote:', error);
    }
  };

  const revealVotes = async () => {
    try {
      await voteService.revealVotes(id);
    } catch (error) {
      toast.error('Erreur lors de la révélation des votes');
      console.error('Error revealing votes:', error);
    }
  };

  const resetVotes = async () => {
    try {
      await voteService.resetVotes(id);
    } catch (error) {
      toast.error('Erreur lors de la réinitialisation des votes');
      console.error('Error resetting votes:', error);
    }
  };

  const leaveSessionHandler = async () => {
    if (!window.confirm('Êtes-vous sûr de vouloir quitter cette session ?')) {
      return;
    }

    try {
      await sessionService.leaveSession(id);
      toast.success('Vous avez quitté la session');
      navigate('/dashboard');
    } catch (error) {
      toast.error('Erreur lors de la sortie de session');
      console.error('Error leaving session:', error);
    }
  };

  const isAdmin = session?.userRole === 'admin';
  const hasVoted = selectedCard !== null;
  const allParticipantsVoted = activeParticipants.length > 0 && 
    votes.length === activeParticipants.length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Session non trouvée</h1>
          <button onClick={() => navigate('/dashboard')} className="btn-primary">
            Retour au tableau de bord
          </button>
        </div>
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
              <button
                onClick={() => navigate('/dashboard')}
                className="btn-secondary mr-4 flex items-center"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour
              </button>
              <h1 className="text-xl font-semibold text-gray-900">{session.name}</h1>
              {isAdmin && (
                <Crown className="h-5 w-5 text-yellow-500 ml-2" title="Administrateur" />
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Participants count */}
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-gray-500" />
                <span className="text-sm text-gray-600">
                  {session.participants?.length || 0} participant(s)
                </span>
              </div>
              
              {/* Admin controls */}
              {isAdmin && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={revealVotes}
                    disabled={votes.length === 0 || votesRevealed}
                    className="btn-primary flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Révéler
                  </button>
                  <button
                    onClick={resetVotes}
                    disabled={votes.length === 0}
                    className="btn-secondary flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset
                  </button>
                </div>
              )}

              {/* Participant controls (Leave button for non-admin) */}
              {!isAdmin && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={leaveSessionHandler}
                    className="btn-secondary flex items-center text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Quitter la session
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main voting area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Current ticket */}
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-medium text-gray-900">Ticket actuel</h3>
              </div>
              <div className="card-body">
                {session.currentTicket?.key ? (
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                        {session.currentTicket.key}
                      </span>
                      {session.currentTicket.storyPoints && (
                        <span className="text-sm text-gray-500">
                          ({session.currentTicket.storyPoints} points)
                        </span>
                      )}
                    </div>
                    <h4 className="font-medium text-gray-900 mb-2">
                      {session.currentTicket.title}
                    </h4>
                    {session.currentTicket.description && (
                      <p className="text-gray-600 text-sm">
                        {session.currentTicket.description}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <ExternalLink className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Aucun ticket Jira sélectionné</p>
                    <p className="text-sm text-gray-400">Estimation libre</p>
                  </div>
                )}
              </div>
            </div>

            {/* Voting cards */}
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-medium text-gray-900">Choisissez votre estimation</h3>
                {hasVoted && !votesRevealed && (
                  <div className="flex items-center text-green-600">
                    <CheckCircle className="h-5 w-5 mr-2" />
                    <span className="text-sm">Vote enregistré</span>
                  </div>
                )}
              </div>
              <div className="card-body">
                <div className="grid grid-cols-5 gap-4">
                  {POKER_CARDS.map((card) => (
                    <button
                      key={card}
                      onClick={() => submitVote(card)}
                      disabled={votesRevealed}
                      className={`
                        vote-card
                        ${selectedCard === card ? 'selected' : ''}
                        ${votesRevealed ? 'disabled' : ''}
                      `}
                    >
                      {card}
                    </button>
                  ))}
                </div>
                
                {votesRevealed && (
                  <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Votre vote</h4>
                    <div className="text-2xl font-bold text-blue-700">
                      {selectedCard || 'Pas de vote'}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Results */}
            {votesRevealed && stats && (
              <div className="card">
                <div className="card-header">
                  <h3 className="text-lg font-medium text-gray-900 flex items-center">
                    <BarChart3 className="h-5 w-5 mr-2" />
                    Statistiques
                  </h3>
                </div>
                <div className="card-body">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{stats.totalVotes}</div>
                      <div className="text-sm text-gray-500">Total votes</div>
                    </div>
                    {stats.average && (
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{stats.average}</div>
                        <div className="text-sm text-gray-500">Moyenne</div>
                      </div>
                    )}
                    {stats.min && (
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{stats.min}</div>
                        <div className="text-sm text-gray-500">Minimum</div>
                      </div>
                    )}
                    {stats.max && (
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{stats.max}</div>
                        <div className="text-sm text-gray-500">Maximum</div>
                      </div>
                    )}
                  </div>
                  
                  {stats.consensus && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center text-green-800">
                        <CheckCircle className="h-5 w-5 mr-2" />
                        <span className="font-medium">Consensus atteint !</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Participants */}
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-medium text-gray-900">Participants</h3>
              </div>
              <div className="card-body">
                <div className="space-y-3">
                  {activeParticipants.map((participant) => {
                    const hasUserVoted = votes.some(vote => 
                      vote.userId === participant._id || vote.userId?._id === participant._id
                    );
                    const userVote = votesRevealed ? votes.find(vote => 
                      vote.userId === participant._id || vote.userId?._id === participant._id
                    ) : null;
                    const isOnline = participant.isOnline || onlineUsers.has(participant._id);
                    const isCurrentUser = participant._id === user?.id;
                    const isSessionAdmin = session?.createdBy && (participant._id === session.createdBy._id || participant._id === session.createdBy);

                    return (
                      <div key={participant._id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="user-avatar">
                            {participant.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-gray-900">
                                {participant.username}
                                {isCurrentUser && ' (vous)'}
                              </span>
                              {isSessionAdmin && (
                                <Crown className="h-4 w-4 text-yellow-500" />
                              )}
                              {participant.source && process.env.NODE_ENV === 'development' && (
                                <span className="text-xs bg-gray-100 px-1 rounded">
                                  {participant.source}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className={isOnline ? 'status-online' : 'status-offline'} />
                              <span className="text-xs text-gray-500">
                                {isOnline ? 'En ligne' : 'Hors ligne'}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {votesRevealed && userVote ? (
                            <div className="vote-card-mini">
                              {userVote.value}
                            </div>
                          ) : hasUserVoted ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <Clock className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Voting status */}
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-medium text-gray-900">État du vote</h3>
              </div>
              <div className="card-body">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Votes reçus</span>
                    <span className="font-medium">
                      {votes.length} / {activeParticipants.length}
                    </span>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${activeParticipants.length > 0 ? 
                          (votes.length / activeParticipants.length) * 100 : 0}%` 
                      }}
                    />
                  </div>
                  
                  {allParticipantsVoted && !votesRevealed && (
                    <div className="text-center">
                      <div className="text-green-600 font-medium mb-2">
                        Tous les participants ont voté !
                      </div>
                      {isAdmin && (
                        <button
                          onClick={revealVotes}
                          className="btn-success w-full"
                        >
                          Révéler les votes
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default SessionPage; 