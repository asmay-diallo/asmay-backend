const User = require("../models/User");
const UserSession = require("../models/UserSession");
const geohash = require("ngeohash");
const geocodingService = require('../services/geocodingService');

const jwt = require('jsonwebtoken');
// const {StreamChat}  = require('stream-chat');
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

// Like an online User
// @route PATCH /api/users/onlineLike/:likedUserId
// @access Private 

const likeOnlineUser = asyncHandler(async (req, res) => {
  const likerUserId = req.user._id;
  const likedUserId = req.params.likedUserId; 
  
  try {
    // Vérifier que l'utilisateur existe
    const userLiked = await User.findById(likedUserId);
    if (!userLiked) {
      return res.status(404).json({
        success: false,
        message: "Utilisateur non trouvé"
      });
    }

    // Vérifier qu'on ne se like pas soi-même
    if (likerUserId.toString() === likedUserId) {
      return res.status(400).json({
        success: false,
        message: "Vous ne pouvez pas vous liker vous-même"
      });
    }

    // Mettre à jour l'utilisateur liké
    const updatedUser = await User.findByIdAndUpdate(
      likedUserId,
      {
        $addToSet: { likers: likerUserId }
      },
      { new: true }
    );

    // Notifier en temps réel via socket
    const io = req.app.get('io');
    if (io) {
      const socketService = require("../services/socketServices");
      
      const isUserOnline = socketService.isUserOnline(likedUserId.toString());
      
      if (isUserOnline) {
        const likerUser = await User.findById(likerUserId).select('username profilePicture');
        socketService.notifyLikedUserOnline(io, updatedUser, likerUser);
        console.log("🚀Notification est envoyé maintenant ");
        
      }
    }

    return res.status(200).json({
      success: true,
      message: "User liké avec succès",
      data: updatedUser
    });
    
  } catch (error) {
    console.error("Error to like this user:", error);
    return res.status(500).json({
      success: false,
      message: "Erreur lors du like",
      error: error.message
    });
  }
});
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
}); 
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
// 
// const getNearbyUsers = asyncHandler(async (req, res) => {
//   const { latitude, longitude } = req.query;
//   const userLat = parseFloat(latitude);
//   const userLon = parseFloat(longitude);
// 
//   // VRAIE LOGIQUE
//   const currentGeohash = geohash.encode(userLat, userLon, process.env.GEOHASH_PRECISION);
//   // Les méthodes de geohashing sont nécessaires ------------------------
// 
// 
//   // Mettre à jour la session
//   const userSession = await UserSession.findOneAndUpdate(
//     { userId: req.user._id },
//     {
//       userId: req.user._id,
//       sessionId: `session_${req.user._id}`,
//       lastKnownGeohash: currentGeohash,
//       lat: userLat,
//       lon: userLon,
//       isActive: true,
//       lastUpdated: new Date()
//     },
//     { upsert: true, new: true }
//   );
// 
//   // Trouver les utilisateurs proches
//   const nearbySessions = await UserSession.find({
//     lastKnownGeohash: currentGeohash,
//     isActive: true,
//     userId: { $ne: req.user._id },
//     lastUpdated: { $gte: new Date(Date.now() - 30 * 60 * 1000) }
//   }).populate('userId', 'username profilePicture interests privacySettings');
// 
//   let nearbyUsers = [];
// 
//   if (nearbySessions.length > 0) {
//     // Vrais utilisateurs
//     nearbyUsers = nearbySessions.map(session => {
//       const user = session.userId;
//       
//       //  Utiliser calculateDistance 
//       const distanceInMeters = calculateDistance(userLat, userLon, session.lat, session.lon);
//       const bearing = calculateBearing(userLat, userLon, session.lat, session.lon);
//       
//       const commonInterests = user.interests?.filter((interest) =>
//        req.user.interests?.includes(interest)
//       ) || [];
// 
//       return {
//         _id: user._id,
//         username: user.username,
//         profilePicture: user.profilePicture,
//         privacySettings:user.privacySettings,
//         distance: Math.round(distanceInMeters), // Maintenant en mètres précis
//         bearing: bearing, //  Angle 
//         precision: { level: 7 , text: "dans votre rue", icon: "🚩" },
//         interests: {
//           common: [commonInterests],
//           count: commonInterests.length
//         },
//         toSessionId: session.sessionId
//       };
//     });
//   }
// 
//   res.status(200).json({
//     success: true,
//     data: {
//       users: nearbyUsers,
//       currentSessionId: userSession.sessionId,
//       debug: {
//         realUsers: nearbySessions.length
//       }
//     }
//   });
// });

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

// const updateLocation = asyncHandler(async (req, res) => {
//   try {
//     const { latitude, longitude } = req.body;
//     const userId = req.user._id;
// 
//     if (!latitude || !longitude) {
//       return res.status(400).json({
//         success: false,
//         message: "Latitude et longitude requises",
//       });
//     }
// 
//     const lat = parseFloat(latitude);
//     const lon = parseFloat(longitude);
//     const currentGeohash = geohash.encode(lat,lon,process.env.GEOHASH_PRECISION)
//     // Update session
//     const session = await UserSession.findOneAndUpdate(
//       { userId },
//       {
//         lastKnownGeohash: currentGeohash,
//         lat: lat,
//         lon: lon,
//         isActive: true,
//         lastUpdated: new Date(),
//       },
//       { new: true, upsert: true }
//     );
// 
//     res.json({
//       success: true,
//       message: "Position mise à jour",
//       session: {
//         lat: session.lat,
//         lon: session.lon,
//         isActive: session.isActive,
//       },
//     });
//   } catch (error) {
//     console.error("Update location error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Erreur mise à jour position",
//     });
//   }
// });
// const getNearbyUsers = asyncHandler(async (req, res) => {
//   const { latitude, longitude } = req.query;
//   const userLat = parseFloat(latitude);
//   const userLon = parseFloat(longitude);
//   
//   // Configuration
//   const TARGET_USER_COUNT = 50; // Nombre d'utilisateurs souhaité
//   const MAX_LEVEL = 7; // Niveau le plus précis (rue)
//   const MIN_LEVEL = 1; // Niveau le plus large (continent)
// 
//   // 1. Mettre à jour la session utilisateur (toujours avec précision 7)
//   const currentGeohash = geohash.encode(userLat, userLon, process.env.GEOHASH_PRECISION);
//   
//   const userSession = await UserSession.findOneAndUpdate(
//     { userId: req.user._id },
//     {
//       userId: req.user._id,
//       sessionId: `session_${req.user._id}`,
//       lastKnownGeohash: currentGeohash,
//       lat: userLat,
//       lon: userLon,
//       isActive: true,
//       lastUpdated: new Date()
//     },
//     { upsert: true, new: true }
//   );
// 
//   // 2. Recherche progressive
//   let nearbySessions = [];
//   let currentLevel = 7; // Commence par le niveau le plus précis (rue)
//   let geohashPrefix;
//   
//   while (nearbySessions.length < TARGET_USER_COUNT && currentLevel >= MIN_LEVEL) {
//     // Construire le geohash avec la précision actuelle
//     geohashPrefix = geohash.encode(userLat, userLon, currentLevel);
//     
//     console.log(`🔍 Recherche niveau ${currentLevel}: ${geohashPrefix}`);
//     
//     // Rechercher les utilisateurs avec ce préfixe
//     const query = {
//       isActive: true,
//       userId: { $ne: req.user._id },
//       lastUpdated: { $gte: new Date(Date.now() - 30 * 60 * 1000) } // 30 min
//     };
//     
//     // Si ce n'est pas le niveau le plus bas (monde), ajouter le filtre geohash
//     if (currentLevel > 1) {
//       query.lastKnownGeohash = { $regex: `^${geohashPrefix}` };
//     }
//     // Niveau 1 = continent, pas de filtre pour le monde entier
//     
//     const sessions = await UserSession.find(query)
//       .populate('userId', 'username profilePicture interests privacySettings location')
//       .limit(TARGET_USER_COUNT * 2); // Limite pour performance
//     
//     nearbySessions = sessions;
//     
//     // Si pas assez d'utilisateurs, élargir au niveau supérieur
//     if (nearbySessions.length < TARGET_USER_COUNT) {
//       currentLevel--;
//       console.log(`📊 Seulement ${nearbySessions.length} trouvés, élargissement au niveau ${currentLevel}`);
//     }
//   }
// 
//   // 3. Si toujours pas assez, prendre tous les utilisateurs actifs
//   if (nearbySessions.length < 10) {
//     console.log("🌍 Pas assez d'utilisateurs proches, recherche dans le monde entier");
//     nearbySessions = await UserSession.find({
//       isActive: true,
//       userId: { $ne: req.user._id },
//       lastUpdated: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // 1 heure
//     })
//     .populate('userId', 'username profilePicture interests privacySettings location')
//     .limit(TARGET_USER_COUNT);
//     
//     currentLevel = 0; // Niveau "monde"
//   }
// 
//   // 4. Transformer les résultats
//   let nearbyUsers = [];
// 
//   if (nearbySessions.length > 0) {
//     nearbyUsers = nearbySessions.map(session => {
//       const user = session.userId;
//       
//       const distanceInMeters = calculateDistance(
//         userLat, userLon, 
//         session.lat, session.lon
//       );
//       
//       const bearing = calculateBearing(
//         userLat, userLon, 
//         session.lat, session.lon
//       );
//       
//       const commonInterests = user.interests?.filter((interest) =>
//         req.user.interests?.includes(interest)
//       ) || [];
// 
//       // Déterminer le libellé de précision selon le niveau atteint
//       let precisionText = "";
//       let precisionIcon = "";
//       let precisionLevel = "";
//       
//       switch(currentLevel) {
//         case 7:
//           precisionText = "dans votre rue";
//           precisionIcon = "🚶";
//           precisionLevel = "Rue";
//           break;
//         case 6:
//           precisionText = "dans votre quartier";
//           precisionIcon = "🏘️";
//           precisionLevel = "Quartier";
//           break;
//         case 5:
//           precisionText = "à proximité";
//           precisionIcon = "🚲";
//           precisionLevel = "Proximité";
//           break;
//         case 4:
//           precisionText = "dans votre ville";
//           precisionIcon = "🏙️";
//           precisionLevel = "Ville";
//           break;
//         case 3:
//           precisionText = "dans votre région";
//           precisionIcon = "🗺️";
//           precisionLevel = "Région";
//           break;
//         case 2:
//           precisionText = "dans votre pays";
//           precisionIcon = "🌍";
//           precisionLevel = "Pays";
//           break;
//         case 1:
//           precisionText = "sur votre continent";
//           precisionIcon = "🌎";
//           precisionLevel = "Continent";
//           break;
//         default:
//           precisionText = "dans le monde";
//           precisionIcon = "🌏";
//           precisionLevel = "Monde";
//       }
// 
//       return {
//         _id: user._id,
//         username: user.username,
//         profilePicture: user.profilePicture,
//         privacySettings: user.privacySettings,
//         distance: Math.round(distanceInMeters),
//         bearing: bearing,
//         precision: {
//           level: currentLevel,
//           name: precisionLevel,
//           text: precisionText,
//           icon: precisionIcon
//         },
//         interests: {
//           common: commonInterests,
//           count: commonInterests.length
//         },
//         toSessionId: session.sessionId,
//         lastActive: session.lastUpdated
//       };
//     });
//   }
// 
//   // 5. Trier par distance (les plus proches d'abord)
//   nearbyUsers.sort((a, b) => a.distance - b.distance);
// 
//   // 6. Réponse
//   res.status(200).json({
//     success: true,
//     data: {
//       users: nearbyUsers,
//       currentSessionId: userSession.sessionId,
//       searchLevel: currentLevel,
//       searchLevelName: currentLevel === 0 ? "Monde" : 
//                        currentLevel === 1 ? "Continent" :
//                        currentLevel === 2 ? "Pays" :
//                        currentLevel === 3 ? "Région" :
//                        currentLevel === 4 ? "Ville" :
//                        currentLevel === 5 ? "Proximité" :
//                        currentLevel === 6 ? "Quartier" : "Rue",
//       totalFound: nearbyUsers.length,
//       targetCount: TARGET_USER_COUNT,
//       debug: {
//         userPosition: { lat: userLat, lon: userLon },
//         startGeohash: currentGeohash,
//         finalPrefix: geohashPrefix
//       }
//     }
//   });
// });

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
    
    // 🔧 CORRECTION 1: Utiliser la même précision partout
    const precision = parseInt(process.env.GEOHASH_PRECISION) || 7;
    const currentGeohash = geohash.encode(lat, lon, precision);
    
    // 🔧 CORRECTION 2: Ajouter locationHistory pour tracer les changements
    const session = await UserSession.findOneAndUpdate(
      { userId },
      {
        lastKnownGeohash: currentGeohash,
        lat: lat,
        lon: lon,
        isActive: true,
        lastUpdated: new Date(),
        $push: {
          locationHistory: {
            // oldGeohash: session?.lastKnownGeohash,
            newGeohash: currentGeohash,
            changedAt: new Date(),
            reason: 'user_update'
          }
        }
      },
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      message: "Position mise à jour",
      session: {
        lat: session.lat,
        lon: session.lon,
        geohash: session.lastKnownGeohash,
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


const getNearbyUsers = asyncHandler(async (req, res) => {
  const { latitude, longitude } = req.query;
  
  if (!latitude || !longitude) {
    return res.status(400).json({
      success: false,
      message: "Latitude et longitude requises"
    });
  }

  const userLat = parseFloat(latitude);
  const userLon = parseFloat(longitude);
  const precision = parseInt(process.env.GEOHASH_PRECISION) || 7;
  
  // Configuration
  const TARGET_USER_COUNT = 50;
  const MIN_LEVEL = 1;

  // 1. Mettre à jour la session utilisateur
  const currentGeohash = geohash.encode(userLat, userLon, precision);
  
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

  // 2. Recherche progressive
  let nearbySessions = [];
  let currentLevel = precision;
  let finalPrefix = '';
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  while (nearbySessions.length < TARGET_USER_COUNT && currentLevel >= MIN_LEVEL) {
    finalPrefix = geohash.encode(userLat, userLon, currentLevel);
    
    console.log(`🔍 Recherche niveau ${currentLevel}: ${finalPrefix}`);
    
    const query = {
      isActive: true,
      userId: { $ne: req.user._id },
      lastUpdated: { $gte: thirtyMinutesAgo }
    };
    
    if (currentLevel > 1) {
      query.lastKnownGeohash = { 
        $regex: `^${finalPrefix}`,
        $exists: true 
      };
    }
    
    nearbySessions = await UserSession.find(query)
      .populate('userId', 'username profilePicture interests privacySettings')
      .limit(TARGET_USER_COUNT * 10);
    
    if (nearbySessions.length < TARGET_USER_COUNT) {
      currentLevel--;
    }
  }

  // 3. Fallback monde entier
  if (nearbySessions.length < 10) {
    console.log("🌍 Recherche dans le monde entier");
    nearbySessions = await UserSession.find({
      isActive: true,
      userId: { $ne: req.user._id },
      lastUpdated: { $gte: oneHourAgo }
    })
    .populate('userId', 'username profilePicture interests privacySettings')
    .limit(TARGET_USER_COUNT);
    
    currentLevel = 0;
  }

  // ==================== CONFIGURATION ====================
  
  const levelConfig = {
    7: { text: "dans votre rue", icon: "🚶", name: "Rue" },
    6: { text: "dans votre quartier", icon: "🏘️", name: "Quartier" },
    5: { text: "à proximité", icon: "🚲", name: "Proximité" },
    4: { text: "dans votre ville", icon: "🏙️", name: "Ville" },
    3: { text: "dans votre région", icon: "🗺️", name: "Région" },
    2: { text: "dans votre pays", icon: "🌍", name: "Pays" },
    1: { text: "sur votre continent", icon: "🌎", name: "Continent" },
    0: { text: "dans le monde", icon: "🌏", name: "Monde" }
  };

  //  Obtient le NOM EXACT du lieu via géocodage
  const getExactPlaceName = async (session, distance) => {
    if (!session.lat || !session.lon) {
      return { text: "Position inconnue", icon: "📍" };
    }

    try {
      // Appel au service de géocodage (avec cache)
      const locationDetails = await geocodingService.reverseGeocode(
        session.lat,
        session.lon,
        session.lastKnownGeohash?.length || 7
      );
      
      // Définir l'icône en fonction de la distance
      let icon = "📍";
      if (distance < 500) icon = "🚶";
      else if (distance < 3000) icon = "🏘️";
      else if (distance < 10000) icon = "🏙️";
      else if (distance < 50000) icon = "🗺️";
      else if (distance < 500000) icon = "🌍";
      else icon = "🌏";

      //  STRATÉGIE DE NOMMAGE : Toujours le nom le plus précis disponible
      let displayText = "";

      // Priorité 1: Nom de la rue (si très proche ou disponible)
      if (locationDetails.address.road) {
        displayText = locationDetails.address.road;
      }
      // Priorité 2: Nom du quartier
      else if (locationDetails.address.neighbourhood || locationDetails.address.suburb) {
        displayText = locationDetails.address.neighbourhood || locationDetails.address.suburb;
      }
      // Priorité 3: Nom de la ville
      else if (locationDetails.address.city || locationDetails.address.town || locationDetails.address.village) {
        displayText = locationDetails.address.city || locationDetails.address.town || locationDetails.address.village;
      }
      // Priorité 4: Nom de la région
      else if (locationDetails.address.state) {
        displayText = locationDetails.address.state;
      }
      // Priorité 5: Nom du pays
      else if (locationDetails.address.country) {
        displayText = locationDetails.address.country;
      }
      // Priorité 6: Court nom par défaut
      else {
        displayText = locationDetails.shortName || "Lieu inconnu";
      }
    const address = locationDetails.address
    const displayName = locationDetails.displayName
    const type = locationDetails.type
    const shortName = locationDetails.shortName

      return {
        text: displayText,
        icon: icon,
        details:{
           address:address,
           displayName:displayName,
           shortName:shortName,
           type:type
        }
      };

    } catch (error) {
      console.error("❌ Erreur géocodage:", error.message);
      
      // Fallback: texte basé sur la distance
      let fallbackText = "";
      if (distance < 500) fallbackText = "Dans votre rue";
      else if (distance < 3000) fallbackText = "Dans votre quartier";
      else if (distance < 10000) fallbackText = "Dans votre ville";
      else if (distance < 50000) fallbackText = "Dans votre région";
      else if (distance < 500000) fallbackText = "Dans votre pays";
      else fallbackText = "Dans le monde";

      return {
        text: fallbackText,
        icon: "📍",
        fallback: true
      };
    }
  };

  // ==================== MAPPING DES UTILISATEURS ====================
  
  const nearbyUsers = await Promise.all(nearbySessions.map(async session => {
    const user = session.userId;
    
    // Vérifier la cohérence du geohash
    if (session.lat && session.lon) {
      const expectedGeohash = geohash.encode(session.lat, session.lon, precision);
      if (session.lastKnownGeohash !== expectedGeohash) {
        console.log(`⚠️ Incohérence détectée pour user ${user._id}`);
        session.lastKnownGeohash = expectedGeohash;
        await session.save();
      }
    }
    
    // Calculs de distance
    const distanceInMeters = calculateDistance(
      userLat, userLon, 
      session.lat, session.lon
    );
    
    const bearing = calculateBearing(
      userLat, userLon, 
      session.lat, session.lon
    );
    
    const commonInterests = user.interests?.filter(interest =>
      req.user.interests?.includes(interest)
    ) || [];

    const userLevel = session.lastKnownGeohash?.length || currentLevel;
    
    // Utilisation du géocodage pour obtenir le NOM EXACT du lieu
    const placeInfo = await getExactPlaceName(session, distanceInMeters);
    const geohashPrecision = levelConfig[userLevel] || levelConfig[0];

    return {
      _id: user._id,
      username: user.username,
      profilePicture: user.profilePicture,
      privacySettings: user.privacySettings,
      distance: Math.round(distanceInMeters),
      bearing: bearing,
      precision: {
        text: placeInfo.text,
        icon: placeInfo.icon,
        type:placeInfo.details.type,
        fullName:placeInfo.details.displayName,
        shortName:placeInfo.details.shortName,
        geohash: session.lastKnownGeohash,
        level: userLevel,
      },
      interests: {
        common: commonInterests,
        count: commonInterests.length
      },
      toSessionId: session.sessionId,
      lastActive: session.lastUpdated,
      isOnline: (Date.now() - new Date(session.lastUpdated).getTime()) < 5 * 60 * 1000
    };
  }));

  // ==================== TRI ET STATISTIQUES ====================
  
  nearbyUsers.sort((a, b) => a.distance - b.distance);

  // Statistiques
  const stats = {
    byLevel: {},
    totalDistance: nearbyUsers.reduce((acc, u) => acc + u.distance, 0),
    averageDistance: Math.round(nearbyUsers.reduce((acc, u) => acc + u.distance, 0) / nearbyUsers.length) || 0,
    online: nearbyUsers.filter(u => u.isOnline).length
  };
  
  nearbyUsers.forEach(u => {
    const level = u.precision.level;
    stats.byLevel[level] = (stats.byLevel[level] || 0) + 1; 
  });

  const getSearchLevelName = (level) => {
    if (level === 7) return "Recherche rue";
    if (level === 6) return "Recherche quartier";
    if (level === 5) return "Recherche proximité";
    if (level === 4) return "Recherche ville";
    if (level === 3) return "Recherche région";
    if (level === 2) return "Recherche pays";
    if (level === 1) return "Recherche continent";
    return "Recherche monde";
  };

  // ==================== RÉPONSE ====================
  
  res.status(200).json({
    success: true,
    data: {
      users: nearbyUsers,
      currentSessionId: userSession.sessionId,
      search: {
        level: currentLevel,
        name: getSearchLevelName(currentLevel)
      },
      totals: {
        found: nearbyUsers.length,
        target: TARGET_USER_COUNT,
        online: stats.online
      },
      stats: {
        byLevel: stats.byLevel,
        averageDistance: stats.averageDistance
      },
      debug: process.env.NODE_ENV === 'development' ? {
        userPosition: { lat: userLat, lon: userLon },
        cacheStats: geocodingService.getCacheStats()
      } : undefined
    }
  });
});
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
  likeOnlineUser,
  getNearbyUsers,
  getCurrentUser,
  addReward,
getExchangeRate
};