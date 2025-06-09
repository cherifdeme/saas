const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  value: {
    type: String,
    required: true,
    enum: ['1', '2', '3', '5', '8', '13', '21', '40', '∞', '?']
  },
  round: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

// Compound index to ensure one vote per user per session per round
voteSchema.index({ sessionId: 1, userId: 1, round: 1 }, { unique: true });

// Index for faster queries
voteSchema.index({ sessionId: 1, round: 1 });

module.exports = mongoose.model('Vote', voteSchema); 