const User = require("../models/User");
const UserSession = require("../models/UserSession");
const geohash = require("ngeohash");
const asyncHandler = require("../middleware/asyncHandler");

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
  const user = await User.findById(req.user.id)
    .select("-password")
    .populate("interests", "name");

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "Utilisateur non trouvé",
    });
  }

  res.json({
    success: true,
    data: user,
  });
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = asyncHandler(async (req, res) => {
  // CORRECTION ICI
  const { username, email, interests, bio, profilePicture, privacySettings } =
    req.body;

  const updateData = {};
  if (username) updateData.username = username;
  if (email) updateData.email = email;
  if (interests) updateData.interests = interests;
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
    .populate("interests", "name");

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
    .populate("interests", "name");

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
  const { latitude, longitude, distance = 5000 } = req.query;
  const userLat = parseFloat(latitude);
  const userLon = parseFloat(longitude);

  // ✅ VOTRE VRAIE LOGIQUE
  const currentGeohash = geohash.encode(userLat, userLon, 7);
  
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
  }).populate('userId', 'username profilePicture interests');

  let nearbyUsers = [];

  if (nearbySessions.length > 0) {
    // Vrais utilisateurs - ✅ CORRECTION ICI
    nearbyUsers = nearbySessions.map(session => {
      const user = session.userId;
      
      // 🔥 CORRECTION : Utiliser calculateDistance au lieu de calculateBearing
      const distanceInMeters = calculateDistance(userLat, userLon, session.lat, session.lon);
      const bearing = calculateBearing(userLat, userLon, session.lat, session.lon);
      
      const commonInterests = user.interests?.filter(interest =>
        req.user.interests?.includes(interest)
      ) || [];

      return {
        _id: user._id,
        username: user.username,
        profilePicture: user.profilePicture,
        distance: Math.round(distanceInMeters), // 🎯 Maintenant en mètres précis
        bearing: bearing, // 🧭 Angle correct
        precision: { level: 7, text: "dans votre rue", icon: "🚩" },
        interests: {
          common: commonInterests,
          count: commonInterests.length
        },
        toSessionId: session.sessionId
      };
    });
  }

  console.log(`✅ [getNearbyUsers] ${nearbyUsers.length} utilisateurs retournés`);

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

    // Update session
    const session = await UserSession.findOneAndUpdate(
      { userId },
      {
        lastKnownGeohash: geohash.encode(lat, lon, 7),
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
  getNearbyUsers  
};