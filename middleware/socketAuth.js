// backend/middleware/socketAuth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware d'authentification pour Socket.IO
 * Vérifie le token JWT avant d'autoriser la connexion socket
 */
const socketAuth = async (socket, next) => {
  try {
    // Récupérer le token depuis différentes sources
    const token = socket.handshake.auth.token || 
                  socket.handshake.headers?.authorization?.split(' ')[1] ||
                  socket.handshake.query?.token;

    if (!token) {
      console.log('❌ Socket auth: Token non fourni');
      return next(new Error('Token non fourni'));
    }

    // Vérifier le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Récupérer l'utilisateur
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      console.log('❌ Socket auth: Utilisateur non trouvé');
      return next(new Error('Utilisateur non trouvé'));
    }

    // Attacher l'utilisateur au socket
    socket.user = user;
    socket.userId = user._id.toString();
    
    console.log(`✅ Socket auth réussie pour ${user.username}`);
    next();
    
  } catch (error) {
    console.error('❌ Socket auth error:', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return next(new Error('Token invalide'));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new Error('Token expiré'));
    }
    
    next(new Error('Erreur d\'authentification'));
  }
};

module.exports = socketAuth;