const User = require("../models/User");
const UserSession = require("../models/UserSession");
const geohash = require("ngeohash");
const jwt = require('jsonwebtoken');
// const {StreamChat}  = require('stream-chat');
const asyncHandler = require("../middleware/asyncHandler");

// Initialiser le client Stream SERVEUR
// const streamServerClient =new StreamChat(
//   process.env.STREAM_API_KEY,   
//   process.env.STREAM_API_SECRET,
//  {
//     timeout: 3000,
//     logger: (type, msg) => console.log(`[Stream] ${type}: ${msg}`)
//   }
// );

// 🛡️ DICTIONNAIRE DES RÉCOMPENSES (SECRET SERVEUR)
const REWARD_VALUES = {
  'WATCH_REWARDED_AD': 10,    // 10 coins pour une pub
  'SIGNUP_BONUS': 50,         // Bonus d'inscription
  'REFERRAL_BONUS': 25        // Parrainage
};
// Configuration du taux (1 coin = 0.0001 USD par défaut)
const COIN_EXCHANGE_RATE = 0.0001; // 10000 coins = 1 USD

let StreamChat;
try {
  // Essayer différentes méthodes d'import
  const streamModule = require('stream-chat')
  
  if (streamModule.StreamChat) {
    StreamChat = streamModule.StreamChat;
    console.log('✅ StreamChat importé comme propriété');
  } else if (streamModule.default) {
    StreamChat = streamModule.default;
    console.log('✅ StreamChat importé comme default');
  } else if (typeof streamModule === 'function') {
    StreamChat = streamModule;
    console.log('✅ Module entier est StreamChat');
  } else {
    throw new Error('Format d\'import non reconnu');
  }
} catch (error) {
  console.error('❌ Erreur import stream-chat:', error);
  throw error;
}

// Initialisation sécurisée
let streamServerClient;

try {
  // Essayer getInstance d'abord
  if (typeof StreamChat.getInstance === 'function') {
    streamServerClient = StreamChat.getInstance(
      process.env.STREAM_API_KEY,
      process.env.STREAM_API_SECRET
    );
    console.log('✅ Client créé avec getInstance()');
  } 
  // Sinon essayer avec new
  else if (typeof StreamChat === 'function') {
    streamServerClient = new StreamChat(
      process.env.STREAM_API_KEY,
      process.env.STREAM_API_SECRET,
      {
        timeout: 10000,
        logger: (type, msg) => console.log(`[Stream] ${type}: ${msg}`)
      }
    );
    console.log('✅ Client créé avec new StreamChat()');
  } else {
    throw new Error('Impossible d\'initialiser StreamChat');
  }
} catch (error) {
  console.error('❌ Erreur initialisation StreamChat:', error);
  // Continuer sans Stream (pour le dev)
  streamServerClient = null;
}

// 🔐 Route corrigée pour générer le token
const generateStreamToken = asyncHandler(async (req, res) => {
  try {
    // Vérifier que le client Stream est initialisé
    if (!streamServerClient) {
      console.error('❌ streamServerClient non initialisé');
      return res.status(500).json({
        success: false,
        message: 'Service Stream non disponible'
      });
    }

    const userId = req.user._id.toString();
    console.log('🎥 Génération token Stream pour:', userId);
    
    // 1. S'assurer que l'utilisateur existe dans Stream
    await streamServerClient.upsertUser({
      id: userId,
      name: req.user.username || 'Utilisateur',
      image: req.user.profilePicture || '',
      // Autres champs optionnels
    });
    
    // 2. Générer le token
    const token = streamServerClient.createToken(userId);
    
    // 3. Format de réponse attendu par le frontend
    res.status(200).json({
      success: true,
      data: {
        token: token,
        streamUser: {
          id: userId,
          name: req.user.username,
          image: req.user.profilePicture || '',
          // Le SDK frontend peut avoir besoin de ces champs
          role: 'user'
        }
      }
    });
    
    console.log('✅ Token Stream généré avec succès');
    
  } catch (error) {
    console.error('❌ Erreur génération token Stream:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération du token vidéo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

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
//  Générer un token Stream pour l'utilisateur connecté
// const generateStreamToken = asyncHandler(async (req, res) => {
//   try {
//     console.log('🔐 [STREAM TOKEN] Génération pour user:', req.user._id);
//     
//     // 1. Vérifiez que l'utilisateur existe dans Stream
//     // Optionnel: créer l'utilisateur s'il n'existe pas
//     await streamServerClient.upsertUser({
//       id: req.user._id.toString(),
//       name: req.user.username,
//       profilePicture: req.user.profilePicture || '',
//       // Autres champs si besoin
//     });
//     
//     // 2. Générez le token Stream AVEC LE SDK
//     const streamToken = streamServerClient.createToken(req.user._id.toString());
//     
//     // 3. Format de réponse que Stream Video SDK attend
//     res.status(200).json({
//       success: true,
//       data: {
//         token: streamToken, // ← Token généré par Stream SDK
//         streamUser: {
//           id: req.user._id.toString(),
//           name: req.user.username,
//           image: req.user.profilePicture || '',
//           // Stream attend ces champs spécifiques
//         }
//       }
//     });
//     
//     console.log('✅ Token Stream généré avec succès');
//     
//   } catch (error) {
//     console.error('❌ Erreur génération token Stream:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Erreur génération token Stream',
//       error: process.env.NODE_ENV === 'development' ? error.message : undefined
//     });
//   }
// });
// const generateStreamToken = asyncHandler(async (req, res) => {
//   try {
//     // Votre middleware `protect` a déjà vérifié l'auth et mis `req.user`
//     const userId = req.user._id.toString();
//     // const userName = req.user.username;
// 
//     // 1. Créer le payload JWT pour Stream
//     const payload = {
//       user_id: userId, // DOIT correspondre à l'id de l'utilisateur ASMAY
//       // Stream permet d'ajouter des claims custom si besoin
//     };
// 
//     // 2. Signer avec votre SECRET_KEY Stream (à ajouter dans .env)
//     const token = jwt.sign(payload, process.env.STREAM_SECRET_KEY, {
//       expiresIn: '1h', // Token de courte durée
//       algorithm: 'HS256',
//     });
// 
//     // 3. Retourner le token ET les infos utilisateur formatées pour Stream
//     res.status(200).json({
//       success: true,
//       data: {
//         token: token,
//         streamUser: {
//           id: userId,
//           username: req.user.username,
//           profilePicture: req.user.profilePicture || '', 
//           interests:req.user.interests
//         },
//       },
//     });
// 
//   } catch (error) {
//     console.error('❌ Erreur génération token Stream:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Erreur lors de la génération du token vidéo',
//     });
//   }
// });

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
const getNearbyUsers = asyncHandler(async (req, res) => {
  const { latitude, longitude } = req.query;
  const userLat = parseFloat(latitude);
  const userLon = parseFloat(longitude);
  
  // Configuration
  const TARGET_USER_COUNT = 50; // Nombre d'utilisateurs souhaité
  const MAX_LEVEL = 7; // Niveau le plus précis (rue)
  const MIN_LEVEL = 1; // Niveau le plus large (continent)

  // 1. Mettre à jour la session utilisateur (toujours avec précision 7)
  const currentGeohash = geohash.encode(userLat, userLon, 7);
  
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
  let currentLevel = 7; // Commence par le niveau le plus précis (rue)
  let geohashPrefix;
  
  while (nearbySessions.length < TARGET_USER_COUNT && currentLevel >= MIN_LEVEL) {
    // Construire le geohash avec la précision actuelle
    geohashPrefix = geohash.encode(userLat, userLon, currentLevel);
    
    console.log(`🔍 Recherche niveau ${currentLevel}: ${geohashPrefix}`);
    
    // Rechercher les utilisateurs avec ce préfixe
    const query = {
      isActive: true,
      userId: { $ne: req.user._id },
      lastUpdated: { $gte: new Date(Date.now() - 30 * 60 * 1000) } // 30 min
    };
    
    // Si ce n'est pas le niveau le plus bas (monde), ajouter le filtre geohash
    if (currentLevel > 1) {
      query.lastKnownGeohash = { $regex: `^${geohashPrefix}` };
    }
    // Niveau 1 = continent, pas de filtre pour le monde entier
    
    const sessions = await UserSession.find(query)
      .populate('userId', 'username profilePicture interests privacySettings location')
      .limit(TARGET_USER_COUNT * 2); // Limite pour performance
    
    nearbySessions = sessions;
    
    // Si pas assez d'utilisateurs, élargir au niveau supérieur
    if (nearbySessions.length < TARGET_USER_COUNT) {
      currentLevel--;
      console.log(`📊 Seulement ${nearbySessions.length} trouvés, élargissement au niveau ${currentLevel}`);
    }
  }

  // 3. Si toujours pas assez, prendre tous les utilisateurs actifs
  if (nearbySessions.length < 10) {
    console.log("🌍 Pas assez d'utilisateurs proches, recherche dans le monde entier");
    nearbySessions = await UserSession.find({
      isActive: true,
      userId: { $ne: req.user._id },
      lastUpdated: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // 1 heure
    })
    .populate('userId', 'username profilePicture interests privacySettings location')
    .limit(TARGET_USER_COUNT);
    
    currentLevel = 0; // Niveau "monde"
  }

  // 4. Transformer les résultats
  let nearbyUsers = [];

  if (nearbySessions.length > 0) {
    nearbyUsers = nearbySessions.map(session => {
      const user = session.userId;
      
      const distanceInMeters = calculateDistance(
        userLat, userLon, 
        session.lat, session.lon
      );
      
      const bearing = calculateBearing(
        userLat, userLon, 
        session.lat, session.lon
      );
      
      const commonInterests = user.interests?.filter((interest) =>
        req.user.interests?.includes(interest)
      ) || [];

      // Déterminer le libellé de précision selon le niveau atteint
      let precisionText = "";
      let precisionIcon = "";
      let precisionLevel = "";
      
      switch(currentLevel) {
        case 7:
          precisionText = "dans votre rue";
          precisionIcon = "🚶";
          precisionLevel = "Rue";
          break;
        case 6:
          precisionText = "dans votre quartier";
          precisionIcon = "🏘️";
          precisionLevel = "Quartier";
          break;
        case 5:
          precisionText = "à proximité";
          precisionIcon = "🚲";
          precisionLevel = "Proximité";
          break;
        case 4:
          precisionText = "dans votre ville";
          precisionIcon = "🏙️";
          precisionLevel = "Ville";
          break;
        case 3:
          precisionText = "dans votre région";
          precisionIcon = "🗺️";
          precisionLevel = "Région";
          break;
        case 2:
          precisionText = "dans votre pays";
          precisionIcon = "🌍";
          precisionLevel = "Pays";
          break;
        case 1:
          precisionText = "sur votre continent";
          precisionIcon = "🌎";
          precisionLevel = "Continent";
          break;
        default:
          precisionText = "dans le monde";
          precisionIcon = "🌏";
          precisionLevel = "Monde";
      }

      return {
        _id: user._id,
        username: user.username,
        profilePicture: user.profilePicture,
        privacySettings: user.privacySettings,
        distance: Math.round(distanceInMeters),
        bearing: bearing,
        precision: {
          level: currentLevel,
          name: precisionLevel,
          text: precisionText,
          icon: precisionIcon
        },
        interests: {
          common: commonInterests,
          count: commonInterests.length
        },
        toSessionId: session.sessionId,
        lastActive: session.lastUpdated
      };
    });
  }

  // 5. Trier par distance (les plus proches d'abord)
  nearbyUsers.sort((a, b) => a.distance - b.distance);

  // 6. Réponse
  res.status(200).json({
    success: true,
    data: {
      users: nearbyUsers,
      currentSessionId: userSession.sessionId,
      searchLevel: currentLevel,
      searchLevelName: currentLevel === 0 ? "Monde" : 
                       currentLevel === 1 ? "Continent" :
                       currentLevel === 2 ? "Pays" :
                       currentLevel === 3 ? "Région" :
                       currentLevel === 4 ? "Ville" :
                       currentLevel === 5 ? "Proximité" :
                       currentLevel === 6 ? "Quartier" : "Rue",
      totalFound: nearbyUsers.length,
      targetCount: TARGET_USER_COUNT,
      debug: {
        userPosition: { lat: userLat, lon: userLon },
        startGeohash: currentGeohash,
        finalPrefix: geohashPrefix
      }
    }
  });
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