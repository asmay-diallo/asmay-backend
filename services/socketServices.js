// const Signal = require("../models/Signal");
// const User = require("../models/User");
// const Message = require("../models/Message");
// const Chat = require("../models/Chat");
// const UserSession = require("../models/UserSession")
// 
// class SocketService {
//   constructor() {
//     this.userConnections = new Map();
//     this.socketToUser = new Map();
//     this.callTimeouts = new Map(); // Pour gérer les timeouts d'appel
//   }
// 
//   generateChatId() {
//     return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
//   }
//   // Rejoindre un chat
//   joinChat(socket, chatId) {
//     socket.join(`chat_${chatId}`);
//     console.log(`✅ User joined chat: ${chatId}`);
//   }
// 
//   // Quitter un chat
//   leaveChat(socket, chatId) {
//     socket.leave(`chat_${chatId}`);
//     console.log(`❌ User left chat: ${chatId}`);
//   }
// // Connexion de Socket
//   handleConnection(socket, io) {
//     console.log("🔌 Nouvelle connexion Socket.io:", socket.id);
// 
//     // 👤 Authentification de l'utilisateur
//     socket.on("user_authenticated", (data) => {
//       const userId = data.userId || data;
//       this.handleUserAuthentication(socket, userId);
//       console.log(
//         `✅ Utilisateur ${userId} authentifié sur socket ${socket.id}`
//       );
//     });
//     // Envoi de signal 
//     socket.on("send_signal", async (data) => {
//   try {
//     console.log("📨 Événement send_signal reçu via socket");
//     
//     const fromUserId = this.socketToUser.get(socket.id);
//     
//     if (!fromUserId) {
//       socket.emit("signal_error", {
//         message: "Utilisateur non authentifié"
//       });
//       return;
//     }
//     
//     const { targetUserId } = data;
//     
//     //  Utiliser targetUserId pour trouver la session
//     const targetSession = await UserSession.findOne({
//       userId: targetUserId,
//       isActive: true
//     });
//     
//     if (!targetSession) {
//       socket.emit("signal_error", {
//         message: "L'utilisateur cible n'est pas actif"
//       });
//       return;
//     }
//     
//     const toSessionId = targetSession.sessionId;
//     
//     console.log(`🎯 Tentative d'envoi via socket de ${fromUserId} à ${targetUserId}`);
//     console.log(`📱 Session cible trouvée: ${toSessionId}`);
//     
//     //  UTILISER LE SERVICE CENTRAL POUR LA VÉRIFICATION
//     const { signal, signalData } = await this.sendSignal(
//       fromUserId,
//       toSessionId,
//       io
//     );
//     
//     console.log(`✅ Signal créé via socket: ${signal._id}`);
//     
//     // Envoyer au destinataire
//     const signalSent = this.sendSignalToUser(io, targetUserId, signalData);
//     
//     // Confirmation à l'expéditeur
//     socket.emit("signal_sent", {
//       success: true,
//       targetUserId,
//       chatId: signal.chatId,
//       delivered: signalSent,
//       timestamp: new Date(),
//     });
//     
//   } catch (error) {
//     console.error("❌ Erreur envoi signal via socket:", error.message);
//     socket.emit("signal_error", {
//       message: error.message
//     });
//   }
//      });
//     // 📍 Mise à jour de la position
//     socket.on("update_position", (data) => {
//       const userId = this.socketToUser.get(socket.id);
//       if (userId) {
//         socket.broadcast.emit("user_position_updated", {
//           userId,
//           position: data,
//         });
//       }
//     });
// 
//     // Rejoindre un chat spécifique
//     socket.on("join_chat", (chatId) => {
//       this.joinChat(socket, chatId);
//     });
// 
//     // Quitter un chat
//     socket.on("leave_chat", (chatId) => {
//       this.leaveChat(socket, chatId);
//     });
// 
//     // Envoyer un message
//     socket.on("send_message", async (data) => {
//       try {
//         console.log("💬 [SOCKET] Message reçu:", data);
// 
//         const { chatId, content, tempId } = data;
//         const senderId = this.socketToUser.get(socket.id);
// 
//         if (!senderId) {
//           console.log("❌ [SOCKET] Utilisateur non authentifié");
//           socket.emit("message_error", { tempId, error: "Non authentifié" });
//           return;
//         }
// 
//         // 1. VÉRIFIER LE CHAT
//         const chat = await Chat.findOne({
//           _id: chatId,
//           isActive: true,
//           $or: [{ participant1: senderId }, { participant2: senderId }],
//         });
// 
//         if (!chat) {
//           console.log("❌ [SOCKET] Chat non trouvé ou accès refusé");
//           socket.emit("message_error", { tempId, error: "Chat non trouvé" });
//           return;
//         }
// 
//         // 2. 🔥 SAUVEGARDER EN BASE DE DONNÉES
//         console.log("💾 [SOCKET] Sauvegarde message en base...");
//         const message = await Message.create({
//           chatId: chatId,
//           sender: senderId,
//           content: content,
//         });
// 
//         // 3. PEUPLER LES DONNÉES
//         await message.populate("sender", "username profilePicture");
//         console.log("✅ [SOCKET] Message sauvegardé:", message._id);
// 
//         // 4. METTRE À JOUR LE CHAT
//         chat.lastActivity = new Date();
//         chat.lastMessage = content;
//         await chat.save();
//         console.log("✅ [SOCKET] Chat mis à jour");
// 
//         // 5. FORMATER LES DONNÉES POUR LE FRONTEND
//         const messageData = {
//           _id: message._id,
//           sender: {
//             _id: message.sender._id,
//             username: message.sender.username,
//             profilePicture: message.sender.profilePicture,
//           },
//           content: message.content,
//           chat: chatId,
//           createdAt: message.createdAt,
//         };
// 
//         // 6. ÉMETTRE À TOUS LES PARTICIPANTS
//         console.log("📡 [SOCKET] Émission new_message à chat_" + chatId);
//         io.to(`chat_${chatId}`).emit("new_message", messageData);
// 
//         // 7. CONFIRMER L'ENVOI
//         socket.emit("message_sent", {
//           messageId: message._id,
//           tempId: tempId,
//         });
// 
//         console.log("🎉 [SOCKET] Message traité avec succès");
//       } catch (error) {
//         console.error("❌ [SOCKET] Erreur traitement message:", error);
//         socket.emit("message_error", {
//           tempId: data.tempId,
//           error: error.message,
//         });
//       }
//     });
//   
//     socket.on('send_voice_message', async (data) => {
//   try {
//     const { chatId, tempId, audioUrl, duration } = data;
//     
//     const senderId = this.socketToUser.get(socket.id);
//     
//     if (!senderId) {
//       console.error('❌ User ID non défini dans socket');
//       socket.emit('voice_message_error', {
//         tempId,
//         error: 'Utilisateur non authentifié'
//       });
//       return;
//     }
//     
//     console.log(`🎤 [SOCKET] Message vocal reçu (NON TRAITÉ):`, { 
//       chatId, 
//       senderId,
//       tempId 
//     });
//     
//     // ❌ NE PAS TRAITER ICI - Laisser le REST API gérer
//     
//     // ✅ Seulement confirmer la réception
//     socket.emit('voice_message_received', {
//       tempId,
//       status: 'pending_api',
//       timestamp: new Date()
//     });
//     
//     console.log(`📤 Message transféré à l'API REST pour traitement`);
//     
//   } catch (error) {
//     console.error('❌ Erreur socket send_voice_message:', error);
//     socket.emit('voice_message_error', {
//       tempId: data?.tempId || 'unknown',
//       error: error.message
//     });
//   }
// });
// 
// // Confirmation quand le message est enregistré en base de données
//     socket.on('voice_message_stored', (data) => {
//   const { tempId, messageId, chatId } = data;
//   
//   // Informer l'expéditeur que son message est définitivement stocké
//   socket.emit('voice_message_confirmed', {
//     oldTempId: tempId,
//     newMessageId: messageId
//   });
//   
//   // Informer les autres participants
//   socket.to(chatId).emit('voice_message_updated', {
//     oldTempId: tempId,
//     newMessageId: messageId
//   });
//     });
//     // 📍 Mise à jour de la position
//     socket.on("update_position", (data) => {
//       const userId = this.socketToUser.get(socket.id);
//       if (userId) {
//         socket.broadcast.emit("user_position_updated", {
//           userId,
//           position: data,
//         });
//       }
//     });
// 
//     // Rejoindre les chats de l'utilisateur
//     socket.on("join_chats", (chatIds) => {
//       chatIds.forEach((chatId) => {
//         this.joinChat(socket, chatId);
//       });
//     });
// 
// 
// 
//     socket.on("ping", () => {
//       socket.emit("pong", { timestamp: Date.now() });
//     });
// 
//     // 🔌 Déconnexion
//     socket.on("disconnect", (reason) => {
//       this.handleDisconnection(socket, reason);
//     });
// 
//     socket.on("error", (error) => {
//       console.error("❌ Erreur Socket.io:", error);
//     });
//   }
// 
//    async canSendSignal(fromUserId, toUserId) {
//     console.log("🔍 Vérification canSendSignal...");
//     console.log("  De:", fromUserId, "à:", toUserId);
//     
//     // Vérifier si l'expéditeur a déjà un signal en attente
//     const existingSignal = await Signal.findOne({
//       fromUserId: fromUserId,
//       toUserId: toUserId,
//       status: "pending",
//     });
//     
//     // Vérifier si le destinataire a déjà envoyé un signal
//     const reverseSignal = await Signal.findOne({
//       fromUserId: toUserId,
//       toUserId: fromUserId,
//       status: "pending",
//     });
//     
//     const canSend = !existingSignal && !reverseSignal;
//     
//     console.log("📊 Résultat vérification:");
//     console.log("  - Signal existant:", existingSignal ? "OUI" : "NON");
//     console.log("  - Signal inverse:", reverseSignal ? "OUI" : "NON");
//     console.log("  - Peut envoyer:", canSend ? "OUI" : "NON");
//     
//     return {
//       canSend,
//       existingSignal,
//       reverseSignal,
//       message: existingSignal 
//         ? "Vous avez déjà un signal en attente non répondu vers cet utilisateur."
//         : reverseSignal 
//         ? "Cet utilisateur vous a déjà envoyé un signal non répondu."
//         : "OK pour envoyer"
//     };
//   }
// 
//   async sendSignal(fromUserId, toSessionId, io = null) {
//     console.log("🚀 sendSignal appelé via service");
//     
//     // 1. Validation
//     if (!toSessionId) {
//       throw new Error("Session ID du destinataire requis.");
//     }
// 
//     // 2. Récupérer sessions
//     const fromSession = await UserSession.findOne({
//       userId: fromUserId,
//       isActive: true,
//     });
//     
//     if (!fromSession) {
//       throw new Error("Session active non trouvée.");
//     }
// 
//     const toSession = await UserSession.findOne({
//       sessionId: toSessionId,
//       isActive: true,
//     }).populate("userId");
//     
//     if (!toSession || !toSession.userId) {
//       throw new Error("Utilisateur cible non trouvé.");
//     }
// 
//     const targetUser = toSession.userId;
// 
//     // 3. VÉRIFICATION CRITIQUE
//     const { canSend, message } = await this.canSendSignal(fromUserId, targetUser._id);
//     
//     if (!canSend) {
//       throw new Error(message);
//     }
// 
//     // 4. Continuer avec la création du signal...
//     const currentUser = await User.findById(fromUserId);
//     const commonInterests = currentUser.interests.filter((interest) =>
//       targetUser.interests.includes(interest)
//     );
// 
//     // Générer chatId
//     const generateChatId = () => {
//       return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
//     };
//     const chatId = generateChatId();
// 
//     // Créer le signal
//     const signal = await Signal.create({
//       fromUserId: fromUserId,
//       toUserId: targetUser._id,
//       fromUserSessionId: fromSession.sessionId,
//       toUserSessionId: toSessionId,
//       commonInterests: commonInterests.slice(0, 3),
//       message:`Salut ${targetUser.username.toUpperCase()} 👋 ! Je suis ${currentUser.username.toUpperCase()}, J'aimerais vous faire connaitre si pouvez accepter mon signal ?`,
//       chatId: chatId,
//       status: "pending",
//       expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
//     });
// 
//     // Préparer les données
//     const signalData = {
//       _id: signal._id,
//       fromUser: {
//         _id: currentUser._id,
//         username: currentUser.username,
//         profilePicture: currentUser.profilePicture,
//         interests: currentUser.interests,
//       },
//       toUser: targetUser._id,
//       chatId: signal.chatId,
//       message: signal.message,
//       commonInterests: commonInterests.slice(0, 3),
//       status: "pending",
//       createdAt: signal.createdAt,
//       expiresAt: signal.expiresAt,
//     };
// 
//     return {
//       signal,
//       signalData,
//       targetUser
//     };
//   }
// 
//   sendSignalToUser(io, targetUserId, signalData) {
//     try {
//       const targetSocketId = this.userConnections.get(targetUserId.toString());
// 
//       console.log(
//         `📨 Recherche user ${targetUserId} -> socket: ${targetSocketId}`
//       );
// 
//       if (targetSocketId && io) {
//         io.to(targetSocketId).emit("new_signal", {
//           _id: signalData._id,
//           fromUser: signalData.fromUser,
//           toUser: targetUserId,
//           message: signalData.message,
//           chatId: signalData.chatId, // ← CHATID INCLUS
//           commonInterests: signalData.commonInterests,
//           status: "pending",
//           createdAt: signalData.createdAt,
//           expiresAt: signalData.expiresAt,
//         });
// 
//         console.log(
//           `✅ Signal envoyé à ${targetUserId} avec chatId: ${signalData.chatId}`
//         );
//         return true;
//       } else {
//         console.log(`💤 User ${targetUserId} non connecté`);
//         return false;
//       }
//     } catch (error) {
//       console.error(`❌ Erreur envoi signal à ${targetUserId}:`, error);
//       return false;
//     }
//   }
// 
//   // 👤 Authentification (inchangé)
//   handleUserAuthentication(socket, userId) {
//     const oldSocketId = this.userConnections.get(userId.toString());
//     if (oldSocketId) {
//       this.userConnections.delete(userId.toString());
//       this.socketToUser.delete(oldSocketId);
//     }
// 
//     this.userConnections.set(userId.toString(), socket.id);
//     this.socketToUser.set(socket.id, userId.toString());
// 
//     socket.join(`user_${userId}`);
//     socket.broadcast.emit("user_online", { userId });
//   }
// 
//   // 🔌 Déconnexion (inchangé)
//   handleDisconnection(socket, reason) {
//     console.log(`🔌 Déconnexion: ${socket.id} - Raison: ${reason}`);
// 
//     const userId = this.socketToUser.get(socket.id);
// 
//     if (userId) {
//       this.userConnections.delete(userId);
//       this.socketToUser.delete(socket.id);
//       socket.broadcast.emit("user_offline", { userId });
//       console.log(`👤 Utilisateur ${userId} déconnecté`);
//     }
//   }
// 
//   // 📨 Envoyer notification de signal (CORRIGÉ)
//   sendSignalNotification(io, targetUserId, signalData) {
//     console.log(`📨 Envoi notification à ${targetUserId}`, signalData);
// 
//     const targetSocketId = this.userConnections.get(targetUserId.toString());
// 
//     if (targetSocketId && io) {
//       // 🔥 CORRECTION : Structure cohérente
//       io.to(`user_${targetUserId}`).emit("new_signal", {
//         _id: signalData._id,
//         fromUser: signalData.fromUser,
//         toUser: targetUserId,
//         message: signalData.message,
//         commonInterests: signalData.commonInterests,
//         status: "pending",
//         createdAt: signalData.createdAt,
//         expiresAt: signalData.expiresAt,
//         // viewed: false
//       });
// 
//       console.log(`✅ Notification envoyée à ${targetUserId}`);
//       return true;
//     } else {
//       console.log(`💤 User ${targetUserId} non connecté`);
//       return false;
//     }
//   }
// 
//   // ✅ Notifier acceptation (inchangé)
//   notifySignalAccepted(io, fromUserId, acceptedByUser, chatId) {
//     const fromUserSocketId = this.userConnections.get(fromUserId.toString());
// 
//     if (fromUserSocketId && io) {
//       io.to(`user_${fromUserId}`).emit("signal_accepted", {
//         acceptedBy: {
//           _id: acceptedByUser._id,
//           username: acceptedByUser.username,
//           profilePicture: acceptedByUser.profilePicture,
//         },
//         chatId: chatId,
//         acceptedAt: new Date(),
//       });
// 
//       console.log(
//         `✅ ${acceptedByUser.username} a accepté le signal de ${fromUserId}`
//       );
//       return true;
//     }
// 
//     return false;
//   }
//   notifySignalDeclined(io, fromUserId, declinedByUser, chatId) {
//     const fromUserSocketId = this.userConnections.get(fromUserId.toString());
// 
//     if (fromUserSocketId && io) {
//       io.to(`user_${fromUserId}`).emit("signal_declined", {
//         declinedBy: {
//           _id: declinedByUser._id,
//           username: declinedByUser.username,
//           profilePicture: declinedByUser.profilePicture,
//         },
//         chatId: chatId,
//         acceptedAt: new Date(),
//       });
// 
//       console.log(
//         `✅ ${declinedByUser.username} a refusé le signal de ${fromUserId}`
//       );
//       return true;
//     }
// 
//     return false;
//   }
// 
//   getOnlineUsers() {
//     return Array.from(this.userConnections.keys());
//   }
// 
//   isUserOnline(userId) {
//     return this.userConnections.has(userId.toString());
//   }
// }
// 
// module.exports = new SocketService();

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

  /**
   * Gère une nouvelle connexion socket
   */
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
          chat: chatId,
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