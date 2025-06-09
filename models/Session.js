const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Le nom de la session est requis'],
    trim: true,
    minlength: [1, 'Le nom de la session ne peut pas être vide'],
    maxlength: [100, 'Le nom de la session ne peut pas dépasser 100 caractères']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isPublic: {
    type: Boolean,
    default: true
  },
  currentTicket: {
    key: String,
    title: String,
    description: String,
    storyPoints: Number
  },
  votesRevealed: {
    type: Boolean,
    default: false
  },
  currentRound: {
    type: Number,
    default: 1
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'completed'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Index for faster queries
sessionSchema.index({ createdBy: 1 });
sessionSchema.index({ isPublic: 1 });
sessionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Session', sessionSchema); 