// const mongoose = require('mongoose');
// 
// const signalSchema = new mongoose.Schema({
//   fromUserSessionId: {
//     type: String, // Le sessionId de l'expéditeur
//     required: true,
//     ref: 'UserSession'
//   },
//   toUserSessionId: {
//     type: String, // Le sessionId du destinataire
//     required: true,
//     ref: 'UserSession'
//   },
//   status: {
//     type: String,
//     enum: ['pending', 'accepted', 'ignored', 'expired'],
//     default: 'pending'
//   },
//   commonInterests: [String], // Snapshotté à l'envoi
//   expiresAt: {
//     type: Date,
//     default: () => new Date(Date.now() + 10 * 60 * 1000), // Expire après 10 min
//     index: { expireAfterSeconds: 0 } // Suppression automatique à expiration
//   }
// }, {
//   timestamps: true
// });
// 
// // Index pour trouver rapidement les signaux entrants et sortants
// signalSchema.index({ toUserSessionId: 1, status: 1 });
// signalSchema.index({ fromUserSessionId: 1, status: 1 });
// 
// module.exports = mongoose.model('Signal', signalSchema);




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
  // 🔥 AJOUT : Chat créé si accepté
  chatId: {
    type: String,
    required: true, // ← Maintenant requis dès la création
    unique: true
  },
  // chatId: {
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: 'Chat'
  // },
  // viewed: {
  //   type: Boolean,
  //   default: false
  // },
  respondedAt: {
    type: Date
  }
}, {
  timestamps: true
});

signalSchema.index({ toUserId: 1, status: 1 });
signalSchema.index({ fromUserId: 1, status: 1 });
signalSchema.index({ toUserSessionId: 1, status: 1 });

// signalSchema.index({ toUser: 1, status: 1 });
// signalSchema.index({ fromUser: 1, status: 1 });

module.exports = mongoose.model('Signal', signalSchema);