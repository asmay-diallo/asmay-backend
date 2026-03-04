
const express = require("express");
const mongoose = require("mongoose");

const validateObjectId = (req, res, next) => {
  if (req.params.id && !mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: "ID invalide" });
  }
  next();
};

const router = express.Router();
const {
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
    handleStreamWebhook,
    initiateVideoCall
} = require("../controllers/usersController");

console.log(" Route users chargée - getNearbyUsers importé:", typeof getNearbyUsers);
const { protect } = require("../middleware/auth");

//  TOUTES LES ROUTES SONT PROTÉGÉES
router.use(protect);

// Routes existantes

// UNE SEULE FOIS chaque route
router.get("/nearby-users",protect, getNearbyUsers);
router.put("/location", protect,updateLocation);
router.route("/profile").get(protect,getUserProfile).put(protect,updateUserProfile);
router.get("/",protect,getAllUser);
router.get("/:id", validateObjectId, getUserById);
router.get("/search", protect,searchUsers);
router.route("/connections").get(getUserConnections);
router
  .route("/connections/:userId")
  .post(addConnection)
  .delete(removeConnection);
router.get("/stats", getUserStats);
// Route pour créditer une récompense (sécurisée)
router.post('/me/rewards', protect, addReward);
// Route pour obtenir le profil utilisateur (avec coins)
router.get('/me', protect, getCurrentUser);
router.get('/exchange',protect,getExchangeRate)
// 🔐 Route protégée : seul un user connecté peut avoir un token
router.get('/stream-token', protect, generateStreamToken);

// 🌐 Route pour les webhooks Stream (peut nécessiter une validation différente)
router.post('/webhook', handleStreamWebhook);
router.post('/initiate-call', protect, initiateVideoCall);

module.exports = router;
