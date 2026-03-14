
const mongoose = require('mongoose');

const User = require("../models/User");
const UserSession = require("../models/UserSession");
const geohash = require("ngeohash");
const jwt = require("jsonwebtoken");
const EmailVerification = require("../models/EmailVerification")
const emailService = require("../services/emailService")



// Générer un code à 6 chiffres
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// @desc    Demander un code de vérification
// @route   POST /api/auth/send-verification
// @access  Public
const sendVerificationCode = async (req, res) => {
  try {
    const { email, username } = req.body;

    // Vérifier si l'email est déjà utilisé
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Cet email est déjà utilisé",
      });
    }

    // Générer un code
    const code = generateVerificationCode();

    // Sauvegarder ou mettre à jour la demande de vérification
    await EmailVerification.findOneAndUpdate(
      { email },
      {
        email,
        code,
        attempts: 0,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        verifiedAt: null,
      },
      { upsert: true }
    );

    // Envoyer l'email
    await emailService.sendVerificationCode(email, code, username);

    res.json({
      success: true,
      message: "Code de vérification envoyé",
    });

  } catch (error) {
    console.error("❌ Erreur sendVerificationCode:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'envoi du code",
    });
  }
};

// @desc    Vérifier le code
// @route   POST /api/auth/verify-code
// @access  Public
const verifyCode = async (req, res) => {
  try {
    const { email, code } = req.body;

    const verification = await EmailVerification.findOne({
      email,
      code,
      expiresAt: { $gt: new Date() },
      verifiedAt: null,
    });

    if (!verification) {
      // Incrémenter les tentatives
      await EmailVerification.findOneAndUpdate(
        { email },
        { $inc: { attempts: 1 } }
      );

      return res.status(400).json({
        success: false,
        message: "Code invalide ou expiré",
      });
    }

    // Marquer comme vérifié
    verification.verifiedAt = new Date();
    await verification.save();

    res.json({
      success: true,
      message: "Email vérifié avec succès",
    });

  } catch (error) {
    console.error("❌ Erreur verifyCode:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la vérification",
    });
  }
};

// @desc    Renvoyer un code
// @route   POST /api/auth/resend-code
// @access  Public
const resendCode = async (req, res) => {
  try {
    const { email, username } = req.body;

    const newCode = generateVerificationCode();

    await EmailVerification.findOneAndUpdate(
      { email },
      {
        code: newCode,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        verifiedAt: null,
      }
    );

    await emailService.sendVerificationCode(email, newCode, username);

    res.json({
      success: true,
      message: "Nouveau code envoyé",
    });

  } catch (error) {
    console.error("❌ Erreur resendCode:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors du renvoi",
    });
  }
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
// const register = async (req, res) => {
//   try {
//     const { username, email, password, interests, latitude, longitude } =
//       req.body;
// 
//     console.log("📝 Register attempt:", {
//       username,
//       email,
//       latitude,
//       longitude,
//     });
// 
//     // Validation des champs requis
//     if (!username || !email || !password) {
//       return res.status(400).json({
//         success: false,
//         message: "Username, email et password sont requis",
//       });
//     }
// 
//     // Vérifier si l'utilisateur existe déjà
//     const existingUser = await User.findOne({
//       $or: [{ email }, { username }],
//     });
// 
//     if (existingUser) {
//       return res.status(400).json({
//         success: false,
//         message: "Cet compte ASMAY existe déjà ! Veuillez ajouter un autre compte !",
//       });
//     }
// 
//     // Créer l'utilisateur
//     const user = await User.create({
//       username,
//       email,
//       password,
//       interests: interests || [],
//       privacySettings: { isVisible: true },
//     });
// 
//     // Créer la session si la localisation est fournie
//     if (latitude && longitude) {
//     const currentGeohash = geohash.encode(latitude,longitude,process.env.GEOHASH_PRECISION)
//       try {
//         await UserSession.create({
//           userId: user._id,
//           sessionId: `session_${user._id}_${Date.now()}`,
//           lastKnownGeohash: currentGeohash,
//           lat: parseFloat(latitude),
//           lon: parseFloat(longitude),
//           isActive: true,
//           lastUpdated: new Date(),
//         });
//         console.log(`✅ Session créée pour ${username}`);
//       } catch (sessionError) {
//         console.error("❌ Erreur création session:", sessionError);
//         // Continuer même si la session échoue
//       }
//     }
// 
//     // Générer le token JWT
//     const token = jwt.sign(
//       { id: user._id },
//       process.env.JWT_SECRET || "fallback-secret",
//       { expiresIn: "75d" }
//     );
// 
//     // Réponse réussie
//     res.status(201).json({
//       success: true,
//       message: "Utilisateur créé avec succès",
//       token,
//       user: {
//         _id: user._id,
//         username: user.username,
//         email: user.email,
//         interests: user.interests,
//         profilePicture: user.profilePicture,
//       },
//     });
//   } catch (error) {
//     console.error("❌ Register error:", error);
// 
//     // Gestion des erreurs MongoDB
//     if (error.name === "ValidationError") {
//       const messages = Object.values(error.errors).map((val) => val.message);
//       return res.status(400).json({
//         success: false,
//         message: "Vos données sont invalides ! Veuillez vérifier !",
//         errors: messages,
//       });
//     }
// 
//     if (error.code === 11000) {
//       return res.status(400).json({
//         success: false,
//         message: "Email ou username déjà utilisé",
//       });
//     }
// 
//     res.status(500).json({
//       success: false,
//       message: "Erreur serveur lors de l'inscription",
//     });
//   }
// };
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

    //  Vérifier que l'email a été vérifié
    const verification = await EmailVerification.findOne({
      email,
      verifiedAt: { $ne: null },
    });

    if (!verification) {
      return res.status(400).json({
        success: false,
        message: "Veuillez d'abord vérifier votre email",
      });
    }

    // Validation des champs requis
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Username, email et password sont requis",
      });
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUserWithUsername = await User.findOne({
      $or:[ { username }]
    })
    if(existingUserWithUsername){
      return res.status(400).json({
        success:false,
        message:"Cet nom d'utilisateur ASMAY existe déjà ! Veuillez ajouter un autre nom d'utilisateur !"
      })
    }
    const existingUserWithEmail = await User.findOne({
      $or: [{ email }],
    });

    if (existingUserWithEmail) {
      return res.status(400).json({
        success: false,
        message: "Cette email ASMAY existe déjà ! Veuillez ajouter un autre email !",
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
      const currentGeohash = geohash.encode(latitude,longitude,process.env.GEOHASH_PRECISION)
      try {
        await UserSession.create({
          userId: user._id,
          sessionId: `session_${user._id}_${Date.now()}`,
          lastKnownGeohash: currentGeohash,
          lat: parseFloat(latitude),
          lon: parseFloat(longitude),
          isActive: true,
          lastUpdated: new Date(),
        });
        console.log(`✅ Session créée pour ${username}`);
      } catch (sessionError) {
        console.error("❌ Erreur création session:", sessionError);
      }
    }

    // ✅ NOUVEAU : Envoyer email de bienvenue
    try {
      await emailService.sendWelcomeEmail(email, username);
    } catch (emailError) {
      console.error("❌ Erreur envoi email bienvenue:", emailError);
    }

    // ✅ NOUVEAU : Supprimer la demande de vérification
    await EmailVerification.deleteOne({ email });

    // Générer le token JWT
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || "fallback-secret",
      { expiresIn: "75d" }
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

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        message: "Vos données sont invalides ! Veuillez vérifier !",
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
// @access  Public
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

      const currentGeohash = geohash.encode(latitude,longitude,process.env.GEOHASH_PRECISION)

        const sessionData = {
          userId: user._id,
          sessionId: `session_${user._id}_${Date.now()}`,
          lastKnownGeohash: currentGeohash,
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
      { expiresIn: "75d" }
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
  sendVerificationCode,
  verifyCode,
  resendCode,
};
