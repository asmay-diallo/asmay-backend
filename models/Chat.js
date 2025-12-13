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
    lastActivity: { type: Date, default: Date.now },
    lastMessage: { type: String }, // 🔥 AJOUT : Pour l'aperçu
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
      index: { expireAfterSeconds: 0 },
    },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);
chatSchema.index({ participant1: 1, participant2: 1 }, { unique: true });

module.exports = mongoose.model("Chat", chatSchema);
