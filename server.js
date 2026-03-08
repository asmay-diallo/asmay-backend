// 
// const express = require("express");
// const http = require("http");
// const socketIo = require("socket.io");
// const mongoose = require("mongoose");
// require("dotenv").config();
// 
// const cors = require("cors");
// const helmet = require("helmet");
// const rateLimit = require("express-rate-limit");
// const compression = require("compression");
// const morgan = require("morgan");
// const path = require("path");
// const fs = require("fs");
// 
// // Import des handlers Socket.io
// const SocketService = require("./services/socketServices");
// 
// const app = express();
// const server = http.createServer(app);
// 
// //  Créer les dossiers uploads 
// const uploadDirs = [
//   'uploads',
//   'uploads/profiles',
//   'uploads/voice_messages'
// ];
// 
// uploadDirs.forEach(dir => {
//   if (!fs.existsSync(dir)) {
//     fs.mkdirSync(dir, { recursive: true });
//     console.log(` Dossier créé: ${dir}`);
//   }
// });
// 
// //  Configuration CORS 
// const corsOptions = {
//   origin: process.env.CLIENT_URL || "http://localhost:19006",
//   credentials: true,
//   methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
//   allowedHeaders: [
//     "Content-Type", 
//     "Authorization", 
//     "X-Requested-With",
//     "Accept",
//     "Content-Length",
//     "Accept-Encoding",
//     "X-CSRF-Token"
//   ],
//   exposedHeaders: ["Content-Disposition"],
//   maxAge: 86400,
// };
// 
// app.use(cors(corsOptions));
// app.options('/api/', cors(corsOptions));
// 
// //  Configuration Socket.io
// const io = socketIo(server, {
//   cors: corsOptions,
//   transports: ["websocket", "polling"],
//   pingTimeout: 60000,
//   pingInterval: 25000,
//   maxHttpBufferSize: 1e8
// });
// 
// // Middleware de sécurité
// app.use(helmet({
//   contentSecurityPolicy: false,
//   crossOriginEmbedderPolicy: false,
//   crossOriginResourcePolicy: { policy: "cross-origin" }
// }));
// 
// // Compression
// app.use(compression());
// 
// // Logging
// app.use(morgan("dev")); 
// 
// // Rate limiting général pour moins de 1000 users 
// const generalLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 10000,
//   message: "Trop de démande sur Asmay en ce moment veuillez réessayer",
//   standardHeaders: true,
//   legacyHeaders: false,
// });
// 
// // Rate limiting pour uploads pour au moins 1000 users
// const uploadLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 2000,
//   message: "Trop d'imports veuillez réessayer plus tard",
// });
// 
// app.use("/api/", generalLimiter);
// 
// // Middleware pour détecter multipart/form-data
// app.use((req, res, next) => {
//   if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
//     // Laisser passer sans body-parser
//     next();
//   } else {
//     express.json({ limit: "50mb" })(req, res, next);
//   }
// });
// 
// app.use(express.urlencoded({ extended: true, limit: "50mb" }));
// 
// 
// // Servir les fichiers uploads en statique
// app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
//   setHeaders: (res, filePath) => {
//     // Headers pour les fichiers audio
//     if (filePath.includes('voice_messages')) {
//       res.setHeader('Content-Type', 'audio/mpeg');
//       res.setHeader('Accept-Ranges', 'bytes');
//       res.setHeader('Cache-Control', 'public, max-age=31536000');
//     }
//   }
// }));
// 
// // Import des routes
// const authRoutes = require("./routes/auth");
// const signalRoutes = require("./routes/signals");
// const chatRoutes = require("./routes/chats");
// const userRoutes = require("./routes/users");
// const uploadRoutes = require("./routes/upload");
// 
// // Middleware d'authentification
// const { protect } = require("./middleware/auth");
// 
// // Routes API
// app.use("/api/auth", authRoutes);
// app.use("/api/signals", protect, signalRoutes);
// app.use("/api/chats", protect, chatRoutes);
// app.use("/api/users", protect, userRoutes);
// app.use("/api/uploads", protect, uploadRoutes);
// 
// // Appliquer le rate limiting spécifiquement aux uploads
// app.use("/api/chats/:id/voice", uploadLimiter);
// 
// // CONFIGURATION  SOCKET.IO
// io.on('connection', (socket) => {
//   console.log(' Nouvelle connexion Socket.io:', socket.id);
//   
//   // Utilisaton de service principal
//   SocketService.handleConnection(socket, io);
//   
//   // Gestion simplifiée en parallèle
//   socket.on("user_authenticated", (userId) => {
//     console.log(` Socket auth: ${userId}`);
//     socket.userId = userId;
//     socket.join(`user_${userId}`);
//   });
// 
//   socket.on("ping", () => {
//     socket.emit("pong", { timestamp: Date.now() });
//   });
// 
//   socket.on("disconnect", (reason) => {
//     console.log(`🔌 Déco: ${socket.id} - ${reason}`);
//     if (socket.userId) {
//       socket.broadcast.emit("user_offline", { userId: socket.userId });
//     }
//   });
// });
// 
// // Rendre io accessible dans les contrôleurs
// app.set('io', io);
// 
// // Routes utilitaires
// app.get("/health", (req, res) => {
//   res.status(200).json({ 
//     status: "OK", 
//     time: new Date().toISOString(),
//     uptime: process.uptime()
//   });
// });
// 
// // Gestion des erreurs 404
// 
// app.use((req, res) => {
//   res.status(404).json({
//     success: false,
//     message: "Route non trouvée",
//     path: req.originalUrl
//   });
// });
// // Middleware d'erreurs global
// app.use((err, req, res, next) => {
//   console.error(" Erreur:", err);
//   
//   if (err.name === "MulterError") {
//     return res.status(400).json({
//       success: false,
//       message: `Erreur upload: ${err.message}`
//     });
//   }
//   
//   res.status(err.status || 500).json({
//     success: false,
//     message: process.env.NODE_ENV === 'production' ? 'Erreur serveur' : err.message,
//     ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
//   });
// });
// 
// // Connexion MongoDB
// const connectDB = async () => {
//   try {
//     await mongoose.connect(process.env.MONGODB_URI);
//     console.log(" MongoDB connecté");
//   } catch (error) {
//     console.error(" MongoDB erreur:", error);
//     process.exit(1);
//   }
// };
// 
// // Démarrage du server
// const PORT = process.env.PORT || 5000;
// 
// const startServer = async () => {
//   await connectDB();
//   
//   server.listen(PORT, '0.0.0.0', () => {
//     console.log(`
//   Serveur démarré
//   Port: ${PORT}
//   Socket.IO: Activé
//   CORS: ${process.env.CLIENT_URL || "http://localhost:19006"}
//     `);
//   });
// };
// 
// startServer();
// 
// module.exports = { app, server, io };


// backend/server.js
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mongoose = require("mongoose");
require("dotenv").config();

const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs");

// Import des handlers Socket.io
const SocketService = require("./services/socketServices");
const socketAuth = require("./middleware/socketAuth"); // ✅ NOUVEAU

const app = express();
const server = http.createServer(app);

// Créer les dossiers uploads
const uploadDirs = ['uploads', 'uploads/profiles', 'uploads/voice_messages'];
uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Dossier créé: ${dir}`);
  }
});

// Configuration CORS
const corsOptions = {
  origin: process.env.CLIENT_URL || "http://localhost:19006",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  exposedHeaders: ["Content-Disposition"],
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.options('/api/', cors(corsOptions));

// Configuration Socket.io avec authentification
const io = socketIo(server, {
  cors: corsOptions,
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e8
});

// ✅ MIDDLEWARE D'AUTHENTIFICATION SOCKET.IO
io.use(socketAuth);

// Middleware de sécurité
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Compression
app.use(compression());

// Logging
app.use(morgan("dev"));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10000,
  message: "Trop de demandes, veuillez réessayer",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", generalLimiter);

// Body parser
app.use((req, res, next) => {
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    next();
  } else {
    express.json({ limit: "50mb" })(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Servir les fichiers statiques
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Import des routes
const authRoutes = require("./routes/auth");
const signalRoutes = require("./routes/signals");
const chatRoutes = require("./routes/chats");
const userRoutes = require("./routes/users");
const uploadRoutes = require("./routes/upload");

// Middleware d'authentification
const { protect } = require("./middleware/auth");

// Routes API
app.use("/api/auth", authRoutes);
app.use("/api/signals", protect, signalRoutes);
app.use("/api/chats", protect, chatRoutes);
app.use("/api/users", protect, userRoutes);
app.use("/api/uploads", protect, uploadRoutes);

// ✅ GESTION DES CONNEXIONS SOCKET.IO (simplifiée)
io.on('connection', (socket) => {
  console.log(`✅ Socket connecté: ${socket.id} - User: ${socket.user.username}`);
  
  // Ajouter aux rooms
  socket.join(`user_${socket.userId}`);
  
  // Notifier les autres
  socket.broadcast.emit('user_online', { userId: socket.userId });
  
  // Passer la main au service principal
  SocketService.handleConnection(socket, io);
  
  socket.on('disconnect', (reason) => {
    console.log(`🔌 Socket déconnecté: ${socket.id} - ${reason}`);
    socket.broadcast.emit('user_offline', { userId: socket.userId });
    SocketService.handleDisconnection(socket, reason);
  });
});

// Rendre io accessible dans les contrôleurs
app.set('io', io);

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "OK", 
    time: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route non trouvée",
    path: req.originalUrl
  });
});

// Middleware d'erreurs global
app.use((err, req, res, next) => {
  console.error("❌ Erreur:", err);
  
  if (err.name === "MulterError") {
    return res.status(400).json({
      success: false,
      message: `Erreur upload: ${err.message}`
    });
  }
  
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Erreur serveur' : err.message,
  });
});

// Connexion MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB connecté");
  } catch (error) {
    console.error("❌ MongoDB erreur:", error);
    process.exit(1);
  }
};

// Démarrage du serveur
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`
    🚀 Serveur démarré
    📡 Port: ${PORT}
    🔌 Socket.IO: Activé avec authentification
    🌍 CORS: ${process.env.CLIENT_URL || "http://localhost:19006"}
    `);
  });
};

startServer();

module.exports = { app, server, io };