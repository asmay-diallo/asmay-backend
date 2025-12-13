
const User = require("../models/User");
const UserSession = require("../models/UserSession");
const geohash = require("ngeohash");
const jwt = require("jsonwebtoken");

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const { username, email, password, interests, latitude, longitude } =
      req.body;

    console.log("📝 Register attempt:", {
      username,
      email,
      latitude,
      longitude,
    });

    // Validation des champs requis
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Username, email et password sont requis",
      });
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Cet utilisateur existe déjà !",
      });
    }

    // Créer l'utilisateur
    const user = await User.create({
      username,
      email,
      password,
      interests: interests || [],
      privacySettings: { isVisible: true },
    });

    // Créer la session si la localisation est fournie
    if (latitude && longitude) {
      try {
        await UserSession.create({
          userId: user._id,
          sessionId: `session_${user._id}_${Date.now()}`,
          lastKnownGeohash: geohash.encode(latitude, longitude, 7),
          lat: parseFloat(latitude),
          lon: parseFloat(longitude),
          isActive: true,
          lastUpdated: new Date(),
        });
        console.log(`✅ Session créée pour ${username}`);
      } catch (sessionError) {
        console.error("❌ Erreur création session:", sessionError);
        // Continuer même si la session échoue
      }
    }

    // Générer le token JWT
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || "fallback-secret",
      { expiresIn: "30d" }
    );

    // Réponse réussie
    res.status(201).json({
      success: true,
      message: "Utilisateur créé avec succès",
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        interests: user.interests,
        profilePicture: user.profilePicture,
      },
    });
  } catch (error) {
    console.error("❌ Register error:", error);

    // Gestion des erreurs MongoDB
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        message: "Vos données sont invalides !",
        errors: messages,
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Email ou username déjà utilisé",
      });
    }

    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de l'inscription",
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Publicconst
login = async (req, res) => {
  try {
    const { email, password, latitude, longitude } = req.body;

    console.log("🔐 Login attempt:", {
      email,
      password: password ? "***" : "NULL",
      latitude,
      longitude,
    });

    // Vérifier si l'utilisateur existe - AVEC le password
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      console.log("❌ User not found:", email);
      return res.status(401).json({
        success: false,
        message: "Email ou mot de passe incorrect",
      });
    }

    // Vérifier le mot de passe avec la BONNE méthode
    const isPasswordValid = await user.correctPassword(password, user.password);

    if (!isPasswordValid) {
      console.log("❌ Invalid password for user:", user.username);
      return res.status(401).json({
        success: false,
        message: "Email ou mot de passe incorrect",
      });
    }

    console.log("✅ Login successful for:", user.username);

    // Mettre à jour/créer la session
    try {
      if (latitude && longitude) {
        const sessionData = {
          userId: user._id,
          sessionId: `session_${user._id}_${Date.now()}`,
          lastKnownGeohash: geohash.encode(latitude, longitude, 7),
          lat: parseFloat(latitude),
          lon: parseFloat(longitude),
          isActive: true,
          lastUpdated: new Date(),
        };

        await UserSession.findOneAndUpdate({ userId: user._id }, sessionData, {
          upsert: true,
          new: true,
        });

        console.log(`✅ Session créée/mise à jour pour ${user.username}`);
      } else {
        console.log("⚠️ Pas de localisation fournie pour la session");
      }
    } catch (sessionError) {
      console.error("❌ Erreur session (non bloquante):", sessionError);
    }

    // Mettre à jour lastActive
    user.lastActive = new Date();
    await user.save();

    // Générer le token JWT
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || "fallback-secret",
      { expiresIn: "30d" }
    );

    console.log("🎉 Login complet pour:", user.username);

    // Réponse réussie
    res.json({
      success: true,
      message: "Connexion réussie",
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        interests: user.interests || [],
        profilePicture: user.profilePicture,
        bio: user.bio,
        lastActive: user.lastActive,
        isOnline: user.isOnline,
      },
    });
  } catch (error) {
    console.error("❌ LOGIN ERROR:", error);

    // Gestion des erreurs spécifiques
    if (error.name === "JsonWebTokenError") {
      return res.status(500).json({
        success: false,
        message: "Erreur de configuration serveur",
      });
    }

    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la connexion",
    });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res) => {
  try {
    const userId = req.user._id;

    // Désactiver la session
    await UserSession.findOneAndUpdate(
      { userId },
      {
        isActive: false,
        lastUpdated: new Date(),
      }
    );

    res.json({
      success: true,
      message: "Déconnexion réussie",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la déconnexion",
    });
  }
};

module.exports = {
  register,
  login,
  logout,
};
