// const express = require("express");
// const http = require("http");
// const socketIo = require("socket.io");
// const mongoose = require("mongoose");
// const cors = require("cors");
// const helmet = require("helmet");
// const rateLimit = require("express-rate-limit");
// const compression = require("compression");
// const morgan = require("morgan");
// const path = require("path");
// // Import des handlers Socket.io
// const SocketService = require("./services/socketServices")
// const app = express();
// const server = http.createServer(app);
// require("dotenv").config();
// 
// // Import des routes
// const authRoutes = require("./routes/auth");
// // const nearbyUsersRoutes = require("./routes/nearbyUsers");
// const signalRoutes = require("./routes/signals");
// const chatRoutes = require("./routes/chats");
// const userRoutes = require("./routes/users");
// const uploadRoutes = require("./routes/upload");
// 
// // Import des middleware
// const { protect } = require("./middleware/auth");
// 
// // ✅ CORS UNIFIÉ pour Express ET Socket.io
// const corsOptions = {
//   origin: process.env.CLIENT_URL || "http://localhost:19006",
//   credentials: true,
//   methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//   allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
// };
// 
// app.use(cors(corsOptions));
// 
// // ✅ Configuration Socket.io AVEC les mêmes CORS
// const io = socketIo(server, {
//   cors: corsOptions,
//   transports: ["websocket", "polling"]
// });
// 
// 
// // Configuration de la base de données MongoDB
// const connectDB = async () => {
//   try {
//     const conn = await mongoose.connect(
//       process.env.MONGODB_URI
//     
//     );
//     console.log(`MongoDB Connected: ${conn.connection.host}`);
//   } catch (error) {
//     console.error("Database connection error:", error.message);
//     process.exit(1);
//   }
// };
// 
// // Middleware de sécurité
// app.use(
//   helmet({
//     contentSecurityPolicy: false,
//     crossOriginEmbedderPolicy: false,
//   })
// );
// 
// // Compression GZIP
// app.use(compression());
// 
// // Logging
// app.use(morgan("combined"));
// 
// // Rate limiting
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: process.env.NODE_ENV === "production" ? 100 : 1000, // Limite différente selon l'environnement
//   message: "Trop de requêtes depuis cette IP, veuillez réessayer plus tard.",
//   standardHeaders: true,
//   legacyHeaders: false,
// });
// app.use("/api/", limiter);
// // 
// 
// // Body parser middleware
// app.use(express.json({ limit: "10mb" }));
// app.use(express.urlencoded({ extended: true, limit: "10mb" }));
// 
// // Servir les fichiers uploadés statiquement
// app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// 
// // Serve static files in production
// if (process.env.NODE_ENV === "production") {
//   app.use(express.static(path.join(__dirname, "../frontend/dist")));
// }
// 
// // Routes API
// app.use("/api/auth", authRoutes);
// app.use("/api/signals", protect, signalRoutes);
// app.use("/api/chats", protect, chatRoutes);
// app.use("/api/users", protect, userRoutes);
// app.use("/api/uploads", protect,uploadRoutes);
// 
// // Route santé pour le monitoring
// app.get("/health", (req, res) => {
//   res.status(200).json({
//     status: "OK",
//     timestamp: new Date().toISOString(),
//     uptime: process.uptime(),
//     environment: process.env.NODE_ENV || "development",
//   });
// });
// 
// // Route pour les métriques (pour Prometheus/etc)
// app.get("/metrics", (req, res) => {
//   res.status(200).json({
//     memory: process.memoryUsage(),
//     cpu: process.cpuUsage(),
//     connections: server._connections, // Nombre approximatif de connexions
//   });
// });
// 
// // ✅ CONFIGURATION DES HANDLERS SOCKET
// io.on('connection', (socket) => {
//   SocketService.handleConnection(socket, io);
// });
// 
// // Route de fallback pour SPA (en production
// if (process.env.NODE_ENV === "production") {
//   app.get("/", (req, res) => {
//     res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
//   });
// }
// 
// // Gestion des erreurs 404
// app.use("/", (req, res) => {
//   res.status(404).json({
//     success: false,
//     message: "Route non trouvée",
//   });
// });
// 
// // Middleware de gestion d'erreurs global
// app.use((error, req, res, next) => {
//   console.error("Error:", error);
// 
//   // Erreur de validation Mongoose
//   if (error.name === "ValidationError") {
//     const messages = Object.values(error.errors).map((val) => val.message);
//     return res.status(400).json({
//       success: false,
//       message: "Données invalides",
//       errors: messages,
//     });
//   }
// 
//   // Erreur JWT
//   if (error.name === "JsonWebTokenError") {
//     return res.status(401).json({
//       success: false,
//       message: "Token invalide",
//     });
//   }
// 
//   // Erreur de duplication MongoDB
//   if (error.code === 11000) {
//     const field = Object.keys(error.keyValue)[0];
//     return res.status(400).json({
//       success: false,
//       message: `${field} existe déjà`,
//     });
//   }
// 
//   // Erreur par défaut
//   res.status(error.status || 500).json({
//     success: false,
//     message:
//       process.env.NODE_ENV === "production" ? "Erreur serveur" : error.message,
//     ...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
//   });
// });
// 
// // Gestion de la fermeture gracieuse
// process.on("SIGINT", async () => {
//   // console.log("Received SIGINT. Closing server gracefully...");
//   server.close(() => {
//     mongoose.connection.close(false, () => {
//       console.log("MongoDB connection closed.");
//       process.exit(0);
//     });
//   });
// });
// 
// process.on("SIGTERM", async () => {
//   // console.log("Received SIGTERM. Closing server gracefully...");
//   server.close(() => {
//     mongoose.connection.close(false, () => {
//       console.log("MongoDB connection closed.");
//       process.exit(0);
//     });
//   });
// });
// 
// // Gestion des promesses non attrapées
// process.on("unhandledRejection", (err) => {
//   // console.log("Unhandled Rejection:", err);
//   server.close(() => {
//     process.exit(1);
//   });
// });
// 
// process.on("uncaughtException", (err) => {
//   // console.log("Uncaught Exception:", err);
//   server.close(() => {
//     process.exit(1);
//   });
// });
// // ✅ Configuration Socket.io SIMPLIFIÉE (pour debug)
// io.on("connection", (socket) => {
//   // console.log('✅ Nouvelle connexion Socket.io:', socket.id);
//   
//   // Authentification
//   socket.on("user_authenticated", (userId) => {
//     // console.log(`👤 Utilisateur authentifié: ${userId}`);
//     socket.userId = userId;
//     socket.join(userId);
//     
//     // Notifier les autres que cet user est en ligne
//     socket.broadcast.emit("user_online", { userId });
//   });
// 
//   // Ping/Pong pour tester la connexion
//   socket.on("ping", (data) => {
//     console.log('🏓 Ping reçu:', data);
//     socket.emit("pong", { 
//       timestamp: new Date().toISOString(),
//       message: "Hello from server!" 
//     });
//   });
// 
//   // Gestion des déconnexions
//   socket.on("disconnect", (reason) => {
//     console.log(`🔌 Déconnexion: ${socket.id} - ${reason}`);
//     if (socket.userId) {
//       socket.broadcast.emit("user_offline", { userId: socket.userId });
//     }
//   });
// 
//   // Gestion des erreurs
//   socket.on("error", (error) => {
//     console.error(`❌ Erreur Socket ${socket.id}:`, error);
//   });
// });
// 
// // ✅ RENDRE IO ACCESSIBLE DANS LES CONTROLLERS
// app.set('io', io);
// 
// // Démarrage du serveur
// const PORT = process.env.PORT || 5000;
// 
// const startServer = async () => {
//   try {
//     // Connexion à la base de données
//     await connectDB();
// 
//     // Démarrage du serveur
//     server.listen(PORT, () => {
//       console.log(`
// 🚀 Server running in ${process.env.NODE_ENV || "development"} mode
// 📍 Port: ${PORT}
// 📡 Socket.IO enabled
// 🌐 CORS enabled for: ${process.env.CLIENT_URL || "http://localhost:19006"}
// 🗄️  MongoDB: ${process.env.MONGODB_URI ? "Connected" : "Not configured"}
//       `);
//     });
//   } catch (error) {
//     console.error("Failed to start server:", error);
//     process.exit(1);
//   }
// };
// 
// // Démarrage de l'application
// startServer();
// 
// module.exports = { app, server, io }


const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs");

// Import des handlers Socket.io
const SocketService = require("./services/socketServices");

const app = express();
const server = http.createServer(app);
require("dotenv").config();

// ✅ Créer les dossiers uploads s'ils n'existent pas
const uploadDirs = [
  'uploads',
  'uploads/profiles',
  'uploads/voice_messages'
];

uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Dossier créé: ${dir}`);
  }
});

// ✅ Configuration CORS améliorée
const corsOptions = {
  origin: process.env.CLIENT_URL || "http://localhost:19006",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    "Content-Type", 
    "Authorization", 
    "X-Requested-With",
    "Accept",
    "Content-Length",
    "Accept-Encoding",
    "X-CSRF-Token"
  ],
  exposedHeaders: ["Content-Disposition"],
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.options('/api/', cors(corsOptions));

// ✅ Configuration Socket.io
const io = socketIo(server, {
  cors: corsOptions,
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e8
});

// Middleware de sécurité
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Compression
app.use(compression());

// Logging
app.use(morgan("dev")); // "dev" pour plus de détails

// Rate limiting général
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: "Trop de requêtes",
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting pour uploads
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: "Trop d'uploads",
});

app.use("/api/", generalLimiter);

// Middleware pour détecter multipart/form-data
app.use((req, res, next) => {
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    // Laisser passer sans body-parser
    next();
  } else {
    express.json({ limit: "50mb" })(req, res, next);
  }
});

app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Servir les fichiers uploadés
// app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
//   setHeaders: (res, filePath) => {
//     if (filePath.includes('voice_messages')) {
//       res.setHeader('Cache-Control', 'public, max-age=31536000');
//     }
//   }
// }));
// 🔥 CRITIQUE : Servir les fichiers uploads en statique
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath) => {
    // Headers pour les fichiers audio
    if (filePath.includes('voice_messages')) {
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }
  }
}));

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

// Appliquer le rate limiting spécifique aux uploads
app.use("/api/chats/:id/voice", uploadLimiter);

// ✅ CONFIGURATION UNIFIÉE SOCKET.IO
io.on('connection', (socket) => {
  console.log('🔌 Nouvelle connexion Socket.io:', socket.id);
  
  // Utiliser le service principal
  SocketService.handleConnection(socket, io);
  
  // Gestion simplifiée en parallèle
  socket.on("user_authenticated", (userId) => {
    console.log(`👤 Socket auth: ${userId}`);
    socket.userId = userId;
    socket.join(`user_${userId}`);
  });

  socket.on("ping", () => {
    socket.emit("pong", { timestamp: Date.now() });
  });

  socket.on("disconnect", (reason) => {
    console.log(`🔌 Déco: ${socket.id} - ${reason}`);
    if (socket.userId) {
      socket.broadcast.emit("user_offline", { userId: socket.userId });
    }
  });
});

// Rendre io accessible dans les contrôleurs
app.set('io', io);

// Routes utilitaires
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "OK", 
    time: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Gestion des erreurs 404
// app.use("*", (req, res) => {
//   res.status(404).json({
//     success: false,
//     message: "Route non trouvée",
//     path: req.originalUrl
//   });
// });
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route non trouvée",
    path: req.originalUrl
  });
});
// Middleware d'erreurs global
app.use((err, req, res, next) => {
  console.error("💥 Erreur:", err);
  
  if (err.name === "MulterError") {
    return res.status(400).json({
      success: false,
      message: `Erreur upload: ${err.message}`
    });
  }
  
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Erreur serveur' : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
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

// Démarrage
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`
🚀 Serveur démarré
📍 Port: ${PORT}
📡 Socket.IO: Activé
🌐 CORS: ${process.env.CLIENT_URL || "http://localhost:19006"}
    `);
  });
};

startServer();

module.exports = { app, server, io };