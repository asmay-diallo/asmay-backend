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
// Import des handlers Socket.io
const SocketService = require("./services/socketServices")
const app = express();
const server = http.createServer(app);
require("dotenv").config();

// Import des routes
const authRoutes = require("./routes/auth");
// const nearbyUsersRoutes = require("./routes/nearbyUsers");
const signalRoutes = require("./routes/signals");
const chatRoutes = require("./routes/chats");
const userRoutes = require("./routes/users");
const uploadRoutes = require("./routes/upload");

// Import des middleware
const { protect } = require("./middleware/auth");

// ✅ CORS UNIFIÉ pour Express ET Socket.io
const corsOptions = {
  origin: process.env.CLIENT_URL || "http://localhost:19006",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

app.use(cors(corsOptions));

// ✅ Configuration Socket.io AVEC les mêmes CORS
const io = socketIo(server, {
  cors: corsOptions,
  transports: ["websocket", "polling"]
});


// Configuration de la base de données MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGODB_URI
    
    );
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("Database connection error:", error.message);
    process.exit(1);
  }
};

// Middleware de sécurité
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// Compression GZIP
app.use(compression());

// Logging
app.use(morgan("combined"));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 100 : 1000, // Limite différente selon l'environnement
  message: "Trop de requêtes depuis cette IP, veuillez réessayer plus tard.",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);
// 

// Body parser middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Servir les fichiers uploadés statiquement
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Serve static files in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));
}

// Routes API
app.use("/api/auth", authRoutes);
app.use("/api/signals", protect, signalRoutes);
app.use("/api/chats", protect, chatRoutes);
app.use("/api/users", protect, userRoutes);
app.use("/api/uploads", protect,uploadRoutes);

// Route santé pour le monitoring
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Route pour les métriques (pour Prometheus/etc)
app.get("/metrics", (req, res) => {
  res.status(200).json({
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    connections: server._connections, // Nombre approximatif de connexions
  });
});

// ✅ CONFIGURATION DES HANDLERS SOCKET
io.on('connection', (socket) => {
  SocketService.handleConnection(socket, io);
});

// Route de fallback pour SPA (en production
if (process.env.NODE_ENV === "production") {
  app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
  });
}

// Gestion des erreurs 404
app.use("/", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route non trouvée",
  });
});

// Middleware de gestion d'erreurs global
app.use((error, req, res, next) => {
  console.error("Error:", error);

  // Erreur de validation Mongoose
  if (error.name === "ValidationError") {
    const messages = Object.values(error.errors).map((val) => val.message);
    return res.status(400).json({
      success: false,
      message: "Données invalides",
      errors: messages,
    });
  }

  // Erreur JWT
  if (error.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Token invalide",
    });
  }

  // Erreur de duplication MongoDB
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    return res.status(400).json({
      success: false,
      message: `${field} existe déjà`,
    });
  }

  // Erreur par défaut
  res.status(error.status || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production" ? "Erreur serveur" : error.message,
    ...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
  });
});

// Gestion de la fermeture gracieuse
process.on("SIGINT", async () => {
  // console.log("Received SIGINT. Closing server gracefully...");
  server.close(() => {
    mongoose.connection.close(false, () => {
      console.log("MongoDB connection closed.");
      process.exit(0);
    });
  });
});

process.on("SIGTERM", async () => {
  // console.log("Received SIGTERM. Closing server gracefully...");
  server.close(() => {
    mongoose.connection.close(false, () => {
      console.log("MongoDB connection closed.");
      process.exit(0);
    });
  });
});

// Gestion des promesses non attrapées
process.on("unhandledRejection", (err) => {
  // console.log("Unhandled Rejection:", err);
  server.close(() => {
    process.exit(1);
  });
});

process.on("uncaughtException", (err) => {
  // console.log("Uncaught Exception:", err);
  server.close(() => {
    process.exit(1);
  });
});
// ✅ Configuration Socket.io SIMPLIFIÉE (pour debug)
io.on("connection", (socket) => {
  // console.log('✅ Nouvelle connexion Socket.io:', socket.id);
  
  // Authentification
  socket.on("user_authenticated", (userId) => {
    // console.log(`👤 Utilisateur authentifié: ${userId}`);
    socket.userId = userId;
    socket.join(userId);
    
    // Notifier les autres que cet user est en ligne
    socket.broadcast.emit("user_online", { userId });
  });

  // Ping/Pong pour tester la connexion
  socket.on("ping", (data) => {
    console.log('🏓 Ping reçu:', data);
    socket.emit("pong", { 
      timestamp: new Date().toISOString(),
      message: "Hello from server!" 
    });
  });

  // Gestion des déconnexions
  socket.on("disconnect", (reason) => {
    console.log(`🔌 Déconnexion: ${socket.id} - ${reason}`);
    if (socket.userId) {
      socket.broadcast.emit("user_offline", { userId: socket.userId });
    }
  });

  // Gestion des erreurs
  socket.on("error", (error) => {
    console.error(`❌ Erreur Socket ${socket.id}:`, error);
  });
});

// ✅ RENDRE IO ACCESSIBLE DANS LES CONTROLLERS
app.set('io', io);

// Démarrage du serveur
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connexion à la base de données
    await connectDB();

    // Démarrage du serveur
    server.listen(PORT, () => {
      console.log(`
🚀 Server running in ${process.env.NODE_ENV || "development"} mode
📍 Port: ${PORT}
📡 Socket.IO enabled
🌐 CORS enabled for: ${process.env.CLIENT_URL || "http://localhost:19006"}
🗄️  MongoDB: ${process.env.MONGODB_URI ? "Connected" : "Not configured"}
      `);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Démarrage de l'application
startServer();

module.exports = { app, server, io }
