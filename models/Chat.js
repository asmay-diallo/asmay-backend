// const mongoose = require("mongoose");
// 
// const chatSchema = new mongoose.Schema(
//   {
//     participant1: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//     },
//     participant2: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//     },
//     initiatedFromSignal: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Signal",
//     },
//     lastActivity: { type: Date, default: Date.now },
//     lastMessage: { type: String }, // 🔥 AJOUT : Pour l'aperçu
// 
//     isActive: { type: Boolean, default: true },
//   },
//   {
//     timestamps: true,
//   }
// );
// chatSchema.index({ participant1: 1, participant2: 1 }, { unique: true });
// 
// module.exports = mongoose.model("Chat", chatSchema);

const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    participant1: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    participant2: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    initiatedFromSignal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Signal",
    },
     expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 48 * 60 * 60 * 1000), // 48h
    index: { expireAfterSeconds: 0 }
  },
    lastActivity: { type: Date, default: Date.now },
    lastMessage: { type: String },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    // Active les virtuals dans les résultats
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// 🔥 GETTER VIRTUEL "participants" - OPTION 2
chatSchema.virtual('participants').get(function() {
  // Retourne un tableau avec les deux participants
  return [this.participant1, this.participant2].filter(Boolean);
});

// 🔥 Méthode utilitaire pour vérifier si un utilisateur est participant
chatSchema.methods.isUserParticipant = function(userId) {
  if (!userId) return false;
  
  const userIdStr = userId.toString();
  const participant1Str = this.participant1?.toString();
  const participant2Str = this.participant2?.toString();
  
  return userIdStr === participant1Str || userIdStr === participant2Str;
};

// 🔥 Méthode pour obtenir l'autre participant
chatSchema.methods.getOtherParticipant = function(userId) {
  if (!userId) return null;
  
  const userIdStr = userId.toString();
  const participant1Str = this.participant1?.toString();
  const participant2Str = this.participant2?.toString();
  
  if (userIdStr === participant1Str) {
    return this.participant2;
  } else if (userIdStr === participant2Str) {
    return this.participant1;
  }
  
  return null;
};

chatSchema.index({ participant1: 1, participant2: 1 }, { unique: true });

module.exports = mongoose.model("Chat", chatSchema);