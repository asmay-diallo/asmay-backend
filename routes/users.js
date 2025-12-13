
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
} = require("../controllers/usersController");

console.log("✅ Route users chargée - getNearbyUsers importé:", typeof getNearbyUsers);
const { protect } = require("../middleware/auth");

// ✅ TOUTES LES ROUTES SONT PROTÉGÉES
router.use(protect);

// Routes existantes

// ✅ CORRECTION - UNE SEULE FOIS chaque route
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


module.exports = router;
