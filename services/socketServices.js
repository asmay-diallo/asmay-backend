
const Signal = require("../models/Signal");
const User = require("../models/User");
const Message = require("../models/Message");
const Chat = require("../models/Chat")

class SocketService {
  constructor() {
    this.userConnections = new Map();
    this.socketToUser = new Map();
      this.callTimeouts = new Map(); // Pour gérer les timeouts d'appel
  }

  generateChatId() {
    return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  // Rejoindre un chat
  joinChat(socket, chatId) {
    socket.join(`chat_${chatId}`);
    console.log(`✅ User joined chat: ${chatId}`);
  }

  // Quitter un chat
  leaveChat(socket, chatId) {
    socket.leave(`chat_${chatId}`);
    console.log(`❌ User left chat: ${chatId}`);
  }

  handleConnection(socket, io) {
    console.log("🔌 Nouvelle connexion Socket.io:", socket.id);

    // 👤 Authentification de l'utilisateur
    socket.on("user_authenticated", (data) => {
      const userId = data.userId || data;
      this.handleUserAuthentication(socket, userId);
      console.log(
        `✅ Utilisateur ${userId} authentifié sur socket ${socket.id}`
      );
    });

    // 🔥 AJOUT : Écouter l'envoi de signal via socket
    //     socket.on("send_signal", async (data) => {
    //       try {
    //         console.log("📨 Événement send_signal reçu:", data);
    //
    //         const fromUserId = this.socketToUser.get(socket.id);
    //
    //         if (!fromUserId) {
    //           socket.emit("signal_error", {
    //             message: "Utilisateur non authentifié",
    //           });
    //           return;
    //         }
    //
    //         const { targetUserId, message } = data;
    //
    //         console.log(`🎯 Signal de ${fromUserId} vers ${targetUserId}`);
    //         // 🔥 CORRECTION : Récupérer les vraies infos utilisateur depuis la DB
    //         const fromUser = await User.findById(fromUserId).select(
    //           "username profilePicture interests"
    //         );
    //         if (!fromUser) {
    //           socket.emit("signal_error", {
    //             message: "Utilisateur expéditeur non trouvé",
    //           });
    //           return;
    //         }
    //
    //         const signal = new Signal({
    //           fromUserId: fromUserId,
    //           toUserId: targetUserId,
    //           message: message,
    //           commonInterests: commonInterests,
    //           chatId:chatId,
    //           fromUserSessionId: socket.id,
    //           toUserSessionId: `session_${toUser}`,
    //           expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    //         });
    //         await signal.save();
    //         await signal.populate("fromUser", "username profilePicture interests");
    //
    //         const signalData = {
    //           _id: "temp-" + Date.now(),
    //           fromUser: {
    //             _id: signal.fromUserId._id,
    //             username: signal.fromUserId.username, // À récupérer de la DB
    //             profilePicture: signal.fromUserId.profilePicture,
    //             interests: signal.fromUserId.interests || [],
    //           },
    //           toUser: signal.toUserId,
    //           message: signal.message,
    //            chatId:signal.chatId,
    //           status: "pending",
    //           createdAt: new Date().toISOString(),
    //           expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    //           commonInterests: [],
    //         };
    //
    //         // ENVOYER LE SIGNAL AU DESTINATAIRE
    //         const signalSent = this.sendSignalToUser(io, targetUserId, signalData);
    //
    //         // CONFIRMATION
    //         socket.emit("signal_sent", {
    //           success: true,
    //           targetUserId,
    //           delivered: signalSent,
    //           timestamp: new Date(),
    //         });
    //       } catch (error) {
    //         console.error("❌ Erreur envoi signal:", error);
    //         socket.emit("signal_error", {
    //           message: "Erreur lors de l'envoi du signal",
    //         });
    //       }
    //     });

    socket.on("send_signal", async (data) => {
      try {
        console.log("📨 Événement send_signal reçu:", data);

        const fromUserId = this.socketToUser.get(socket.id);

        if (!fromUserId) {
          socket.emit("signal_error", {
            message: "Utilisateur non authentifié",
          });
          return;
        }

        const { targetUserId, message } = data;

        console.log(`🎯 Signal de ${fromUserId} vers ${targetUserId}`);

        // 🔥 CORRECTION : Récupérer les vraies infos utilisateur
        const fromUser = await User.findById(fromUserId).select(
          "username profilePicture interests"
        );
        if (!fromUser) {
          socket.emit("signal_error", {
            message: "Utilisateur expéditeur non trouvé",
          });
          return;
        }

        // 🔥 CORRECTION : Récupérer l'utilisateur cible
        const toUser = await User.findById(targetUserId).select("interests");
        if (!toUser) {
          socket.emit("signal_error", {
            message: "Utilisateur cible non trouvé",
          });
          return;
        }

        // 🔥 CORRECTION : Calculer les intérêts communs (c'était manquant !)
        const commonInterests =
          fromUser.interests?.filter((interest) =>
            toUser.interests?.includes(interest)
          ) || [];

        console.log("🎯 Intérêts communs calculés:", commonInterests);

        // 🔥 CORRECTION : Générer le chatId
        const chatId = this.generateChatId();

        // 🔥 CORRECTION : Récupérer la session de l'utilisateur cible
        const targetSocketId = this.userConnections.get(
          targetUserId.toString()
        );
        const toUserSessionId = targetSocketId
          ? targetSocketId
          : `session_${targetUserId}`;

        // 🔥 CORRECTION : Créer et sauvegarder le signal AVEC chatId
        const signal = new Signal({
          fromUserId: fromUserId,
          toUserId: targetUserId,
          message: message,
          commonInterests: commonInterests, // ← MAINTENANT commonInterests EST DÉFINI
          chatId: chatId,
          fromUserSessionId: socket.id,
          toUserSessionId: toUserSessionId,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });

        await signal.save();

        // 🔥 CORRECTION : Populer les données utilisateur
        await signal.populate(
          "fromUserId",
          "username profilePicture interests"
        );

        // 🔥 CORRECTION : Préparer les données du signal
        const signalData = {
          _id: signal._id,
          fromUser: {
            _id: signal.fromUserId._id,
            username: signal.fromUserId.username,
            profilePicture: signal.fromUserId.profilePicture,
            interests: signal.fromUserId.interests || [],
          },
          toUser: signal.toUserId,
          message: signal.message,
          chatId: signal.chatId,
          status: "pending",
          commonInterests: signal.commonInterests,
          createdAt: signal.createdAt,
          expiresAt: signal.expiresAt,
        };

        console.log(`✅ Signal créé avec chatId: ${signal.chatId}`);

        // ENVOYER LE SIGNAL AU DESTINATAIRE
        const signalSent = this.sendSignalToUser(io, targetUserId, signalData);

        // CONFIRMATION À L'EXPÉDITEUR
        socket.emit("signal_sent", {
          success: true,
          targetUserId,
          chatId: signal.chatId,
          delivered: signalSent,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error("❌ Erreur envoi signal:", error);
        socket.emit("signal_error", {
          message: "Erreur lors de l'envoi du signal: " + error.message,
        });
      }
    });

    // 📍 Mise à jour de la position
    socket.on("update_position", (data) => {
      const userId = this.socketToUser.get(socket.id);
      if (userId) {
        socket.broadcast.emit("user_position_updated", {
          userId,
          position: data,
        });
      }
    });

    // Rejoindre les chats de l'utilisateur
    socket.on("join_chats", (chatIds) => {
      chatIds.forEach((chatId) => {
        this.joinChat(socket, chatId);
      });
    });

    // Rejoindre un chat spécifique
    socket.on("join_chat", (chatId) => {
      this.joinChat(socket, chatId);
    });

    // Quitter un chat
    socket.on("leave_chat", (chatId) => {
      this.leaveChat(socket, chatId);
    });

    // Envoyer un message
     socket.on("send_message", async (data) => {
      try {
        console.log('💬 [SOCKET] Message reçu:', data);
        
        const { chatId, content, tempId } = data;
        const senderId = this.socketToUser.get(socket.id);

        if (!senderId) {
          console.log('❌ [SOCKET] Utilisateur non authentifié');
          socket.emit("message_error", { tempId, error: "Non authentifié" });
          return;
        }

        // 1. VÉRIFIER LE CHAT
        const chat = await Chat.findOne({
          _id: chatId,
          isActive: true,
          $or: [{ participant1: senderId }, { participant2: senderId }]
        });

        if (!chat) {
          console.log('❌ [SOCKET] Chat non trouvé ou accès refusé');
          socket.emit("message_error", { tempId, error: "Chat non trouvé" });
          return;
        }

        // 2. 🔥 SAUVEGARDER EN BASE DE DONNÉES
        console.log('💾 [SOCKET] Sauvegarde message en base...');
        const message = await Message.create({
          chatId: chatId,
          sender: senderId,
          content: content
        });

        // 3. PEUPLER LES DONNÉES
        await message.populate('sender', 'username profilePicture');
        console.log('✅ [SOCKET] Message sauvegardé:', message._id);

        // 4. METTRE À JOUR LE CHAT
        chat.lastActivity = new Date();
        chat.lastMessage = content;
        await chat.save();
        console.log('✅ [SOCKET] Chat mis à jour');

        // 5. FORMATER LES DONNÉES POUR LE FRONTEND
        const messageData = {
          _id: message._id,
          sender: {
            _id: message.sender._id,
            username: message.sender.username,
            profilePicture: message.sender.profilePicture
          },
          content: message.content,
          chat: chatId,
          createdAt: message.createdAt
        };

        // 6. ÉMETTRE À TOUS LES PARTICIPANTS
        console.log('📡 [SOCKET] Émission new_message à chat_' + chatId);
        io.to(`chat_${chatId}`).emit("new_message", messageData);

        // 7. CONFIRMER L'ENVOI
        socket.emit("message_sent", { 
          messageId: message._id, 
          tempId: tempId 
        });

        console.log('🎉 [SOCKET] Message traité avec succès');

      } catch (error) {
        console.error('❌ [SOCKET] Erreur traitement message:', error);
        socket.emit("message_error", { 
          tempId: data.tempId, 
          error: error.message 
        });
      }
    });
    // 📍 Mise à jour de la position
    socket.on("update_position", (data) => {
      const userId = this.socketToUser.get(socket.id);
      if (userId) {
        socket.broadcast.emit("user_position_updated", {
          userId,
          position: data,
        });
      }
    });

    // Rejoindre les chats de l'utilisateur
    socket.on("join_chats", (chatIds) => {
      chatIds.forEach((chatId) => {
        this.joinChat(socket, chatId);
      });
    });

    // Envoyer un message
    socket.on("send_message", async (data) => {
      try {
        console.log('💬 [SOCKET] Message reçu:', data);
        
        const { chatId, content, tempId } = data;
        const senderId = this.socketToUser.get(socket.id);

        if (!senderId) {
          console.log('❌ [SOCKET] Utilisateur non authentifié');
          socket.emit("message_error", { tempId, error: "Non authentifié" });
          return;
        }

        const chat = await Chat.findOne({
          _id: chatId,
          isActive: true,
          $or: [{ participant1: senderId }, { participant2: senderId }]
        });

        if (!chat) {
          console.log('❌ [SOCKET] Chat non trouvé ou accès refusé');
          socket.emit("message_error", { tempId, error: "Chat non trouvé" });
          return;
        }

        const message = await Message.create({
          chatId: chatId,
          sender: senderId,
          content: content
        });

        await message.populate('sender', 'username profilePicture');
        console.log('✅ [SOCKET] Message sauvegardé:', message._id);

        chat.lastActivity = new Date();
        chat.lastMessage = content;
        await chat.save();
        console.log('✅ [SOCKET] Chat mis à jour');

        const messageData = {
          _id: message._id,
          sender: {
            _id: message.sender._id,
            username: message.sender.username,
            profilePicture: message.sender.profilePicture
          },
          content: message.content,
          chat: chatId,
          createdAt: message.createdAt
        };

        console.log('📡 [SOCKET] Émission new_message à chat_' + chatId);
        io.to(`chat_${chatId}`).emit("new_message", messageData);

        socket.emit("message_sent", { 
          messageId: message._id, 
          tempId: tempId 
        });

        console.log('🎉 [SOCKET] Message traité avec succès');

      } catch (error) {
        console.error('❌ [SOCKET] Erreur traitement message:', error);
        socket.emit("message_error", { 
          tempId: data.tempId, 
          error: error.message 
        });
      }
    });
    
    // 🔥 GESTION DES APPELS WEBRTC
    socket.on("call-request", async (data) => {
      try {
        console.log("📞 Événement call-request reçu:", data);

        const fromUserId = this.socketToUser.get(socket.id);
        if (!fromUserId) {
          socket.emit("call-error", { message: "Utilisateur non authentifié" });
          return;
        }

        const { to, fromUser, chatId, callType } = data;
        console.log(`🎯 Appel ${callType} de ${fromUserId} vers ${to}`);

        // Récupérer l'utilisateur cible
        const toUser = await User.findById(to).select("username profilePicture");
        if (!toUser) {
          socket.emit("call-error", { message: "Utilisateur cible non trouvé" });
          return;
        }

        const targetSocketId = this.userConnections.get(to.toString());
        
        if (targetSocketId && io) {
          // 🔥 Émettre un événement de sonnerie
          io.to(targetSocketId).emit("incoming-call", {
            from: fromUserId,
            fromUser: fromUser || {
              _id: fromUserId,
              username: "Utilisateur",
              profilePicture: ""
            },
            chatId: chatId || this.generateChatId(),
            callType: callType || 'video',
            timestamp: new Date().toISOString()
          });

          console.log(`🔔 Sonnerie envoyée à ${to}`);

          // 🔥 Timeout de 30 secondes
          const timeoutId = setTimeout(() => {
            const isStillRinging = this.userConnections.get(to.toString()) === targetSocketId;
            if (isStillRinging) {
              io.to(`user_${to}`).emit("call-timeout", {
                from: fromUserId,
                chatId
              });
              
              const callerSocketId = this.userConnections.get(fromUserId.toString());
              if (callerSocketId) {
                io.to(`user_${fromUserId}`).emit("call-timeout", {
                  to: to,
                  chatId
                });
              }
              
              console.log(`⏰ Timeout appel de ${fromUserId} vers ${to}`);
              this.callTimeouts.delete(`${fromUserId}_${to}`);
            }
          }, 30000);

          this.callTimeouts.set(`${fromUserId}_${to}`, timeoutId);

        } else {
          socket.emit("call-error", { message: "Utilisateur non connecté" });
        }
      } catch (error) {
        console.error("❌ Erreur call-request:", error);
        socket.emit("call-error", { message: "Erreur lors de l'appel" });
      }
    });

    // 🔥 RÉPONSE AUX APPELS
    socket.on("call-response", (data) => {
      // Au début du handler call-response
console.log('🔍 DEBUG call-response:', {
  from: data.from,    // Celui qui répond (Guindo)
  to: data.to,        // Celui qui a appelé (Moussa)
  type: data.type,
  chatId: data.chatId
});

      try {
        const { to, from, type, chatId } = data;
        console.log(`📞 Réponse d'appel ${type} de ${from} vers ${to}`);

        // Nettoyer le timeout
        const timeoutKey = `${to}_${from}`;
        const timeoutId = this.callTimeouts.get(timeoutKey);
        if (timeoutId) {
          clearTimeout(timeoutId);
          this.callTimeouts.delete(timeoutKey);
        }

        const targetSocketId = this.userConnections.get(to.toString());
        if (targetSocketId && io) {
          if (type === 'accepted') {
            io.to(targetSocketId).emit("call-accepted", {
              from: from,
              chatId: chatId,
              timestamp: new Date().toISOString()
            });
            console.log(`✅ Appel accepté par ${from}`);
          } else if (type === 'rejected') {
            io.to(`user_${to}`).emit("call-rejected", {
              from: from,
              timestamp: new Date().toISOString()
            });
            console.log(`❌ Appel rejeté par ${from}`);
          }
        }
      } catch (error) {
        console.error("❌ Erreur call-response:", error);
      }
    });

    // 🔥 FIN D'APPEL
    socket.on("call-end", (data) => {
      try {
        const { to, from } = data;
        console.log(`📞 Fin d'appel de ${from} vers ${to}`);

        const targetSocketId = this.userConnections.get(to.toString());
        if (targetSocketId && io) {
          io.to(`user_${to}`).emit("call-ended", {
            from: from,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error("❌ Erreur call-end:", error);
      }
    });

    // 🔥 SIGNALS WEBRTC (offers, answers, ice-candidates)
    socket.on("webrtc-signal", (data) => {
      try {
        const { to, from, type } = data;
        console.log(`📡 Signal WebRTC ${type} de ${from} vers ${to}`);

        const targetSocketId = this.userConnections.get(to.toString());
        if (targetSocketId && io) {
          io.to(targetSocketId).emit("webrtc-signal", data);
        }
      } catch (error) {
        console.error("❌ Erreur webrtc-signal:", error);
      }
    });

//     socket.on("send_message", async (data) => {
//       try {
//         const { chatId, content, tempId } = data;
//         const senderId = this.socketToUser.get(socket.id);
// 
//         // Ici, vous pouvez soit:
//         // 1. Sauvegarder en base et émettre l'événement
//         // 2. Ou émettre un événement temporaire et sauvegarder via API
//         io.to(`chat_${chatId}`).emit("new_message", {
//           _id: tempId,
//           sender: { _id: senderId },
//           content,
//           chat: chatId,
//           createdAt: new Date().toISOString(),
//           isSending: true,
//         });
//       } catch (error) {
//         socket.emit("message_error", { error: error.message });
//       }
//     });
    // 🔄 Ping/pong
   
    socket.on("ping", () => {
      socket.emit("pong", { timestamp: Date.now() });
    });

    // 🔌 Déconnexion
    socket.on("disconnect", (reason) => {
      this.handleDisconnection(socket, reason);
    });

    socket.on("error", (error) => {
      console.error("❌ Erreur Socket.io:", error);
    });
  }

 
  
  sendSignalToUser(io, targetUserId, signalData) {
    try {
      const targetSocketId = this.userConnections.get(targetUserId.toString());

      console.log(
        `📨 Recherche user ${targetUserId} -> socket: ${targetSocketId}`
      );

      if (targetSocketId && io) {
        io.to(targetSocketId).emit("new_signal", {
          _id: signalData._id,
          fromUser: signalData.fromUser,
          toUser: targetUserId,
          message: signalData.message,
          chatId: signalData.chatId, // ← CHATID INCLUS
          commonInterests: signalData.commonInterests,
          status: "pending",
          createdAt: signalData.createdAt,
          expiresAt: signalData.expiresAt,
        });

        console.log(
          `✅ Signal envoyé à ${targetUserId} avec chatId: ${signalData.chatId}`
        );
        return true;
      } else {
        console.log(`💤 User ${targetUserId} non connecté`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Erreur envoi signal à ${targetUserId}:`, error);
      return false;
    }
  }

  // 👤 Authentification (inchangé)
  handleUserAuthentication(socket, userId) {
    const oldSocketId = this.userConnections.get(userId.toString());
    if (oldSocketId) {
      this.userConnections.delete(userId.toString());
      this.socketToUser.delete(oldSocketId);
    }

    this.userConnections.set(userId.toString(), socket.id);
    this.socketToUser.set(socket.id, userId.toString());

    socket.join(`user_${userId}`);
    socket.broadcast.emit("user_online", { userId });
  }

  // 🔌 Déconnexion (inchangé)
  handleDisconnection(socket, reason) {
    console.log(`🔌 Déconnexion: ${socket.id} - Raison: ${reason}`);

    const userId = this.socketToUser.get(socket.id);

    if (userId) {
      this.userConnections.delete(userId);
      this.socketToUser.delete(socket.id);
      socket.broadcast.emit("user_offline", { userId });
      console.log(`👤 Utilisateur ${userId} déconnecté`);
    }
  }

  // 📨 Envoyer notification de signal (CORRIGÉ)
  sendSignalNotification(io, targetUserId, signalData) {
    console.log(`📨 Envoi notification à ${targetUserId}`, signalData);

    const targetSocketId = this.userConnections.get(targetUserId.toString());

    if (targetSocketId && io) {
      // 🔥 CORRECTION : Structure cohérente
      io.to(`user_${targetUserId}`).emit("new_signal", {
        _id: signalData._id,
        fromUser: signalData.fromUser,
        toUser: targetUserId,
        // message: signalData.message,
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

  getOnlineUsers() {
    return Array.from(this.userConnections.keys());
  }

  isUserOnline(userId) {
    return this.userConnections.has(userId.toString());
  }
}

module.exports = new SocketService();

// services/socketServices.js

// const Signal = require("../models/Signal");
// const User = require("../models/User");
// const Message = require("../models/Message");
// const Chat = require("../models/Chat");
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
// 
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
// 
//   handleConnection(socket, io) {
//     console.log("🔌 Nouvelle connexion Socket.io:", socket.id);
// 
//     // 👤 Authentification de l'utilisateur
//     socket.on("user_authenticated", (data) => {
//       const userId = data.userId || data;
//       this.handleUserAuthentication(socket, userId);
//       console.log(`✅ Utilisateur ${userId} authentifié sur socket ${socket.id}`);
//     });
// 
// 
//     // 📨 ÉVÉNEMENT POUR ENVOYER UN SIGNAL
//     socket.on("send_signal", async (data) => {
//       try {
//         console.log("📨 Événement send_signal reçu:", data);
// 
//         const fromUserId = this.socketToUser.get(socket.id);
//         if (!fromUserId) {
//           socket.emit("signal_error", { message: "Utilisateur non authentifié" });
//           return;
//         }
// 
//         const { targetUserId, message } = data;
//         console.log(`🎯 Signal de ${fromUserId} vers ${targetUserId}`);
// 
//         const fromUser = await User.findById(fromUserId).select("username profilePicture interests");
//         if (!fromUser) {
//           socket.emit("signal_error", { message: "Utilisateur expéditeur non trouvé" });
//           return;
//         }
// 
//         const toUser = await User.findById(targetUserId).select("interests");
//         if (!toUser) {
//           socket.emit("signal_error", { message: "Utilisateur cible non trouvé" });
//           return;
//         }
// 
//         const commonInterests = fromUser.interests?.filter((interest) =>
//           toUser.interests?.includes(interest)
//         ) || [];
// 
//         const chatId = this.generateChatId();
//         const targetSocketId = this.userConnections.get(targetUserId.toString());
//         const toUserSessionId = targetSocketId ? targetSocketId : `session_${targetUserId}`;
// 
//         const signal = new Signal({
//           fromUserId: fromUserId,
//           toUserId: targetUserId,
//           message: message,
//           commonInterests: commonInterests,
//           chatId: chatId,
//           fromUserSessionId: socket.id,
//           toUserSessionId: toUserSessionId,
//           expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
//         });
// 
//         await signal.save();
//         await signal.populate("fromUserId", "username profilePicture interests");
// 
//         const signalData = {
//           _id: signal._id,
//           fromUser: {
//             _id: signal.fromUserId._id,
//             username: signal.fromUserId.username,
//             profilePicture: signal.fromUserId.profilePicture,
//             interests: signal.fromUserId.interests || [],
//           },
//           toUser: signal.toUserId,
//           message: signal.message,
//           chatId: signal.chatId,
//           status: "pending",
//           commonInterests: signal.commonInterests,
//           createdAt: signal.createdAt,
//           expiresAt: signal.expiresAt,
//         };
// 
//         console.log(`✅ Signal créé avec chatId: ${signal.chatId}`);
// 
//         // ENVOYER LE SIGNAL AU DESTINATAIRE
//         const signalSent = this.sendSignalToUser(io, targetUserId, signalData);
// 
//         // CONFIRMATION À L'EXPÉDITEUR
//         socket.emit("signal_sent", {
//           success: true,
//           targetUserId,
//           chatId: signal.chatId,
//           delivered: signalSent,
//           timestamp: new Date(),
//         });
//       } catch (error) {
//         console.error("❌ Erreur envoi signal:", error);
//         socket.emit("signal_error", {
//           message: "Erreur lors de l'envoi du signal: " + error.message,
//         });
//       }
//     });
// 
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
//     // Envoyer un message
//     socket.on("send_message", async (data) => {
//       try {
//         console.log('💬 [SOCKET] Message reçu:', data);
//         
//         const { chatId, content, tempId } = data;
//         const senderId = this.socketToUser.get(socket.id);
// 
//         if (!senderId) {
//           console.log('❌ [SOCKET] Utilisateur non authentifié');
//           socket.emit("message_error", { tempId, error: "Non authentifié" });
//           return;
//         }
// 
//         const chat = await Chat.findOne({
//           _id: chatId,
//           isActive: true,
//           $or: [{ participant1: senderId }, { participant2: senderId }]
//         });
// 
//         if (!chat) {
//           console.log('❌ [SOCKET] Chat non trouvé ou accès refusé');
//           socket.emit("message_error", { tempId, error: "Chat non trouvé" });
//           return;
//         }
// 
//         const message = await Message.create({
//           chatId: chatId,
//           sender: senderId,
//           content: content
//         });
// 
//         await message.populate('sender', 'username profilePicture');
//         console.log('✅ [SOCKET] Message sauvegardé:', message._id);
// 
//         chat.lastActivity = new Date();
//         chat.lastMessage = content;
//         await chat.save();
//         console.log('✅ [SOCKET] Chat mis à jour');
// 
//         const messageData = {
//           _id: message._id,
//           sender: {
//             _id: message.sender._id,
//             username: message.sender.username,
//             profilePicture: message.sender.profilePicture
//           },
//           content: message.content,
//           chat: chatId,
//           createdAt: message.createdAt
//         };
// 
//         console.log('📡 [SOCKET] Émission new_message à chat_' + chatId);
//         io.to(`chat_${chatId}`).emit("new_message", messageData);
// 
//         socket.emit("message_sent", { 
//           messageId: message._id, 
//           tempId: tempId 
//         });
// 
//         console.log('🎉 [SOCKET] Message traité avec succès');
// 
//       } catch (error) {
//         console.error('❌ [SOCKET] Erreur traitement message:', error);
//         socket.emit("message_error", { 
//           tempId: data.tempId, 
//           error: error.message 
//         });
//       }
//     });
//     
//     // 🔥 GESTION DES APPELS WEBRTC
//     socket.on("call-request", async (data) => {
//       try {
//         console.log("📞 Événement call-request reçu:", data);
// 
//         const fromUserId = this.socketToUser.get(socket.id);
//         if (!fromUserId) {
//           socket.emit("call-error", { message: "Utilisateur non authentifié" });
//           return;
//         }
// 
//         const { to, fromUser, chatId, callType } = data;
//         console.log(`🎯 Appel ${callType} de ${fromUserId} vers ${to}`);
// 
//         // Récupérer l'utilisateur cible
//         const toUser = await User.findById(to).select("username profilePicture");
//         if (!toUser) {
//           socket.emit("call-error", { message: "Utilisateur cible non trouvé" });
//           return;
//         }
// 
//         const targetSocketId = this.userConnections.get(to.toString());
//         
//         if (targetSocketId && io) {
//           // 🔥 Émettre un événement de sonnerie
//           io.to(`user_${to}`).emit("incoming-call", {
//             from: fromUserId,
//             fromUser: fromUser || {
//               _id: fromUserId,
//               username: "Utilisateur",
//               profilePicture: ""
//             },
//             chatId: chatId || this.generateChatId(),
//             callType: callType || 'video',
//             timestamp: new Date().toISOString()
//           });
// 
//           console.log(`🔔 Sonnerie envoyée à ${to}`);
// 
//           // 🔥 Timeout de 30 secondes
//           const timeoutId = setTimeout(() => {
//             const isStillRinging = this.userConnections.get(to.toString()) === targetSocketId;
//             if (isStillRinging) {
//               io.to(`user_${to}`).emit("call-timeout", {
//                 from: fromUserId,
//                 chatId
//               });
//               
//               const callerSocketId = this.userConnections.get(fromUserId.toString());
//               if (callerSocketId) {
//                 io.to(`user_${fromUserId}`).emit("call-timeout", {
//                   to: to,
//                   chatId
//                 });
//               }
//               
//               console.log(`⏰ Timeout appel de ${fromUserId} vers ${to}`);
//               this.callTimeouts.delete(`${fromUserId}_${to}`);
//             }
//           }, 30000);
// 
//           this.callTimeouts.set(`${fromUserId}_${to}`, timeoutId);
// 
//         } else {
//           socket.emit("call-error", { message: "Utilisateur non connecté" });
//         }
//       } catch (error) {
//         console.error("❌ Erreur call-request:", error);
//         socket.emit("call-error", { message: "Erreur lors de l'appel" });
//       }
//     });
// 
//     // 🔥 RÉPONSE AUX APPELS
//     socket.on("call-response", (data) => {
//       try {
//         const { to, from, type, chatId } = data;
//         console.log(`📞 Réponse d'appel ${type} de ${from} vers ${to}`);
// 
//         // Nettoyer le timeout
//         const timeoutKey = `${to}_${from}`;
//         const timeoutId = this.callTimeouts.get(timeoutKey);
//         if (timeoutId) {
//           clearTimeout(timeoutId);
//           this.callTimeouts.delete(timeoutKey);
//         }
// 
//         const targetSocketId = this.userConnections.get(to.toString());
//         if (targetSocketId && io) {
//           if (type === 'accepted') {
//             io.to(`user_${to}`).emit("call-accepted", {
//               from: from,
//               chatId: chatId,
//               timestamp: new Date().toISOString()
//             });
//             console.log(`✅ Appel accepté par ${from}`);
//           } else if (type === 'rejected') {
//             io.to(`user_${to}`).emit("call-rejected", {
//               from: from,
//               timestamp: new Date().toISOString()
//             });
//             console.log(`❌ Appel rejeté par ${from}`);
//           }
//         }
//       } catch (error) {
//         console.error("❌ Erreur call-response:", error);
//       }
//     });
// 
//     // 🔥 FIN D'APPEL
//     socket.on("call-end", (data) => {
//       try {
//         const { to, from } = data;
//         console.log(`📞 Fin d'appel de ${from} vers ${to}`);
// 
//         const targetSocketId = this.userConnections.get(to.toString());
//         if (targetSocketId && io) {
//           io.to(`user_${to}`).emit("call-ended", {
//             from: from,
//             timestamp: new Date().toISOString()
//           });
//         }
//       } catch (error) {
//         console.error("❌ Erreur call-end:", error);
//       }
//     });
// 
//     // 🔥 SIGNALS WEBRTC (offers, answers, ice-candidates)
//     socket.on("webrtc-signal", (data) => {
//       try {
//         const { to, from, type } = data;
//         console.log(`📡 Signal WebRTC ${type} de ${from} vers ${to}`);
// 
//         const targetSocketId = this.userConnections.get(to.toString());
//         if (targetSocketId && io) {
//           io.to(`user_${to}`).emit("webrtc-signal", data);
//         }
//       } catch (error) {
//         console.error("❌ Erreur webrtc-signal:", error);
//       }
//     });
// 
//     // 🔄 Ping/pong
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
//   // 🔥 ENVOYER SIGNAL À UN UTILISATEUR
//   sendSignalToUser(io, targetUserId, signalData) {
//     try {
//       const targetSocketId = this.userConnections.get(targetUserId.toString());
// 
//       console.log(`📨 Recherche user ${targetUserId} -> socket: ${targetSocketId}`);
// 
//       if (targetSocketId && io) {
//         io.to(targetSocketId).emit("new_signal", {
//           _id: signalData._id,
//           fromUser: signalData.fromUser,
//           toUser: targetUserId,
//           message: signalData.message,
//           chatId: signalData.chatId,
//           commonInterests: signalData.commonInterests,
//           status: "pending",
//           createdAt: signalData.createdAt,
//           expiresAt: signalData.expiresAt,
//         });
// 
//         console.log(`✅ Signal envoyé à ${targetUserId} avec chatId: ${signalData.chatId}`);
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
//   // 👤 AUTHENTIFICATION
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
//   // 🔌 DÉCONNEXION
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
// 
//       // Nettoyer les timeouts d'appel
//       for (const [key, timeoutId] of this.callTimeouts.entries()) {
//         if (key.includes(userId)) {
//           clearTimeout(timeoutId);
//           this.callTimeouts.delete(key);
//         }
//       }
//     }
//   }
// 
//   // 📨 ENVOYER NOTIFICATION DE SIGNAL
//   sendSignalNotification(io, targetUserId, signalData) {
//     console.log(`📨 Envoi notification à ${targetUserId}`, signalData);
// 
//     const targetSocketId = this.userConnections.get(targetUserId.toString());
// 
//     if (targetSocketId && io) {
//       io.to(`user_${targetUserId}`).emit("new_signal", {
//         _id: signalData._id,
//         fromUser: signalData.fromUser,
//         toUser: targetUserId,
//         commonInterests: signalData.commonInterests,
//         status: "pending",
//         createdAt: signalData.createdAt,
//         expiresAt: signalData.expiresAt,
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
//   // ✅ NOTIFIER ACCEPTATION
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
//       console.log(`✅ ${acceptedByUser.username} a accepté le signal de ${fromUserId}`);
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