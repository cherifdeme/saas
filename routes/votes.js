const express = require('express');
const Joi = require('joi');
const Session = require('../models/Session');
const Vote = require('../models/Vote');
const { authenticate } = require('../middleware/auth');
const { hasPermission } = require('../config/roles');

const router = express.Router();

// Validation schema
const voteSchema = Joi.object({
  value: Joi.string().valid('1', '2', '3', '5', '8', '13', '21', '40', '∞', '?').required()
});

// @route   POST /api/votes/:sessionId
// @desc    Submit a vote for a session
// @access  Private
router.post('/:sessionId', authenticate, async (req, res) => {
  try {
    // Validate input
    const { error } = voteSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const session = await Session.findById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session non trouvée' });
    }

    // Check if user has permission to vote
    if (!hasPermission(req.user._id, session, 'submitVote')) {
      return res.status(403).json({ message: 'Vous n\'avez pas la permission de voter' });
    }

    // Check if user is a participant
    if (!session.participants.includes(req.user._id)) {
      return res.status(403).json({ message: 'Vous devez participer à la session pour voter' });
    }

    // Check if votes are already revealed (can't vote after reveal)
    if (session.votesRevealed) {
      return res.status(400).json({ message: 'Les votes ont déjà été révélés pour ce tour' });
    }

    const currentRound = session.currentRound || 1;

    // Update or create vote
    const existingVote = await Vote.findOne({
      sessionId: req.params.sessionId,
      userId: req.user._id,
      round: currentRound
    });

    let vote;
    if (existingVote) {
      existingVote.value = req.body.value;
      vote = await existingVote.save();
    } else {
      vote = new Vote({
        sessionId: req.params.sessionId,
        userId: req.user._id,
        value: req.body.value,
        round: currentRound
      });
      await vote.save();
    }

    await vote.populate('userId', 'username');

    // Emit vote update to all session participants
    req.io.to(`session-${req.params.sessionId}`).emit('voteSubmitted', {
      sessionId: req.params.sessionId,
      userId: req.user._id,
      username: req.user.username,
      hasVoted: true
    });

    res.json({ message: 'Vote enregistré avec succès', vote });
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement du vote:', error);
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});

// @route   POST /api/votes/:sessionId/reveal
// @desc    Reveal all votes for a session
// @access  Private
router.post('/:sessionId/reveal', authenticate, async (req, res) => {
  try {
    const session = await Session.findById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session non trouvée' });
    }

    // Check if user has permission to reveal votes
    if (!hasPermission(req.user._id, session, 'revealVotes')) {
      return res.status(403).json({ message: 'Vous n\'avez pas la permission de révéler les votes' });
    }

    // Mark votes as revealed
    session.votesRevealed = true;
    await session.save();

    // Get all votes for current round
    const currentRound = session.currentRound || 1;
    const votes = await Vote.find({
      sessionId: req.params.sessionId,
      round: currentRound
    }).populate('userId', 'username');

    // Calculate statistics
    const voteValues = votes.map(v => v.value).filter(v => v !== '?' && v !== '∞');
    const numericValues = voteValues.map(v => parseInt(v)).filter(v => !isNaN(v));
    
    const stats = {
      totalVotes: votes.length,
      average: numericValues.length > 0 ? Math.round((numericValues.reduce((a, b) => a + b, 0) / numericValues.length) * 10) / 10 : null,
      min: numericValues.length > 0 ? Math.min(...numericValues) : null,
      max: numericValues.length > 0 ? Math.max(...numericValues) : null,
      consensus: votes.length > 1 && new Set(voteValues).size === 1
    };

    // Emit reveal to all session participants
    req.io.to(`session-${req.params.sessionId}`).emit('votesRevealed', {
      sessionId: req.params.sessionId,
      votes,
      stats
    });

    res.json({ message: 'Votes révélés avec succès', votes, stats });
  } catch (error) {
    console.error('Erreur lors de la révélation des votes:', error);
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});

// @route   POST /api/votes/:sessionId/reset
// @desc    Reset all votes for a session
// @access  Private
router.post('/:sessionId/reset', authenticate, async (req, res) => {
  try {
    const session = await Session.findById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session non trouvée' });
    }

    // Check if user has permission to reset votes
    if (!hasPermission(req.user._id, session, 'resetVotes')) {
      return res.status(403).json({ message: 'Vous n\'avez pas la permission de réinitialiser les votes' });
    }

    const currentRound = session.currentRound || 1;

    // Delete all votes for current round
    await Vote.deleteMany({
      sessionId: req.params.sessionId,
      round: currentRound
    });

    // Reset session state
    session.votesRevealed = false;
    await session.save();

    // Emit reset to all session participants
    req.io.to(`session-${req.params.sessionId}`).emit('votesReset', {
      sessionId: req.params.sessionId
    });

    res.json({ message: 'Votes réinitialisés avec succès' });
  } catch (error) {
    console.error('Erreur lors de la réinitialisation des votes:', error);
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});

// @route   GET /api/votes/:sessionId
// @desc    Get votes for a session
// @access  Private
router.get('/:sessionId', authenticate, async (req, res) => {
  try {
    const session = await Session.findById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session non trouvée' });
    }

    // Check if user can access this session
    const isCreator = session.createdBy.toString() === req.user._id.toString();
    const isParticipant = session.participants.includes(req.user._id);
    
    if (!session.isPublic && !isCreator && !isParticipant) {
      return res.status(403).json({ message: 'Accès refusé à cette session' });
    }

    const currentRound = session.currentRound || 1;
    const votes = await Vote.find({
      sessionId: req.params.sessionId,
      round: currentRound
    }).populate('userId', 'username');

    // Return vote details only if votes are revealed or user can view them
    const canViewVotes = hasPermission(req.user._id, session, 'viewRevealedVotes');
    
    if (session.votesRevealed && canViewVotes) {
      res.json({ votes, revealed: true });
    } else {
      // Return only who has voted, not the actual votes
      const voteStatus = votes.map(vote => ({
        userId: vote.userId._id,
        username: vote.userId.username,
        hasVoted: true
      }));
      res.json({ votes: voteStatus, revealed: false });
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des votes:', error);
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});

module.exports = router; 