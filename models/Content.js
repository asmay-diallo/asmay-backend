const mongoose = require("mongoose");

const contentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["video", "image", "text", "audio", "mixed"],
      required: [true, "Le type de contenu est requis"],
    },
    title: {
      type: String,
      maxlength: [200, "Le titre ne peut pas dépasser 200 caractères"],
      default: "",
    },
    description: {
      type: String,
      maxlength: [2000, "La description ne peut pas dépasser 2000 caractères"],
      default: "",
    },
    
    // URLs des médias
    media: [{
      url: {
        type: String,
        required: true,
      },
      type: {
        type: String,
        enum: ["video", "image", "audio"],
      },
      thumbnail: String, // Pour les vidéos
      duration: Number, // Durée en secondes pour vidéos/audio
      order: Number, // Pour gérer l'ordre d'affichage
    }],
    
    // Pour le contenu texte uniquement
    textContent: {
      type: String,
      maxlength: [5000, "Le texte ne peut pas dépasser 5000 caractères"],
    },
    
    // Métadonnées et statistiques
    hashtags: [{
      type: String,
      trim: true,
      lowercase: true,
    }],
    
    mentions: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
    
    visibility: {
      type: String,
      enum: ["public", "private", "followers"],
      default: "public",
    },
    
    // Statistiques
    stats: {
      views: { type: Number, default: 0 },
      likes: { type: Number, default: 0 },
      comments: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
      saves: { type: Number, default: 0 },
    },
    
    // Utilisateurs qui ont liké
    likedBy: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
    
    // Commentaires (référencés séparément)
    comments: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
    }],
    
    // Statut du contenu
    status: {
      type: String,
      enum: ["draft", "processing", "published", "archived", "flagged", "deleted"],
      default: "draft",
    },
    
    // Métadonnées supplémentaires
    location: {
      name: String,
      coordinates: {
        type: [Number],
        index: "2dsphere",
      },
    },
    
    allowComments: {
      type: Boolean,
      default: true,
    },
    
    allowDuet: {
      type: Boolean,
      default: true,
    },
    
    allowStitch: {
      type: Boolean,
      default: true,
    },
    
    // Pour le contenu musical
    music: {
      title: String,
      artist: String,
      url: String,
      startTime: Number, // Pour synchroniser avec la vidéo
      endTime: Number,
    },
    
    // Pour les challenges/viralité
    isOriginalSound: {
      type: Boolean,
      default: false,
    },
    
    challenge: {
      type: String,
      trim: true,
    },
    
    // Modération
    isNSFW: {
      type: Boolean,
      default: false,
    },
    
    moderationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected", "under_review"],
      default: "pending",
    },
    
    moderationNote: String,
    
    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    
    moderatedAt: Date,
    
    // Pour les analytics
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    
    publishedAt: Date,
    
  },
  {
    timestamps: true,
  }
);

// Index pour la recherche rapide
contentSchema.index({ user: 1, createdAt: -1 });
contentSchema.index({ hashtags: 1 });
contentSchema.index({ type: 1, status: 1 });
contentSchema.index({ "stats.views": -1 });
contentSchema.index({ "location.coordinates": "2dsphere" });

// Index pour la recherche textuelle
contentSchema.index({ 
  title: "text", 
  description: "text", 
  hashtags: "text",
  challenge: "text"
});

// Middleware pour mettre à jour les statistiques utilisateur
contentSchema.post("save", async function(doc) {
  if (this.status === "published") {
    await mongoose.model("User").findByIdAndUpdate(
      doc.user,
      { $addToSet: { contents: doc._id } }
    );
  }
});

// Middleware pour nettoyer les références lors de la suppression
contentSchema.pre("remove", async function(next) {
  await mongoose.model("User").findByIdAndUpdate(
    this.user,
    { $pull: { contents: this._id } }
  );
  next();
});

// Méthode pour obtenir le contenu avec les infos utilisateur
contentSchema.methods.getContentWithUser = async function() {
  await this.populate("user", "username profilePicture isOnline");
  return this;
};

// Méthode pour incrémenter les vues
contentSchema.methods.incrementViews = async function() {
  this.stats.views += 1;
  return this.save();
};

const Content = mongoose.model("Content", contentSchema);

module.exports = Content;