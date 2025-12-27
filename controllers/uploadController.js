const User = require("../models/User");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const asyncHandler = require("../middleware/asyncHandler");

// Configuration de multer pour le stockage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = "uploads/profiles/";
    // Créer le dossier s'il n'existe pas
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Générer un nom de fichier unique
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "profile-" + uniqueSuffix + path.extname(file.originalname));
  },
});

// Filtrage des fichiers
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Seules les images sont autorisées"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
});

// @desc    Upload profile picture
// @route   POST /api/upload/profile
// @access  Private
exports.uploadProfilePicture = [
  upload.single("image"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Aucun fichier uploadé",
      });
    }

    // Mettre à jour l'utilisateur avec le chemin de l'image
    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        profilePicture: `/uploads/profiles/${req.file.filename}`,
      },
      { new: true }
    ).select("-password");

    res.json({
      success: true,
      message: "Photo de profil uploadée avec succès",
      data: {
        profilePicture: user.profilePicture,
        fullUrl: `${req.protocol}://${req.get("host")}${user.profilePicture}`,
      },
    });
  }),
];

// @desc    Get uploaded file
// @route   GET /api/uploads/:filename
// @access  Public
exports.getFile = asyncHandler(async (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, "../uploads/profiles", filename);

  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({
      success: false,
      message: "Fichier non trouvé",
    });
  }
});
