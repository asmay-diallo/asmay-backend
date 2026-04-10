
// backend/services/socketServices.js
const Signal = require("../models/Signal");
const User = require("../models/User");
const Message = require("../models/Message");
const Chat = require("../models/Chat");
const UserSession = require("../models/UserSession");

class SocketService {
  constructor() {
    this.userConnections = new Map(); // userId → socketId
    this.socketToUser = new Map();    // socketId → userId
  }

  // /**
  //  * Gère une nouvelle connexion socket
  //  */
  handleConnection(socket, io) {
    const userId = socket.userId;
    const user = socket.user;
    
    console.log(`🔌 Service: Nouvelle connexion pour ${user.username}`);

    // Stocker les mappings
    this.userConnections.set(userId, socket.id);
    this.socketToUser.set(socket.id, userId);

    // Écouter les événements
    this.setupEventListeners(socket, io);
  }

  /**
   * Configure les écouteurs d'événements
   */
  setupEventListeners(socket, io) {
    const userId = socket.userId;

    // Envoi de signal
    socket.on("send_signal", async (data) => {
      try {
        console.log("📨 Événement send_signal reçu");
        
        const { targetUserId, message } = data;
        
        // Vérifier que l'utilisateur est authentifié
        if (!userId) {
          socket.emit("signal_error", { message: "Utilisateur non authentifié" });
          return;
        }

        // Envoyer le signal
        const result = await this.sendSignal(userId, targetUserId, message, io);
        
        // Confirmer à l'expéditeur
        socket.emit("signal_sent", {
          success: true,
          targetUserId,
          signalId: result.signal._id,
          chatId: result.signal.chatId,
          message:result.signalData.message,
          delivered: result.delivered,
          timestamp: new Date(),
        });
        
      } catch (error) {
        console.error("❌ Erreur envoi signal:", error.message);
        socket.emit("signal_error", { message: error.message });
      }
    });

    // Rejoindre un chat
    socket.on("join_chat", (chatId) => {
      socket.join(`chat_${chatId}`);
      console.log(`✅ User ${userId} joined chat: ${chatId}`);
    });

    // Quitter un chat
    socket.on("leave_chat", (chatId) => {
      socket.leave(`chat_${chatId}`);
      console.log(`❌ User ${userId} left chat: ${chatId}`);
    });

    // Envoyer un message
    socket.on("send_message", async (data) => {
      try {
        const { chatId, content, tempId } = data;

        // Vérifier le chat
        const chat = await Chat.findOne({
          _id: chatId,
          isActive: true,
          $or: [{ participant1: userId }, { participant2: userId }],
        });

        if (!chat) {
          socket.emit("message_error", { tempId, error: "Chat non trouvé" });
          return;
        }

        // Créer le message
        const message = await Message.create({
          chatId: chatId,
          sender: userId,
          content: content,
        });

        await message.populate("sender", "username profilePicture");

        // Mettre à jour le chat
        chat.lastActivity = new Date();
        chat.lastMessage = content;
        await chat.save();

        // Émettre à tous les participants
        io.to(`chat_${chatId}`).emit("new_message", {
          _id: message._id,
          sender: {
            _id: message.sender._id,
            username: message.sender.username,
            profilePicture: message.sender.profilePicture,
          },
          content: message.content,
          chatId: chatId,
          createdAt: message.createdAt,
        });

        // Confirmer l'envoi
        socket.emit("message_sent", {
          messageId: message._id,
          tempId: tempId,
        });

      } catch (error) {
        console.error("❌ Erreur traitement message:", error);
        socket.emit("message_error", {
          tempId: data.tempId,
          error: error.message,
        });
      }
    });

    // Ping
    socket.on("ping", () => {
      socket.emit("pong", { timestamp: Date.now() });
    });
  }

  /**
   * Envoie un signal d'un utilisateur à un autre
   */
  async sendSignal(fromUserId, toUserId, message, io) {
    // Vérifier les signaux existants
    const existingSignal = await Signal.findOne({
      $or: [
        { fromUserId, toUserId, status: "pending" },
        { fromUserId: toUserId, toUserId: fromUserId, status: "pending" }
      ]
    });

    if (existingSignal) {
      throw new Error("Un signal existe déjà entre ces utilisateurs");
    }

    // Récupérer les utilisateurs
    const fromUser = await User.findById(fromUserId);
    const toUser = await User.findById(toUserId);

    if (!fromUser || !toUser) {
      throw new Error("Utilisateur non trouvé");
    }

    // Générer un chatId
    const chatId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Créer le signal
    const signal = await Signal.create({
      fromUserId,
      toUserId,
      fromUserSessionId: `session_${fromUserId}`,
      toUserSessionId: `session_${toUserId}`,
      message:`Salut ${toUser.username} 👋 ! Je suis ${fromUser.username}, J'aimerais vous faire connaitre si pouvez accepter mon signal ?`,
      chatId,
      status: "pending",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    // Préparer les données pour le frontend
    const signalData = {
      _id: signal._id,
      fromUser: {
        _id: fromUser._id,
        username: fromUser.username,
        profilePicture: fromUser.profilePicture,
      },
      toUser: toUserId,
      chatId,
      message: signal.message,
      status: "pending",
      createdAt: signal.createdAt,
      expiresAt: signal.expiresAt,
    };

    // Envoyer au destinataire s'il est connecté
    const targetSocketId = this.userConnections.get(toUserId.toString());
    let delivered = false;

    if (targetSocketId && io) {
      io.to(`user_${toUserId}`).emit("new_signal", signalData);
      delivered = true;
      console.log(`✅ Signal envoyé à ${toUser.username}`);
    } else {
      console.log(`💤 ${toUser.username} n'est pas connecté, signal en attente`);
    }

    return { signal, signalData, delivered };
  }

  /**
   * Gère la déconnexion
   */
  handleDisconnection(socket, reason) {
    const userId = this.socketToUser.get(socket.id);

    if (userId) {
      this.userConnections.delete(userId);
      this.socketToUser.delete(socket.id);
      console.log(`👤 Utilisateur ${userId} déconnecté`);
    }
  }

  // 📨 Envoyer notification de signal (CORRIGÉ)
  sendSignalNotification(io, targetUserId, signalData) {
    console.log(`📨 Envoi notification à ${targetUserId}`, signalData);

    const targetSocketId = this.userConnections.get(targetUserId.toString());

    if (targetSocketId && io) {
      
      io.to(`user_${targetUserId}`).emit("new_signal", {
        _id: signalData._id,
        fromUser: signalData.fromUser,
        toUser: targetUserId,
        message: signalData.message,
        commonInterests: signalData.commonInterests,
        status: "pending",
        createdAt: signalData.createdAt,
        expiresAt: signalData.expiresAt,
        // viewed: false
      });

      console.log(`✅ Notification envoyée à ${targetUserId}`);
      return true;
    } else {
      console.log(`💤 User ${targetUserId} non connecté`);
      return false;
    }
  }

  // ✅ Notifier acceptation (inchangé)
  notifySignalAccepted(io, fromUserId, acceptedByUser, chatId) {
    const fromUserSocketId = this.userConnections.get(fromUserId.toString());

    if (fromUserSocketId && io) {
      io.to(`user_${fromUserId}`).emit("signal_accepted", {
        acceptedBy: {
          _id: acceptedByUser._id,
          username: acceptedByUser.username,
          profilePicture: acceptedByUser.profilePicture,
        },
        chatId: chatId,
        acceptedAt: new Date(),
      });

      console.log(
        `✅ ${acceptedByUser.username} a accepté le signal de ${fromUserId}`
      );
      return true;
    }

    return false;
  }
  notifySignalDeclined(io, fromUserId, declinedByUser, chatId) {
    const fromUserSocketId = this.userConnections.get(fromUserId.toString());

    if (fromUserSocketId && io) {
      io.to(`user_${fromUserId}`).emit("signal_declined", {
        declinedBy: {
          _id: declinedByUser._id,
          username: declinedByUser.username,
          profilePicture: declinedByUser.profilePicture,
        },
        chatId: chatId,
        acceptedAt: new Date(),
      });

      console.log(
        `✅ ${declinedByUser.username} a refusé le signal de ${fromUserId}`
      );
      return true;
    }

    return false;
  }
  /**
   * Vérifie si un utilisateur est en ligne
   */
  isUserOnline(userId) {
    return this.userConnections.has(userId.toString());
  }

  /**
   * Récupère la liste des utilisateurs en ligne
   */
  getOnlineUsers() {
    return Array.from(this.userConnections.keys());
  }
}

module.exports = new SocketService();