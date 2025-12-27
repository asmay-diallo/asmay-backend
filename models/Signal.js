
const mongoose = require('mongoose');

const signalSchema = new mongoose.Schema({
  
  fromUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  toUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', 
    required: true
  },
  fromUserSessionId: {
    type: String,
    required: true,
    ref: 'UserSession'
  },
  toUserSessionId: {
    type: String,
    required: true,
    ref: 'UserSession'
  },
    message: {
    type: String,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'ignored', 'expired'],
    default: 'pending'
  },
  commonInterests: [String],
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
    index: { expireAfterSeconds: 0 }
  },
  chatId: {
    type: String,
    required: true, // ← Maintenant requis dès la création
    unique: true
  },

  viewed: {
    type: Boolean,
    default: false
  },
  respondedAt: {
    type: Date
  }
}, {
  timestamps: true
});

signalSchema.index({ toUserId: 1, status: 1 });
signalSchema.index({ fromUserId: 1, status: 1 });
signalSchema.index({ toUserSessionId: 1, status: 1 });

module.exports = mongoose.model('Signal', signalSchema);