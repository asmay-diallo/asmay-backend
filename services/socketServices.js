
// backend/services/socketServices.js
const Signal = require("../models/Signal");
const User = require("../models/User");
const Message = require("../models/Message");
const Chat = require("../models/Chat");
const Call = require("../models/Call")

class SocketService {
  constructor() {
    this.userConnections = new Map(); 
    this.socketToUser = new Map();    
     this.activeCalls = new Map(); 
     this.io = null;
     this.chatPresence = new Map(); 
    this.typingUsers = new Map();  
    this.typingTimeouts = new Map();
  }
    setIO(io) {
    this.io = io;
  }
  //   Gère une nouvelle connexion socket
  handleConnection(socket, io) {
      if (!this.io) {
      this.io = io;
    }
    const userId = socket.userId;
    const user = socket.user;

    // Stocker les mappings
    this.userConnections.set(userId, socket.id);
    this.socketToUser.set(socket.id, userId);
    // Rejoindre la room personnelle
    socket.join(`user_${userId}`);

    // Écouter les événements
    this.setupEventListeners(socket, io);
  }

   //Configure les écouteurs d'événements
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
     //  AJOUTER LA PRÉSENCE
      if (!this.chatPresence.has(chatId)) {
        this.chatPresence.set(chatId, new Set());
      }
      this.chatPresence.get(chatId).add(userId);
      
      //  NOTIFIER LES AUTRES
      socket.to(`chat_${chatId}`).emit("user_entered_chat", {
        userId,
        chatId,
        username: socket.user?.username || 'Utilisateur',
        timestamp: new Date()
      });
      
      //  ENVOYER LA LISTE DES UTILISATEURS PRÉSENTS À CELUI QUI VIENT DE REJOINDRE
      const usersInChat = Array.from(this.chatPresence.get(chatId)).map(uid => ({
        userId: uid,
        isTyping: this.typingUsers.has(chatId) && 
                  this.typingUsers.get(chatId).userId === uid
      }));
      
      socket.emit("chat_presence_list", {
        chatId,
        users: usersInChat
      });
      
    });

    // Quitter un chat
    socket.on("leave_chat", (chatId) => {
      socket.leave(`chat_${chatId}`); 
      //  RETIRER LA PRÉSENCE
      if (this.chatPresence.has(chatId)) {
        this.chatPresence.get(chatId).delete(userId);
        
        // Si plus personne dans le chat, nettoyer
        if (this.chatPresence.get(chatId).size === 0) {
          this.chatPresence.delete(chatId);
          this.typingUsers.delete(chatId);
        }
      }
      
      //  NOTIFIER LES AUTRES
      socket.to(`chat_${chatId}`).emit("user_left_chat", {
        userId,
        chatId,
        username: socket.user?.username || 'Utilisateur',
        timestamp: new Date()
      });
      
      //  Si l'utilisateur était en train de taper, arrêter
      if (this.typingUsers.has(chatId) && 
          this.typingUsers.get(chatId).userId === userId) {
        this.stopUserTyping(chatId, userId, io);
      }
    });

     //  TYPING START 
    socket.on("typing_start", ({ chatId, username }) => {
      console.log(` ${username} a commencé à écrire dans ${chatId}`);
      
      // Stocker l'état typing
      this.typingUsers.set(chatId, {
        userId,
        username: username || socket.user?.username || 'Utilisateur',
        text: '',
        timestamp: new Date()
      });
      
      // Notifier les autres dans le chat
       socket.to(`chat_${chatId}`).emit("user_typing_start", {
        userId,
        username: username || socket.user?.username,
        chatId,
        timestamp: new Date()
       });
      
      // Auto-stop après 5 secondes d'inactivité
      this.resetTypingTimeout(chatId, userId, io);
      });
  
    // TYPING TEXT (LIVE) 
    socket.on("typing_text", ({ chatId, text }) => {
      // Mettre à jour le texte en cours
      if (this.typingUsers.has(chatId)) {
        const typingData = this.typingUsers.get(chatId);
        typingData.text = text || '';
        typingData.timestamp = new Date();
        this.typingUsers.set(chatId, typingData);
      }
      // Envoyer le texte en direct aux autres
      socket.to(`chat_${chatId}`).emit("user_typing_update", {
        userId,
        text: text || '',
        chatId,
        timestamp: new Date()
      });
      
      // Réinitialiser le timeout d'auto-stop
      this.resetTypingTimeout(chatId, userId, io);
    });

      //  TYPING STOP
    socket.on("typing_stop", ({ chatId }) => {
      this.stopUserTyping(chatId, userId, io);
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
        console.error(" Erreur traitement message:", error);
        socket.emit("message_error", {
          tempId: data.tempId,
          error: error.message,
        });
      }
    });
    // like un utilisateur 
   socket.on("like_online_user", async (likedUserId) => {
     const likerUserId = socket.userId;
     const likerUsername = socket.user?.username;
     try {
    
      // Vérifier que l'utilisateur existe
     const userToLike = await User.findById(likedUserId);
     if (!userToLike) {
      socket.emit("like_error", {
        success: false,
        message: "Cet utilisateur n'existe pas !"
      });
      return;
     }

     // Vérifier qu'on ne se like pas soi-même
     if (likerUserId === likedUserId) {
      socket.emit("like_error", {
        success: false,
        message: "Vous ne pouvez pas vous liker vous-même"
      });
      return;
     }

    // Mettre à jour l'utilisateur liké
    const updatedUser = await User.findByIdAndUpdate(
      likedUserId,
      { $addToSet: { likers: likerUserId } },
      { new: true }
    ).select('username profilePicture likers');

    // Confirmer à l'expéditeur
    socket.emit("like_sent", {
      success: true,
      userId: likedUserId,
      likersCount: updatedUser.likers.length
    });

    //  NOTIFICATION À L'UTILISATEUR LIKÉ
    const targetSocketId = this.userConnections.get(likedUserId);
    
    if (targetSocketId && io) {
      // Émettre directement au socket de l'utilisateur liké
      io.to(targetSocketId).emit("user_online_liked", {
        likedByUser: {
          _id: socket.user._id,
          username: socket.user.username,
          profilePicture: socket.user.profilePicture
        },
        likedAt: new Date()
      });
     
    } else {
      // Fallback: émettre vers la room
      io.to(`user_${likedUserId}`).emit("user_online_liked", {
        likedByUser: {
          _id: socket.user._id,
          username: socket.user.username,
          profilePicture: socket.user.profilePicture
        },
        likedAt: new Date()
      });
    }

      } catch (error) {
    socket.emit("like_error", {
      success: false,
      message: "Impossible de liker cet utilisateur"
    });
     }
     });



     // ========== INITIER UN APPEL (AVEC OFFRE SDP) ==========
socket.on("call:initiate", async (data) => {
  try {
    const { targetUserId, callType, callerInfo, offer } = data;
   const userId = this.socketToUser.get(socket.id);
    
    console.log(`📞 Appel initié: ${userId} → ${targetUserId} (${callType})`);
    console.log(`📤 Offre SDP incluse:`, offer ? 'OUI' : 'NON');

    // Vérifier que le destinataire existe
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      socket.emit("call:error", { 
        code: "USER_NOT_FOUND",
        message: "Utilisateur non trouvé" 
      });
      return;
    }

    // Vérifier que l'utilisateur n'est pas déjà en appel
    if (this.isUserInCall(userId)) {
      socket.emit("call:error", { 
        code: "CALLER_BUSY",
        message: "Vous êtes déjà en communication" 
      });
      return;
    }

    if (this.isUserInCall(targetUserId)) {
      socket.emit("call:error", { 
        code: "USER_BUSY",
        message: "L'utilisateur est déjà en communication" 
      });
      return;
    }

    // Vérifier si le destinataire est en ligne
    const targetSocketId = this.userConnections.get(targetUserId);
    if (!targetSocketId) {
      socket.emit("call:error", { 
        code: "USER_OFFLINE",
        message: "L'utilisateur n'est pas en ligne" 
      });
      return;
    }

    // Créer un ID unique pour cet appel
    const callId = `call_${Date.now()}_${userId}_${targetUserId}`;

    // Stocker l'appel actif
    this.activeCalls.set(callId, {
      callId,
      participants: [userId, targetUserId],
      callType,
      startTime: new Date(),
      status: 'ringing',
      caller: userId
    });

    // ===== ENVOYER L'APPEL ENTRANT AU DESTINATAIRE
    console.log("Envoyer appel entrant=============");
    if (targetSocketId && io) {
       io.to(targetSocketId).emit("call:incoming", {
      callId,
      callerId: userId,
      callerName: callerInfo?.username || socket.user?.username,
      callerProfilePicture: callerInfo?.profilePicture || socket.user?.profilePicture,
      callType,
      calleeId:targetUser._id,
      calleeName:targetUser.username,
      calleeProfilePicture:targetUser.profilePicture,
      offer: offer, 
      timestamp: new Date()
    });

    }
   
    // Confirmer à l'appelant que ça sonne
    socket.emit("call:ringing", {
      callId,
      targetUserId,
      message: "Sonnerie en cours..."
    });

    console.log(`✅ Appel ${callId} en sonnerie`);

  } catch (error) {
    console.error("❌ Erreur initiation appel:", error);
    socket.emit("call:error", { 
      code: "SERVER_ERROR",
      message: "Erreur lors de l'initiation de l'appel" 
    });
  }
});

// ========== ANNULER UN APPEL ==========
socket.on("call:cancel", (data) => {
  const { callId, targetUserId } = data;
    const userId = this.socketToUser.get(socket.id);
  console.log(`🚫 Appel annulé: ${userId} → ${targetUserId}`);

  const targetSocketId = this.userConnections.get(targetUserId);
  if (io && targetSocketId) {
    io.to(targetSocketId).emit("call:cancelled", {
      callId,
      callerId: userId,
      message: "L'appelant a annulé l'appel"
    });
  }

  this.activeCalls.delete(callId);
});

// ========== ACCEPTER UN APPEL (AVEC RÉPONSE SDP) ==========
socket.on("call:accept", async (data) => {
  const { callId, callerId, answer } = data;
   const userId = this.socketToUser.get(socket.id);
  console.log(`✅ Appel accepté: ${userId} accepte l'appel de ${callerId}`);
  console.log(`📤 Réponse SDP incluse:`, answer ? 'OUI' : 'NON');

  const call = this.activeCalls.get(callId);
  if (call) {
    call.status = 'active';
    this.activeCalls.set(callId, call);
  }

  const callerSocketId = this.userConnections.get(callerId?.toString());
  if (callerSocketId && io) {
    // ===== ENVOYER L'ACCEPTATION AVEC LA RÉPONSE SDP =====
    io.to(callerSocketId).emit("call:accepted", {
      callId,
      calleeId: userId,
      answer: answer,
      message: "Appel accepté"
    });
  }

  // Si la réponse n'était pas incluse, envoyer un événement séparé
  if (!answer) {
    console.log('⚠️ Pas de réponse SDP dans accept, en attente de webrtc:answer');
  }
});

// ========== REFUSER UN APPEL ==========
socket.on("call:reject", (data) => {
  const { callId, callerId, reason } = data;
  
   const userId = this.socketToUser.get(socket.id);
  console.log(`❌ Appel refusé: ${userId} refuse l'appel de ${callerId}`);

  const callerSocketId = this.userConnections.get(callerId);
  if (callerSocketId && io) {
    io.to(callerSocketId).emit("call:rejected", {
      callId,
      calleeId: userId,
      reason: reason || "rejected",
      message: "L'utilisateur a refusé l'appel"
    });
  }

  this.activeCalls.delete(callId);
});

// ========== SIGNALING WEBRTC - OFFRE SDP (fallback) ==========
socket.on("webrtc:offer", (data) => {
  const { callId, targetUserId, offer } = data;
  
  console.log(`📤 Relai offre WebRTC: ${userId} → ${targetUserId}`);

  const targetSocketId = this.userConnections.get(targetUserId);
  if (targetSocketId) {
    io.to(targetSocketId).emit("webrtc:offer", {
      callId,
      offer,
      from: userId
    });
  }
});

// ========== SIGNALING WEBRTC - RÉPONSE SDP (fallback) ==========
socket.on("webrtc:answer", (data) => {
  const { callId, targetUserId, answer } = data;
  
  console.log(`📥 Relai réponse WebRTC: ${userId} → ${targetUserId}`);

  const targetSocketId = this.userConnections.get(targetUserId);
  if (targetSocketId) {
    io.to(targetSocketId).emit("webrtc:answer", {
      callId,
      answer,
      from: userId
    });
  }
});

// ========== SIGNALING WEBRTC - CANDIDAT ICE ==========
socket.on("webrtc:ice-candidate", (data) => {
  const { callId, targetUserId, candidate } = data;
  const userId = this.socketToUser.get(socket.id);
  const targetSocketId = this.userConnections.get(targetUserId);
  if (targetSocketId && candidate) {
    io.to(targetSocketId).emit("webrtc:ice-candidate", {
      callId,
      candidate,
      from: userId
    });
  }
});

// ========== TERMINER UN APPEL ==========
socket.on("call:end", async (data) => {
  const { callId, targetUserId } = data;
   const userId = this.socketToUser.get(socket.id);

  console.log(`📴 Appel terminé: ${userId} met fin à l'appel avec ${targetUserId}`);

  const targetSocketId = this.userConnections.get(targetUserId);
  if (targetSocketId && io) {
    io.to(targetSocketId).emit("call:ended", {
      callId,
      endedBy: userId,
      message: "L'appel est terminé"
    });
  }

  // Sauvegarder l'historique
  const call = this.activeCalls.get(callId);
  if (call && Call) {
    try {
      await Call.create({
        callId,
        caller: call.caller,
        callee: targetUserId,
        callType: call.callType,
        startTime: call.startTime,
        endTime: new Date(),
        duration: Math.floor((Date.now() - call.startTime) / 1000),
        status: 'ended'
      });
    } catch (err) {
      console.error("Erreur sauvegarde historique appel:", err);
    }
  }

  this.activeCalls.delete(callId)
});

//     //  TERMINER UN APPEL
//     socket.on("call:end", async (data) => {
//       const { callId, targetUserId } = data;
//       
//       console.log(`📴 Appel terminé: ${userId} met fin à l'appel avec ${targetUserId}`);
// 
//       const targetSocketId = this.userConnections.get(targetUserId);
//       if (targetSocketId) {
//         io.to(targetSocketId).emit("call:ended", {
//           callId,
//           endedBy: userId,
//           message: "L'appel est terminé"
//         });
//       }
// 
//       // Sauvegarder l'historique d'appel (optionnel)
//       const call = this.activeCalls.get(callId);
//       if (call && Call) {
//         try {
//           await Call.create({
//             callId,
//             caller: call.caller,
//             callee: targetUserId,
//             callType: call.callType,
//             startTime: call.startTime,
//             endTime: new Date(),
//             duration: Math.floor((Date.now() - call.startTime) / 1000),
//             status: 'ended'
//           });
//         } catch (err) {
//           console.error("Erreur sauvegarde historique appel:", err);
//         }
//       }
// 
//       // Supprimer l'appel actif
//       this.activeCalls.delete(callId);
//     });

    //  BASCULER CAMÉRA (notification simple)
    socket.on("call:toggle-camera", (data) => {
      const { targetUserId, enabled } = data
      
      const targetSocketId = this.userConnections.get(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit("call:camera-toggled", {
          from: userId,
          enabled
        });
      }
    });

    //  BASCULER MICRO
    socket.on("call:toggle-mic", (data) => {
      const { targetUserId, enabled } = data;
      
      const targetSocketId = this.userConnections.get(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit("call:mic-toggled", {
          from: userId,
          enabled
        });
      }
    });

    // Ping
    socket.on("ping", () => {
      socket.emit("pong", { timestamp: Date.now() });
    });
  }

   // Envoie un signal d'un utilisateur à un autre
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
    } else {
      console.log(`💤 ${toUser.username} n'est pas connecté, signal en attente`);
    }

    return { signal, signalData, delivered };
  }
findExistingCall(userId1, userId2) {
  for (const [callId, call] of this.activeCalls) {
    if (
      call.status !== 'ended' &&
      call.participants.includes(userId1) &&
      call.participants.includes(userId2)
    ) {
      return { callId, ...call };
    }
  }
  return null;
}
  stopUserTyping(chatId, userId, io) {
    if (this.typingUsers.has(chatId) && 
        this.typingUsers.get(chatId).userId === userId) {
      
      this.typingUsers.delete(chatId);
      
      // Nettoyer le timeout
      if (this.typingTimeouts.has(`${chatId}_${userId}`)) {
        clearTimeout(this.typingTimeouts.get(`${chatId}_${userId}`));
        this.typingTimeouts.delete(`${chatId}_${userId}`);
      }
      
      // Notifier les autres
      if (io) {
        io.to(`chat_${chatId}`).emit("user_typing_stop", {
          userId,
          chatId,
          timestamp: new Date()
        });
      }
      
      console.log(`⏹️ ${userId} a arrêté d'écrire dans ${chatId}`);
    }
  }
  resetTypingTimeout(chatId, userId, io) {
    const timeoutKey = `${chatId}_${userId}`;
    
    // Nettoyer l'ancien timeout
    if (this.typingTimeouts.has(timeoutKey)) {
      clearTimeout(this.typingTimeouts.get(timeoutKey));
    }
    
    // Nouveau timeout (5 secondes d'inactivité = arrêt auto)
    const timeout = setTimeout(() => {
      this.stopUserTyping(chatId, userId, io);
    }, 5000);
    
    this.typingTimeouts.set(timeoutKey, timeout);
  }

//   Gère la déconnexion
  handleDisconnection(socket, reason) {
    const userId = this.socketToUser.get(socket.id);

    if (userId) {
        // Notifier les participants des appels actifs
      const activeCall = this.getUserActiveCall(userId);
      if (activeCall) {
        const otherParticipant = activeCall.participants.find(p => p !== userId);
        const otherSocketId = this.userConnections.get(otherParticipant);
        
        if (otherSocketId && this.io) {
          this.io.to(otherSocketId).emit("call:ended", {
            callId: activeCall.callId,
            endedBy: userId,
            reason: "disconnected",
            message: "L'autre participant s'est déconnecté"
          });
        }
        
        this.activeCalls.delete(activeCall.callId);
      }

      this.userConnections.delete(userId);
      this.socketToUser.delete(socket.id);
      console.log(`👤 Utilisateur ${userId} déconnecté`);
    }
  }

  //  Envoyer notification de signal 
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

  //  Notifier acceptation 
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

      return true;
    }

    return false;
  }
  notifyLikedUserOnline(io, likedUser, likerUser) {
  const likedUserId = likedUser._id.toString();
  const likerUserId = likerUser._id.toString();
  
  console.log(`📨 Notification de like: ${likerUser.username} → ${likedUser.username}`);
  
  // Émettre vers la room personnelle
  io.to(`user_${likedUserId}`).emit("user_online_liked", {
    likedByUser: {
      _id: likerUser._id,
      username: likerUser.username,
      profilePicture: likerUser.profilePicture
    },
    likedAt: new Date()
  });
  
  //  Émettre vers le socket direct (si disponible)
  const targetSocketId = this.userConnections.get(likedUserId);
  if (targetSocketId) {
    io.to(targetSocketId).emit("user_online_liked", {
      likedByUser: {
        _id: likerUser._id,
        username: likerUser.username,
        profilePicture: likerUser.profilePicture
      },
      likedAt: new Date()
    });
  }
  
  console.log(`✅ Notification envoyée à ${likedUser.username}`);
  return true;
}
   // Vérifie si un utilisateur est en ligne
  isUserOnline(userId) {
    return this.userConnections.has(userId.toString());
  }
  // Vérifier si un utilisateur est en appel 
  isUserInCall(userId) {
    for (const [callId, call] of this.activeCalls) {
      if (call.participants.includes(userId) && call.status === 'active') {
        return true;
      }
    }
    return false;
  }
  // Récuperer l'appel actif d'un utilisateur 
  getUserActiveCall(userId) {
    for (const [callId, call] of this.activeCalls) {
      if (call.participants.includes(userId)) {
        return { callId, ...call };
      }
    }
    return null;
  }
   // Récupère la liste des utilisateurs en ligne
  getOnlineUsers() {
    return Array.from(this.userConnections.keys());
  }
}

module.exports = new SocketService();