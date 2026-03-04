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

// Stockage pour les messages vocaux
const voiceStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = "uploads/voice_messages/";
    // Créer le dossier s'il n'existe pas
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Générer un nom unique avec timestamp et ID utilisateur
    const userId = req.user ? req.user.id : 'anonymous';
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `voice_${userId}_${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

// Filtrage pour les fichiers audio uniquement
const voiceFileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'audio/mpeg',    // mp3
    'audio/mp4',     // m4a, mp4
    'audio/aac',     // aac
    'audio/x-m4a',   // m4a
    'audio/wav',     // wav
    'audio/x-wav',   // wav
    'audio/ogg',     // ogg
    'audio/webm',    // webm
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Seuls les fichiers audio sont autorisés (MP3, M4A, AAC, WAV)"), false);
  }
};

// Instance Multer pour les messages vocaux
const uploadVoice = multer({
  storage: voiceStorage,
  fileFilter: voiceFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max (augmenté pour les messages vocaux)
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
        profilePicture: `${req.protocol}://${req.get("host")}/uploads/profiles/${req.file.filename}`,
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

// @desc    Upload un message vocal
// @route   POST /api/uploads/voice/:chatId
// @access  Private
exports.uploadVoiceMessage = [
  uploadVoice.single("audio"), // Le champ doit s'appeler "audio"
  asyncHandler(async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Aucun fichier audio reçu",
        });
      }

      // Vérifier que la durée est fournie
      const duration = req.body.duration;
      if (!duration) {
        return res.status(400).json({
          success: false,
          message: "La durée du message vocal est requise",
        });
      }

      // Chemin relatif du fichier
      const filePath = `/uploads/voice_messages/${req.file.filename}`;
      
      // URL complète pour l'accès
      const fullUrl = `${req.protocol}://${req.get("host")}${filePath}`;
      
      console.log(`🎤 Message vocal uploadé: ${req.file.filename} (${duration}s)`);
      
      res.json({
        success: true,
        message: "Message vocal uploadé avec succès",
        data: {
          filename: req.file.filename,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          audioUrl: filePath,          // Chemin relatif pour la base de données
          fullUrl: fullUrl,            // URL complète pour le frontend
          duration: parseInt(duration),
          chatId: req.params.chatId,
          uploadedAt: new Date(),
        },
      });
      
    } catch (error) {
      console.error("❌ Erreur upload voice message:", error);
      res.status(500).json({
        success: false,
        message: "Erreur serveur lors de l'upload du message vocal",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }),
];

// @desc    Récupérer un message vocal
// @route   GET /api/uploads/voice/:filename
// @access  Private (ou Public selon vos besoins)
exports.getVoiceMessage = asyncHandler(async (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, "../uploads/voice_messages", filename);

  if (fs.existsSync(filePath)) {
    // Déterminer le type MIME
    const ext = path.extname(filename).toLowerCase();
    let mimeType = 'audio/mpeg'; // Par défaut
    
    const mimeTypes = {
      '.mp3': 'audio/mpeg',
      '.m4a': 'audio/mp4',
      '.aac': 'audio/aac',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.webm': 'audio/webm',
    };
    
    if (mimeTypes[ext]) {
      mimeType = mimeTypes[ext];
    }
    
    // En-têtes pour le streaming audio
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Accept-Ranges', 'bytes');
    
    res.sendFile(filePath);
  } else {
    res.status(404).json({
      success: false,
      message: "Message vocal non trouvé",
    });
  }
});