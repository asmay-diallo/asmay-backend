const User = require("../models/User");
const UserSession = require("../models/UserSession");
const geohash = require("ngeohash");
const jwt = require('jsonwebtoken');

const asyncHandler = require("../middleware/asyncHandler");

// 🛡️ DICTIONNAIRE DES RÉCOMPENSES (SECRET SERVEUR)
const REWARD_VALUES = {
  'WATCH_REWARDED_AD': 10,    // 10 coins pour une pub
  'SIGNUP_BONUS': 50,         // Bonus d'inscription
  'REFERRAL_BONUS': 25        // Parrainage
};
// Configuration du taux (1 coin = 0.0001 USD par défaut)
const COIN_EXCHANGE_RATE = 0.0001; // 10000 coins = 1 USD

// @desc     Get all users in data base
// @route   GET /api/users/
const getAllUser = asyncHandler(async (req, res) => {
  const users = await User.find().select("-password");

  res.status(200).json({
    success: true,
    message: "Every user displayed from data base successfully !",
    data: users,
  });
});
// 🔐 Générer un token Stream pour l'utilisateur connecté
const generateStreamToken = asyncHandler(async (req, res) => {
  try {
    // Votre middleware `protect` a déjà vérifié l'auth et mis `req.user`
    const userId = req.user._id.toString();
    // const userName = req.user.username;

    // 1. Créer le payload JWT pour Stream
    const payload = {
      user_id: userId, // DOIT correspondre à l'id de l'utilisateur ASMAY
      // Stream permet d'ajouter des claims custom si besoin
    };

    // 2. Signer avec votre SECRET_KEY Stream (à ajouter dans .env)
    const token = jwt.sign(payload, process.env.STREAM_SECRET_KEY, {
      expiresIn: '1h', // Token de courte durée
      algorithm: 'HS256',
    });

    // 3. Retourner le token ET les infos utilisateur formatées pour Stream
    res.status(200).json({
      success: true,
      data: {
        token: token,
        streamUser: {
          id: userId,
          username: req.user.username,
          profilePicture: req.user.profilePicture || '', 
          interests:req.user.interests
        },
      },
    });

  } catch (error) {
    console.error('❌ Erreur génération token Stream:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération du token vidéo',
    });
  }
});

// (Optionnel) Webhook pour recevoir des événements de Stream
const handleStreamWebhook = (req, res) => {
  // Pour gérer les événements comme "call.ended", "participant.joined"
  console.log('Webhook Stream reçu:', req.body);
  res.status(200).send('OK');
};
// Dans usersController.js - Méthode pour initier un appel vidéo
const initiateVideoCall =asyncHandler( async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const callerId = req.user._id;

    // 1. Vérifier que l'utilisateur cible existe et est connecté
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    // 2. Créer un ID d'appel unique (basé sur les IDs des users)
    const callId = `call_${[callerId, targetUserId].sort().join('_')}_${Date.now()}`;

    // 3. (Optionnel) Envoyer une notification via Socket.io
    const io = req.app.get('io');
    const targetSocketId = req.socketService.userConnections.get(targetUserId.toString());
    
    if (targetSocketId && io) {
      io.to(targetSocketId).emit('incoming_video_call', {
        callId: callId,
        caller: {
          _id: req.user._id,
          username: req.user.username,
          profilePicture: req.user.profilePicture,
        },
        timestamp: new Date(),
      });
    }

    // 4. Retourner l'ID d'appel au frontend
    res.status(200).json({
      success: true,
      data: { callId },
      message: targetSocketId ? 'Appel initié' : 'Utilisateur non connecté, appel manqué',
    });

  } catch (error) {
    console.error('❌ Erreur initiation appel:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});
// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
try{
  const user = await User.findById(req.user.id)
    .select("-password")
    .populate("interests", "username");

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "Utilisateur non trouvé",
    });
  }


 // Calculer la valeur monétaire
    const monetaryValue = user.coins * COIN_EXCHANGE_RATE;
    
    res.status(200).json({
      success: true,
      data: {
        ...user.toObject(),
        monetaryValue, // Valeur en dollars
        exchangeRate: COIN_EXCHANGE_RATE,
        currency: 'USD'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }

//   res.json({
//     success: true,
//     data: user,
//   });

})
// Endpoint pour récupérer le taux (optionnel)
const getExchangeRate = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      rate: COIN_EXCHANGE_RATE,
      currency: 'USD',
      updatedAt: new Date().toISOString()
    }
  });
});

// @desc    Créditer une récompense de manière SÉCURISÉE et IDEMPOTENTE
// @route   POST /api/users/me/rewards
// @access  Private
const addReward =asyncHandler( async (req, res) => {
  try {
    const userId = req.user._id;
    const { rewardType, rewardId } = req.body;

    // 1. VALIDATION : Le type est-il autorisé ?
    if (!rewardType || !REWARD_VALUES[rewardType]) {
      return res.status(400).json({
        success: false,
        message: 'Type de récompense invalide'
      });
    }

    // 2. IDEMPOTENCE : Cette récompense a-t-elle déjà été traitée ?
    if (rewardId) {
      const existingUser = await User.findOne({ 
        _id: userId, 
        processedRewards: rewardId 
      });
      if (existingUser) {
        return res.status(200).json({ // 200 et pas 409 pour éviter les retrys front
          success: true,
          message: 'Récompense déjà créditée',
          coins: existingUser.coins
        });
      }
    }

    // 3. MONTANT FIXE (décidé par le serveur, pas le frontend)
    const amountToAdd = REWARD_VALUES[rewardType];

    // 4. MISE À JOUR ATOMIQUE
    const updateData = {
      $inc: { coins: amountToAdd }
    };
    if (rewardId) {
      updateData.$addToSet = { processedRewards: rewardId }; // Évite les doublons
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, select: 'username coins' }
    );

    res.status(200).json({
      success: true,
      message: `+${amountToAdd} coins crédités`,
      data: { coins: updatedUser.coins }
    });

  } catch (error) {
    console.error('❌ Erreur addReward:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur' 
    });
  }
})

// @desc    Récupérer le profil utilisateur AVEC les coins
// @route   GET /api/users/me
// @access  Private
const getCurrentUser = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('username email profilePicture coins bio interests privacySettings');
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
})

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = asyncHandler(async (req, res) => {
  // CORRECTION ICI
  const { username, email, interests, bio,coins, profilePicture, privacySettings } =
    req.body;

  const updateData = {};
  if (username) updateData.username = username;
  if (email) updateData.email = email;
  if (interests) updateData.interests = interests;
  if (coins) updateData.coins = coins;
  if (bio !== undefined) updateData.bio = bio;
  if (profilePicture !== undefined) updateData.profilePicture = profilePicture;
  if (privacySettings) {
    updateData.privacySettings = {
      ...req.user.privacySettings,
      ...privacySettings,
    };
  }

  const user = await User.findByIdAndUpdate(req.user.id, updateData, {
    new: true,
    runValidators: true,
  }).select("-password");

  res.status(200).json({
    success: true,
    message: "Profil mis à jour avec succès",
    data: user,
  });
}); // NE PAS OUBLIER DE FERMER LA FONCTION ICI

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
    .select("-password -email")
    .populate("interests", "username");

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "Utilisateur non trouvé",
    });
  }

  if (!user.privacySettings?.isVisible) {
    return res.status(403).json({
      success: false,
      message: "Ce profil est privé",
    });
  }

  res.json({
    success: true,
    data: user,
  });
});

// @desc    Search users by username or interests
// @route   GET /api/users/search?q=query
// @access  Private
const searchUsers = asyncHandler(async (req, res) => {
  const { q, page = 1, limit = 10 } = req.query;

  if (!q) {
    return res.status(400).json({
      success: false,
      message: "Le paramètre de recherche est requis",
    });
  }

  const query = {
    _id: { $ne: req.user.id },
    "privacySettings.isVisible": true,
    $or: [
      { username: { $regex: q, $options: "i" } },
      { interests: { $in: [new RegExp(q, "i")] } },
    ],
  };

  const users = await User.find(query)
    .select("-password -email")
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .populate("interests", "username");

  const total = await User.countDocuments(query);

  res.json({
    success: true,
    data: users,
    pagination: {
      current: parseInt(page),
      total: Math.ceil(total / limit),
      results: users.length,
      totalResults: total,
    },
  });
});

// @desc    Get user's connections
// @route   GET /api/users/connections
// @access  Private
const getUserConnections = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id)
    .populate(
      "connections",
      "username profilePicture interests lastActive isOnline"
    )
    .select("connections");

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "Utilisateur non trouvé",
    });
  }

  res.json({
    success: true,
    data: user.connections,
  });
});

// @desc    Add connection
// @route   POST /api/users/connections/:userId
// @access  Private
const addConnection = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (userId === req.user.id) {
    return res.status(400).json({
      success: false,
      message:
        "Vous ne pouvez pas vous ajouter vous-même en tant que connexion",
    });
  }

  const targetUser = await User.findById(userId);
  if (!targetUser) {
    return res.status(404).json({
      success: false,
      message: "Utilisateur non trouvé",
    });
  }

  const currentUser = await User.findById(req.user.id);

  if (currentUser.connections.includes(userId)) {
    return res.status(400).json({
      success: false,
      message: "Déjà connecté avec cet utilisateur",
    });
  }

  currentUser.connections.push(userId);
  await currentUser.save();

  res.json({
    success: true,
    message: "Connexion ajoutée avec succès",
    data: targetUser,
  });
});

// @desc    Remove connection
// @route   DELETE /api/users/connections/:userId
// @access  Private
const removeConnection = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const currentUser = await User.findById(req.user.id);
  currentUser.connections = currentUser.connections.filter(
    (conn) => conn.toString() !== userId
  );

  await currentUser.save();

  res.json({
    success: true,
    message: "Connexion supprimée avec succès",
  });
});

// @desc    Get user statistics
// @route   GET /api/users/stats
// @access  Private
const getUserStats = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id)
    .populate("connections")
    .populate("interests");

  const stats = {
    totalConnections: user.connections.length,
    totalInterests: user.interests.length,
    profileCompletion: calculateProfileCompletion(user),
    lastActive: user.lastActive,
    accountAge: Math.floor(
      (new Date() - user.createdAt) / (1000 * 60 * 60 * 24)
    ),
  };

  res.json({
    success: true,
    data: stats,
  });
});
//
// // @desc    Get nearby users
// // @route   GET /api/users/nearby?lat=...&lon=...&distance=...
// // @access  Private

const getNearbyUsers = asyncHandler(async (req, res) => {
  const { latitude, longitude } = req.query;
  const userLat = parseFloat(latitude);
  const userLon = parseFloat(longitude);

  // VRAIE LOGIQUE
  const currentGeohash = geohash.encode(userLat, userLon, process.env.GEOHASH_PRECISION);
  // Les méthodes de geohashing sont nécessaires ------------------------


  // Mettre à jour la session
  const userSession = await UserSession.findOneAndUpdate(
    { userId: req.user._id },
    {
      userId: req.user._id,
      sessionId: `session_${req.user._id}`,
      lastKnownGeohash: currentGeohash,
      lat: userLat,
      lon: userLon,
      isActive: true,
      lastUpdated: new Date()
    },
    { upsert: true, new: true }
  );

  // Trouver les utilisateurs proches
  const nearbySessions = await UserSession.find({
    lastKnownGeohash: currentGeohash,
    isActive: true,
    userId: { $ne: req.user._id },
    lastUpdated: { $gte: new Date(Date.now() - 30 * 60 * 1000) }
  }).populate('userId', 'username profilePicture interests privacySettings');

  let nearbyUsers = [];

  if (nearbySessions.length > 0) {
    // Vrais utilisateurs
    nearbyUsers = nearbySessions.map(session => {
      const user = session.userId;
      
      //  Utiliser calculateDistance 
      const distanceInMeters = calculateDistance(userLat, userLon, session.lat, session.lon);
      const bearing = calculateBearing(userLat, userLon, session.lat, session.lon);
      
      const commonInterests = user.interests?.filter((interest) =>
       req.user.interests?.includes(interest)
      ) || [];

      return {
        _id: user._id,
        username: user.username,
        profilePicture: user.profilePicture,
        privacySettings:user.privacySettings,
        distance: Math.round(distanceInMeters), // Maintenant en mètres précis
        bearing: bearing, //  Angle 
        precision: { level: 7 , text: "dans votre rue", icon: "🚩" },
        interests: {
          common: [commonInterests],
          count: commonInterests.length
        },
        toSessionId: session.sessionId
      };
    });
  }

  res.status(200).json({
    success: true,
    data: {
      users: nearbyUsers,
      currentSessionId: userSession.sessionId,
      debug: {
        realUsers: nearbySessions.length
      }
    }
  });
});

const calculateProfileCompletion = (user) => {
  let completion = 0;
  const totalFields = 6;

  if (user.username) completion += 100 / totalFields;
  if (user.email) completion += 100 / totalFields;
  if (user.interests && user.interests.length > 0)
    completion += 100 / totalFields;
  if (user.profilePicture) completion += 100 / totalFields;
  if (user.bio) completion += 100 / totalFields;
  if (user.location && user.location.coordinates[0] !== 0)
    completion += 100 / totalFields;

  return Math.min(Math.round(completion), 100);
};

const updateLocation = asyncHandler(async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const userId = req.user._id;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude et longitude requises",
      });
    }

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    const currentGeohash = geohash.encode(lat,lon,process.env.GEOHASH_PRECISION)
    // Update session
    const session = await UserSession.findOneAndUpdate(
      { userId },
      {
        lastKnownGeohash: currentGeohash,
        lat: lat,
        lon: lon,
        isActive: true,
        lastUpdated: new Date(),
      },
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      message: "Position mise à jour",
      session: {
        lat: session.lat,
        lon: session.lon,
        isActive: session.isActive,
      },
    });
  } catch (error) {
    console.error("Update location error:", error);
    res.status(500).json({
      success: false,
      message: "Erreur mise à jour position",
    });
  }
});

// Helper function to calculate bearing
function calculateBearing(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => deg * (Math.PI / 180);
  const toDeg = (rad) => rad * (180 / Math.PI);

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);

  let bearing = (toDeg(θ) + 360) % 360;
  return Math.round(bearing);
}
function calculateDistance(lat1, lon1, lat2, lon2) {
  // VERSION HAUTE PRÉCISION (~1m)
  const R = 6371008.8; // Rayon terrestre moyen en mètres (IUGG)
  
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  
  // Formule de Haversine améliorée
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  return Math.round(distance); // 🔥 Arrondi au mètre près
}
console.log("✅ usersController chargé - getNearbyUsers:", typeof getNearbyUsers);

module.exports = {
  getUserProfile,
  updateUserProfile,
  getUserById,
  searchUsers,
  getUserConnections,
  addConnection,
  removeConnection,
  getUserStats,
  updateLocation,
  getAllUser,
  getNearbyUsers,
  getCurrentUser,
  addReward,
getExchangeRate,
generateStreamToken,
handleStreamWebhook
,initiateVideoCall
};