// const mongoose = require('mongoose');
//
// const messageSchema = new mongoose.Schema({
//   chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
//   sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   content: { type: String, required: true, maxlength: 500 }, // Limite de caractères
//   read: { type: Boolean, default: false }
// }, {
//   timestamps: true
// });
//
// // Index pour récupérer rapidement les messages d'un chat
// messageSchema.index({ chatId: 1, createdAt: 1 });
//
// module.exports = mongoose.model('Message', messageSchema);
// ________________________________________

const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: { type: String, required: true, maxlength: 500 }, // Limite de caractères
    read: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Index pour récupérer rapidement les messages d'un chat
messageSchema.index({ chatId: 1, createdAt: 1 });

module.exports = mongoose.model("Message", messageSchema);
