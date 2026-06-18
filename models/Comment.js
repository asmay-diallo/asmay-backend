// models/Comment.js
const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    content: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Content",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: [true, "Le commentaire ne peut pas être vide"],
      maxlength: [500, "Le commentaire ne peut pas dépasser 500 caractères"],
    },
    likes: {
      type: Number,
      default: 0,
    },
    likedBy: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
    replies: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
    }],
    isEdited: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["active", "hidden", "deleted"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

commentSchema.index({ content: 1, createdAt: -1 });

module.exports = mongoose.model("Comment", commentSchema);