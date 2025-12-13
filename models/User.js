

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Le nom d'utilisateur est requis"],
      unique: true,
      trim: true,
      minlength: [
        3,
        "Le nom d'utilisateur doit contenir au moins 3 caractères",
      ],
      maxlength: [
        20,
        "Le nom d'utilisateur ne peut pas dépasser 20 caractères",
      ],
    },
    email: {
      type: String,
      required: [true, "L'email est requis"],
      unique: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Email invalide"],
    },
    password: {
      type: String,
      required: [true, "Le mot de passe est requis"],
      minlength: [6, "Le mot de passe doit contenir au moins 6 caractères"],
      select: false, // Ne pas retourner le password par défaut
    },
    interests: [
      {
        type: String,
        trim: true,
      },
    ],
    profilePicture: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      maxlength: [500, "La bio ne peut pas dépasser 500 caractères"],
      default: "",
    },
    connections: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    privacySettings: {
      isVisible: {
        type: Boolean,
        default: true,
      },
      showCommonInterestsOnly: {
        type: Boolean,
        default: true,
      },
      showOnRadar: {
        type: Boolean,
        default: true,
      },
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        default: [0, 0],
      },
      lastUpdated: Date,
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Middleware pour hasher le mot de passe avant sauvegarde
userSchema.pre("save", async function (next) {
  // Only run this function if password was modified
  if (!this.isModified("password")) return next();

  // Hash the password with cost of 12
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Middleware pour mettre à jour isOnline
userSchema.pre("save", function (next) {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  this.isOnline = this.lastActive > fiveMinutesAgo;
  next();
});

// Méthode pour comparer les mots de passe
userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Méthode pour obtenir le profil public
userSchema.methods.getPublicProfile = function () {
  return {
    _id: this._id,
    username: this.username,
    interests: this.interests,
    profilePicture: this.profilePicture,
    bio: this.bio,
    privacySettings: this.privacySettings,
    lastActive: this.lastActive,
    isOnline: this.isOnline,
  };
};

// Index pour la recherche géospatiale
userSchema.index({ location: "2dsphere" });

// Index pour la recherche textuelle
userSchema.index({ username: "text", interests: "text" });

module.exports = mongoose.model("User", userSchema);
