const express = require('express');
const Joi = require('joi');
const Session = require('../models/Session');
const Vote = require('../models/Vote');
const { authenticate } = require('../middleware/auth');
const { hasPermission } = require('../config/roles');

const router = express.Router();

// Validation schemas
const createSessionSchema = Joi.object({
  name: Joi.string().min(1).max(100).required()
});

const updateTicketSchema = Joi.object({
  key: Joi.string().optional(),
  title: Joi.string().optional(),
  description: Joi.string().optional(),
  storyPoints: Joi.number().optional()
});

// @route   GET /api/sessions
// @desc    Get all sessions (user's own + public sessions)
// @access  Private
router.get('/', authenticate, async (req, res) => {
  try {
    const sessions = await Session.find({
      $or: [
        { createdBy: req.user._id },
        { isPublic: true }
      ]
    })
    .populate('createdBy', 'username')
    .populate('participants', 'username')
    .sort({ createdAt: -1 });

    res.json(sessions);
  } catch (error) {
    console.error('Erreur lors de la récupération des sessions:', error);
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});

// @route   GET /api/sessions/:id
// @desc    Get a specific session
// @access  Private
router.get('/:id', authenticate, async (req, res) => {
  try {
    const session = await Session.findById(req.params.id)
      .populate('createdBy', 'username')
      .populate('participants', 'username');

    if (!session) {
      return res.status(404).json({ message: 'Session non trouvée' });
    }

    // Check if user can access this session
    const isCreator = session.createdBy._id.toString() === req.user._id.toString();
    const isParticipant = session.participants.some(p => p._id.toString() === req.user._id.toString());
    
    if (!session.isPublic && !isCreator && !isParticipant) {
      return res.status(403).json({ message: 'Accès refusé à cette session' });
    }

    // Get current votes for this session
    const votes = await Vote.find({ 
      sessionId: session._id,
      round: session.currentRound || 1
    }).populate('userId', 'username');

    res.json({
      ...session.toJSON(),
      votes: session.votesRevealed ? votes : votes.map(v => ({
        userId: v.userId,
        hasVoted: true
      })),
      userRole: isCreator ? 'admin' : 'participant'
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de la session:', error);
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});

// @route   POST /api/sessions
// @desc    Create a new session
// @access  Private
router.post('/', authenticate, async (req, res) => {
  try {
    // Validate input
    const { error } = createSessionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const session = new Session({
      name: req.body.name,
      createdBy: req.user._id,
      participants: [req.user._id]
    });

    await session.save();
    await session.populate('createdBy', 'username');
    await session.populate('participants', 'username');

    // Emit to all connected clients
    req.io.emit('sessionCreated', session);

    res.status(201).json(session);
  } catch (error) {
    console.error('Erreur lors de la création de la session:', error);
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});

// @route   POST /api/sessions/:id/join
// @desc    Join a session
// @access  Private
router.post('/:id/join', authenticate, async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);

    if (!session) {
      return res.status(404).json({ message: 'Session non trouvée' });
    }

    // Check if user is already a participant
    const isAlreadyParticipant = session.participants.includes(req.user._id);
    
    if (!isAlreadyParticipant) {
      session.participants.push(req.user._id);
    }
    await session.save();
    await session.populate('createdBy', 'username');
    await session.populate('participants', 'username');

    // Emit to all clients in this session
    req.io.to(`session-${session._id}`).emit('userJoined', {
      sessionId: session._id,
      user: { id: req.user._id, username: req.user.username }
    });

    res.json({ message: 'Vous avez rejoint la session', session });
  } catch (error) {
    console.error('Erreur lors de la participation à la session:', error);
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});

// @route   POST /api/sessions/:id/leave
// @desc    Leave a session
// @access  Private
router.post('/:id/leave', authenticate, async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);

    if (!session) {
      return res.status(404).json({ message: 'Session non trouvée' });
    }

    // Check if user is a participant
    if (!session.participants.includes(req.user._id)) {
      return res.status(400).json({ message: 'Vous ne participez pas à cette session' });
    }

    // Don't allow the creator to leave their own session
    if (session.createdBy.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Le créateur ne peut pas quitter sa propre session' });
    }

    // Remove user from participants list
    session.participants = session.participants.filter(
      p => p.toString() !== req.user._id.toString()
    );
    await session.save();
    await session.populate('createdBy', 'username');
    await session.populate('participants', 'username');

    // Emit to all clients in this session
    req.io.to(`session-${session._id}`).emit('userLeft', {
      sessionId: session._id,
      user: { id: req.user._id, username: req.user.username }
    });

    res.json({ message: 'Vous avez quitté la session', session });
  } catch (error) {
    console.error('Erreur lors de la sortie de session:', error);
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});

// @route   DELETE /api/sessions/:id
// @desc    Delete a session
// @access  Private
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const session = await Session.findById(req.params.id).populate('participants', 'username');

    if (!session) {
      return res.status(404).json({ message: 'Session non trouvée' });
    }

    // Check if user has permission to delete
    if (!hasPermission(req.user._id, session, 'deleteSession')) {
      return res.status(403).json({ message: 'Vous n\'avez pas la permission de supprimer cette session' });
    }

    // Notifier tous les participants de la session qu'elle va être supprimée
    // Émission spécifique à la room de la session
    req.io.to(`session-${session._id}`).emit('sessionDeleted', { 
      sessionId: session._id,
      sessionName: session.name,
      deletedBy: req.user.username
    });

    // Forcer la déconnexion de tous les sockets de cette session
    const socketsInRoom = await req.io.in(`session-${session._id}`).fetchSockets();
    for (const socket of socketsInRoom) {
      socket.leave(`session-${session._id}`);
      // Nettoyer les données de session du socket
      if (socket.currentSessionId === session._id.toString()) {
        socket.currentSessionId = null;
      }
    }

    // Delete all votes related to this session
    await Vote.deleteMany({ sessionId: session._id });
    
    // Delete the session
    await Session.findByIdAndDelete(req.params.id);

    // Emit to all clients pour mettre à jour les listes de sessions
    req.io.emit('sessionDeleted', { sessionId: session._id });

    res.json({ message: 'Session supprimée avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression de la session:', error);
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});

// @route   PUT /api/sessions/:id/ticket
// @desc    Update current ticket for session
// @access  Private
router.put('/:id/ticket', authenticate, async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);

    if (!session) {
      return res.status(404).json({ message: 'Session non trouvée' });
    }

    // Check if user has permission
    if (!hasPermission(req.user._id, session, 'selectJiraTicket')) {
      return res.status(403).json({ message: 'Vous n\'avez pas la permission de sélectionner un ticket' });
    }

    // Validate input
    const { error } = updateTicketSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    session.currentTicket = req.body;
    await session.save();

    // Emit to all clients in this session
    req.io.to(`session-${session._id}`).emit('ticketUpdated', {
      sessionId: session._id,
      ticket: session.currentTicket
    });

    res.json({ message: 'Ticket mis à jour', ticket: session.currentTicket });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du ticket:', error);
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});

module.exports = router; 