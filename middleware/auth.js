const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    let token;

    console.log("🔐 [PROTECT] Headers reçus:", req.headers.authorization);

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      try {
        // Get token from header
        token = req.headers.authorization.split(' ')[1];
        console.log("✅ [PROTECT] Token extrait:", token ? "PRÉSENT" : "VIDE");

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log("✅ [PROTECT] Token décodé pour user:", decoded.id);

        // Get user from token
        req.user = await User.findById(decoded.id).select('-password');

        if (!req.user) {
          console.log("❌ [PROTECT] User non trouvé avec ID:", decoded.id);
          return res.status(401).json({
            success: false,
            message: 'Token invalide - utilisateur non trouvé'
          });
        }

        console.log("✅ [PROTECT] Authentification réussie pour:", req.user.username);
        
        // Update last active
        req.user.lastActive = new Date();
        await req.user.save();

        return next(); // ← RETURN important!
      } catch (error) {
        console.error('❌ [PROTECT] Erreur vérification token:', error.message);
        return res.status(401).json({
          success: false,
          message: 'Token invalide'
        });
      }
    } else {
      // ✅ CORRECTION: Ajout du ELSE manquant
      console.log("❌ [PROTECT] Aucun token Bearer trouvé");
      return res.status(401).json({
        success: false,
        message: 'Token manquant'
      });
    }

  } catch (error) {
    console.error('💥 [PROTECT] Erreur inattendue:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};
const optionalAuth = async (req, res, next) => {
  try {
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id).select('-password');
        
        if (req.user) {
          req.user.lastActive = new Date();
          await req.user.save();
        }
      } catch (error) {
        // Si le token est invalide, on continue sans user
        console.log('Optional auth - invalid token, continuing without user');
      }
    }
    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next();
  }
};

module.exports = { protect, optionalAuth };