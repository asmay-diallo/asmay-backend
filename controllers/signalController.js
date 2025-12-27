const mongoose = require("mongoose");
const Signal = require("../models/Signal");

const UserSession = require("../models/UserSession");
const User = require("../models/User");
const Chat = require("../models/Chat");
const socketService = require("../services/socketServices");
const socketServices = require("../services/socketServices");

const sendSignal = async (req, res) => {
  console.log("📞 API REST sendSignal appelée");

  try {
    const { toSessionId } = req.body;
    const fromUserId = req.user._id;

    // Utiliser le service central
    const { signal, signalData, targetUser } = await socketServices.sendSignal(
      fromUserId,
      toSessionId,
      req.app.get("io")
    );

    // Envoyer notification socket
    const io = req.app.get("io");
    let notificationSent = false;

    if (io) {
      notificationSent = socketService.sendSignalNotification(
        io,
        targetUser._id,
        signalData
      );
    }

    res.status(201).json({
      success: true,
      message: "Signal envoyé avec succès !",
      data: {
        signalId: signal._id,
        chatId: signal.chatId,
        notificationSent,
        targetUserOnline: notificationSent,
        signal: signalData,
      },
    });

    // console.log(`✅ Signal envoyé via API: ${signal._id}`);
  } catch (error) {
    // console.error("❌ Erreur dans sendSignal (API):", error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
// const sendSignal = async (req, res) => {
//   try {
//     const { toSessionId } = req.body;
//     const fromUserId = req.user._id;
//
//     // 1. Validation
//     if (!toSessionId) {
//       return res.status(400).json({
//         success: false,
//         message: "Session ID du destinataire requis.",
//       });
//     }
//
//     // 2. Récupérer la session de l'expéditeur
//     const fromSession = await UserSession.findOne({
//       userId: fromUserId,
//       isActive: true,
//     });
//     if (!fromSession) {
//       return res.status(404).json({
//         success: false,
//         message: "Session active non trouvée. Ouvrez le Radar.",
//       });
//     }
//
//     // 3. Récupérer la session et l'utilisateur cible
//     const toSession = await UserSession.findOne({
//       sessionId: toSessionId,
//       isActive: true,
//     }).populate("userId");
//
//     if (!toSession || !toSession.userId) {
//       return res.status(404).json({
//         success: false,
//         message: "Utilisateur non actif ou hors ligne.",
//       });
//     }
//     const targetUser = toSession.userId;
//
//     // 🔥 CORRECTION CRITIQUE : Vérification correcte du signal existant
//     // On vérifie si l'expéditeur a déjà un signal en attente vers le destinataire
//     const existingSignal = await Signal.findOne({
//       fromUserId: fromUserId,
//       toUserId: targetUser._id,
//       status: "pending",
//     });
//
//     if (existingSignal) {
//       return res.status(400).json({
//         success: false,
//         message: "Vous avez déjà un signal en attente vers cet utilisateur.",
//       });
//     }
//
//     // 🔥 CORRECTION : Vérifier aussi si le destinataire a un signal en attente vers l'expéditeur
//     const reverseSignal = await Signal.findOne({
//       fromUserId: targetUser._id,
//       toUserId: fromUserId,
//       status: "pending",
//     });
//
//     if (reverseSignal) {
//       return res.status(400).json({
//         success: false,
//         message: "Cet utilisateur vous a déjà envoyé un signal. Veuillez le consulter.",
//       });
//     }
//
//     // 4. Récupérer les intérêts communs
//     const currentUser = await User.findById(fromUserId);
//     const commonInterests = currentUser.interests.filter((interest) =>
//       targetUser.interests.includes(interest)
//     );
//
//     // 5. Générer un chatId
//     const generateChatId = () => {
//       return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
//     };
//     const chatId = generateChatId();
//
//     // 6. Créer et sauvegarder le nouveau signal
//     const signal = await Signal.create({
//       fromUserId: fromUserId,
//       toUserId: targetUser._id,
//       fromUserSessionId: fromSession.sessionId,
//       toUserSessionId: toSessionId,
//       commonInterests: commonInterests.slice(0, 3),
//       chatId: chatId,
//       status: "pending",
//       expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 heures
//     });
//
//     // ✅ NOTIFICATION TEMPS RÉEL
//     const io = req.app.get("io");
//
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
//       commonInterests: commonInterests.slice(0, 3),
//       status: "pending",
//       createdAt: signal.createdAt,
//       expiresAt: signal.expiresAt,
//       distance: null,
//     };
//
//     // Envoyer la notification en temps réel
//     const notificationSent = socketService.sendSignalNotification(
//       io,
//       targetUser._id,
//       signalData
//     );
//
//     res.status(201).json({
//       success: true,
//       message: "Signal envoyé avec succès !",
//       data: {
//         signalId: signal._id,
//         chatId: signal.chatId,
//         notificationSent,
//         targetUserOnline: notificationSent,
//         signal: signalData
//       },
//     });
//
//     console.log(`✅ Session de l'expéditeur: ${fromSession.sessionId}`);
//     console.log(`📨 Signal envoyé de ${currentUser.username} à ${targetUser.username}`);
//     console.log(`💬 Chat ID généré: ${signal.chatId}`);
//
//   } catch (error) {
//     console.error("❌ Erreur détaillée sendSignal:", error);
//     res.status(500).json({
//       success: false,
//       message: "Erreur lors de l'envoi du signal.",
//       error: process.env.NODE_ENV === "development" ? error.message : undefined,
//     });
//   }
// };
// const sendSignal = async (req, res) => {
//   try {
//     const { toSessionId } = req.body;
//     const fromUserId = req.user._id;
//
//     // 1. Validation
//     if (!toSessionId) {
//       return res.status(400).json({
//         success: false,
//         message: "Session ID du destinataire requis.",
//       });
//     }
//
//     // 2. Récupérer la session de l'expéditeur
//     const fromSession = await UserSession.findOne({
//       userId: fromUserId,
//       isActive: true,
//     });
//     if (!fromSession) {
//       return res.status(404).json({
//         success: false,
//         message: "Session active non trouvée. Ouvrez le Radar.",
//       });
//     }
//
//     // 3. Récupérer la session et l'utilisateur cible
//     const toSession = await UserSession.findOne({
//       sessionId: toSessionId,
//       isActive: true,
//     }).populate("userId");
//     if (!toSession || !toSession.userId) {
//       return res.status(404).json({
//         success: false,
//         message: "Utilisateur non actif ou hors ligne.",
//       });
//     }
//     const targetUser = toSession.userId;
//
//     // 4. Vérifier s'il n'y a pas déjà un signal en attente
//     const existingSignal = await Signal.findOne({
//       fromUserId: fromSession.userId,
//       toUserSessionId: fromSession.sessionId,
//       status: "pending",
//     });
//     if (existingSignal) {
//       return res.status(400).json({
//         success: false,
//         message: "Signal déjà envoyé à cet utilisateur.",
//       });
//     }
//     // 5. Récupérer les intérêts communs
//     const currentUser = await User.findById(fromUserId);
//     const commonInterests = currentUser.interests.filter((interest) =>
//       targetUser.interests.includes(interest)
//     );
//
//     // 🔥 CORRECTION : Générer un chatId
//     const generateChatId = () => {
//       return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
//     };
//     const chatId = generateChatId();
//
//     // 6. Créer et sauvegarder le nouveau signal AVEC chatId
//     const signal = await Signal.create({
//       fromUserId: fromUserId,
//       toUserId: targetUser._id,
//       fromUserSessionId: fromSession.sessionId,
//       toUserSessionId: toSessionId,
//       commonInterests: commonInterests.slice(0, 3),
//       chatId: chatId, // ← CHATID AJOUTÉ ICI
//       status: "pending",
//     });
//
//     // ✅ NOTIFICATION TEMPS RÉEL
//     const io = req.app.get("io");
//
//     const signalData = {
//       _id: signal._id,
//       fromUser: {
//         _id: currentUser._id,
//         username: currentUser.username,
//         profilePicture: currentUser.profilePicture,
//         interests: currentUser.interests,
//       },
//       toUser: targetUser._id, // ← AJOUT IMPORTANT
//       chatId: signal.chatId, // ← CHATID INCLUS
//       commonInterests: commonInterests.slice(0, 3),
//       status: "pending", // ← STATUS INCLUS
//       createdAt: signal.createdAt,
//       expiresAt: signal.expiresAt, // ← EXPIRESAT INCLUS
//       distance: null,
//     };
//
//     // Envoyer la notification en temps réel
//     const notificationSent = socketService.sendSignalNotification(
//       io,
//       targetUser._id,
//       signalData
//     );
//
//     res.status(201).json({
//       success: true,
//       message: "Signal envoyé !",
//       data: {
//         signalId: signal._id,
//         chatId: signal.chatId, // ← CHATID INCLUS DANS LA RÉPONSE
//         notificationSent,
//         targetUserOnline: notificationSent,
//       },
//     });
//     console.log(`✅------La session de l'expéditeur : ${fromSession}`);
//
//     console.log(
//       `📨 Signal envoyé de ${currentUser.username} à ${targetUser.username} - ChatId: ${signal.chatId} `
//     );
//   } catch (error) {
//     console.error("❌ Erreur détaillée sendSignal:", error);
//     res.status(500).json({
//       success: false,
//       message: "Erreur lors de l'envoi du signal.",
//       error: process.env.NODE_ENV === "development" ? error.message : undefined,
//     });
//   }
// };
// @desc    Accepter ou ignorer un signal reçu
// @route   POST /api/signal/respond
// @access  Privé

// controllers/signalController.js - VERSION COMPLÈTE CORRIGÉE
// const respondToSignal = async (req, res) => {
//   try {
//     console.log("🎯 [SIGNAL] DEBUT respondToSignal");
//     console.log("📦 Body reçu:", req.body);
//     console.log("👤 User ID:", req.user._id);
// 
//     const { signalId, response } = req.body;
//     const userId = req.user._id;
// 
//     // 1. VALIDATION
//     if (!signalId || !response) {
//       console.log("❌ Données manquantes");
//       return res.status(400).json({
//         success: false,
//         message: "SignalId et réponse requis.",
//       });
//     }
// 
//     if (!["accepted", "ignored"].includes(response)) {
//       console.log("❌ Réponse invalide:", response);
//       return res.status(400).json({
//         success: false,
//         message: "Réponse invalide.",
//       });
//     }
// 
//     // 2. TROUVER LE SIGNAL
//     console.log("🔍 Recherche signal:", signalId);
//     const signal = await Signal.findById(signalId)
//       .populate("fromUserId", "username profilePicture")
//       .populate("toUserId", "username profilePicture");
// 
//     if (!signal) {
//       console.log("❌ Signal non trouvé");
//       return res.status(404).json({
//         success: false,
//         message: "Signal non trouvé.",
//       });
//     }
// 
//     console.log("✅ Signal trouvé:", {
//       id: signal._id,
//       from: signal.fromUserId?.username,
//       to: signal.toUserId?.username,
//       status: signal.status,
//     });
// 
//     // 3. VÉRIFIER LES AUTORISATIONS
//     console.log("🔐 Vérification autorisations...");
// 
//     // Vérification par userId (plus fiable)
//     const isAuthorized = signal.toUserId._id.toString() === userId.toString();
// 
//     if (!isAuthorized) {
//       console.log("❌ Non autorisé - UserId mismatch");
//       console.log("   Signal.toUserId:", signal.toUserId._id.toString());
//       console.log("   User actuel:", userId.toString());
//       return res.status(403).json({
//         success: false,
//         message: "Non autorisé à répondre à ce signal.",
//       });
//     }
// 
//     console.log("✅ Autorisation OK");
// 
//     // 4. VÉRIFIER SI DÉJÀ TRAITÉ
//     if (signal.status !== "pending") {
//       console.log("⚠️ Signal déjà traité:", signal.status);
//       return res.status(400).json({
//         success: false,
//         message: "Ce signal a déjà été traité.",
//       });
//     }
// 
//     // 5. METTRE À JOUR LE STATUT
//     console.log("🔄 Mise à jour statut:", response);
//     signal.status = response;
//     signal.respondedAt = new Date();
// 
//     let chatId = null;
//     // 6. SI ACCEPTÉ, CRÉER UN CHAT
//     if (response === "accepted") {
//       console.log("💬 [CHAT] Début création chat pour signal:", signalId);
// 
//       const chat = await Chat.findById({
//         participant1: mongoose.Types.ObjectId.isValid(signal.fromUserId._id),
//         participant2: mongoose.Types.ObjectId.isValid(signal.toUserId._id)
//       });
//       // Vérifier s'il y a déja un chat existant
//       if (chat) {
//         console.log("LE CHAT EXISTANT :", chat);
//         return res.status(401).json({
//           success: false,
//           message: `Vous avez déjà un chat créé avec ${signal.toUserId.username}`,
//         });
//       }
//       try {
//         // Vérifier que les ObjectId sont valides
//         const isValid1 = mongoose.Types.ObjectId.isValid(signal.fromUserId._id);
//         const isValid2 = mongoose.Types.ObjectId.isValid(signal.toUserId._id);
//         console.log("   ✅ Participant1 ObjectId valide:", isValid1);
//         console.log("   ✅ Participant2 ObjectId valide:", isValid2);
// 
//         if (!isValid1 || !isValid2) {
//           throw new Error("ObjectId invalide pour les participants");
//         }
// 
//         // 🔥 CRÉATION DU CHAT
//         const chatData = {
//           participant1: signal.fromUserId._id,
//           participant2: signal.toUserId._id,
//           initiatedFromSignal: signalId,
//           lastActivity: new Date(),
//           lastMessage: "Conversation démarrée",
//           // expiresAt et isActive ont des valeurs par défaut
//         };
// 
//         console.log("📦 [CHAT] Données de création:", chatData);
// 
//         const chat = await Chat.create(chatData);
//         console.log("✅ [CHAT] Chat créé avec succès! ID:", chat._id);
// 
//         chatId = chat._id;
//         signal.chatId = chatId;
// 
//         // 🔥 VÉRIFICATION IMMÉDIATE
//         console.log("🔎 [CHAT] Vérification en base...");
//         const savedChat = await Chat.findById(chat._id)
//           .populate("participant1", "username")
//           .populate("participant2", "username");
// 
//         if (savedChat) {
//           console.log("✅ [CHAT] Chat confirmé en base:", {
//             id: savedChat._id,
//             participant1: savedChat.participant1.username,
//             participant2: savedChat.participant2.username,
//             isActive: savedChat.isActive,
//           });
//         } else {
//           console.log("❌ [CHAT] Chat NON TROUVÉ en base après création!");
//         }
//       } catch (chatError) {
//         console.error("❌ [CHAT] ERREUR création chat:", chatError.message);
//         console.error("📝 [CHAT] Stack:", chatError.stack);
// 
//         // Gestion spécifique des erreurs
//         if (chatError.code === 11000) {
//           console.log("⚠️ [CHAT] Erreur de doublon - Chat déjà existant");
// 
//           // Chercher le chat existant
//           const existingChat = await Chat.findOne({
//             $or: [
//               {
//                 participant1: signal.fromUserId._id,
//                 participant2: signal.toUserId._id,
//               },
//               {
//                 participant1: signal.toUserId._id,
//                 participant2: signal.fromUserId._id,
//               },
//             ],
//           }).populate("participant1 participant2");
// 
//           if (existingChat) {
//             console.log("🔍 [CHAT] Chat existant trouvé:", existingChat._id);
//             chatId = existingChat._id;
//             signal.chatId = chatId;
//             console.log("✅ [CHAT] Utilisation du chat existant");
//           }
//         } else {
//           // Relancer l'erreur pour les autres cas
//           throw chatError;
//         }
//       }
// 
//       // 7. NOTIFICATION TEMPS RÉEL
//       console.log("📨 [NOTIF] Envoi notification...");
//       const io = req.app.get("io");
// 
//       if (io) {
//         const socketService = require("../services/socketServices");
// 
//         // Vérifier si l'expéditeur est connecté
//         const isFromUserOnline = socketService.isUserOnline(
//           signal.fromUserId._id.toString()
//         );
//         console.log(
//           `📨 [NOTIF] Expéditeur ${signal.fromUserId.username} en ligne: ${isFromUserOnline}`
//         );
// 
//         if (isFromUserOnline) {
//           const acceptedByUser = await User.findById(userId).select(
//             "username profilePicture"
//           );
//           console.log(`📨 [NOTIF] Accepté par: ${acceptedByUser.username}`);
// 
//           const notificationSent = socketService.notifySignalAccepted(
//             io,
//             signal.fromUserId._id,
//             acceptedByUser,
//             chatId
//           );
// 
//           console.log(`📨 [NOTIF] Notification envoyée: ${notificationSent}`);
//         } else {
//           console.log(
//             "📨 [NOTIF] Expéditeur non connecté, notification non envoyée"
//           );
//         }
//       } else {
//         console.log("❌ [NOTIF] IO non disponible");
//       }
//     }
//     // SI REFUSE
//     if (response === "ignored") {
//       //  NOTIFICATION TEMPS RÉEL
//       console.log("📨 [NOTIF] Envoi notification...");
//       const io = req.app.get("io");
// 
//       if (io) {
//         const socketService = require("../services/socketServices");
// 
//         // Vérifier si l'expéditeur est connecté
//         const isFromUserOnline = socketService.isUserOnline(
//           signal.fromUserId._id.toString()
//         );
//         console.log(
//           `📨 [NOTIF] Expéditeur ${signal.fromUserId.username} en ligne: ${isFromUserOnline}`
//         );
// 
//         if (isFromUserOnline) {
//           const declinedByUser = await User.findById(userId).select(
//             "username profilePicture"
//           );
//           const notificationSent = socketService.notifySignalDeclined(
//             io,
//             signal.fromUserId._id,
//             declinedByUser
//           );
// 
//           console.log(`📨 [NOTIF] Notification envoyée: ${notificationSent}`);
//         } else {
//           console.log(
//             "📨 [NOTIF] Expéditeur non connecté, notification non envoyée"
//           );
//         }
//       } else {
//         console.log("❌ [NOTIF] IO non disponible");
//       }
//     }
//     // 8. SAUVEGARDER LE SIGNAL
//     console.log("💾 Sauvegarde du signal...");
//     await signal.save();
//     console.log("✅ Signal sauvegardé avec chatId:", signal.chatId);
// 
//     // 9. RÉPONSE FINALE
//     const responseData = {
//       success: true,
//       message:
//         response === "accepted"
//           ? "Signal accepté ! Chat créé."
//           : "Signal décliné.",
//       data: {
//         chatId: chatId,
//         signal: {
//           _id: signal._id,
//           status: signal.status,
//           fromUser: {
//             _id: signal.fromUserId._id,
//             username: signal.fromUserId.username,
//             profilePicture: signal.fromUserId.profilePicture,
//           },
//         },
//       },
//     };
// 
//     console.log("📤 [REPONSE] Envoi réponse finale:", responseData);
//     res.json(responseData);
//     console.log("🎉 [SIGNAL] FIN respondToSignal - SUCCÈS");
//   } catch (error) {
//     console.error("💥 [SIGNAL] ERREUR CRITIQUE respondToSignal:", error);
//     console.error("📝 [SIGNAL] Stack:", error.stack);
//     res.status(500).json({
//       success: false,
//       message: "Erreur lors de la réponse au signal.",
//       error: process.env.NODE_ENV === "development" ? error.message : undefined,
//     });
//   }
// };
const respondToSignal = async (req, res) => {
  try {
    console.log("🎯 [SIGNAL] DEBUT respondToSignal");
    console.log("📦 Body reçu:", req.body);
    console.log("👤 User ID:", req.user._id);

    const { signalId, response } = req.body;
    const userId = req.user._id;

    // 1. VALIDATION
    if (!signalId || !response) {
      console.log("❌ Données manquantes");
      return res.status(400).json({
        success: false,
        message: "SignalId et réponse requis.",
      });
    }

    if (!["accepted", "ignored"].includes(response)) {
      console.log("❌ Réponse invalide:", response);
      return res.status(400).json({
        success: false,
        message: "Réponse invalide.",
      });
    }

    // 2. TROUVER LE SIGNAL
    console.log("🔍 Recherche signal:", signalId);
    const signal = await Signal.findById(signalId)
      .populate("fromUserId", "username profilePicture")
      .populate("toUserId", "username profilePicture");

    if (!signal) {
      console.log("❌ Signal non trouvé");
      return res.status(404).json({
        success: false,
        message: "Signal non trouvé.",
      });
    }

    console.log("✅ Signal trouvé:", {
      id: signal._id,
      from: signal.fromUserId?.username,
      to: signal.toUserId?.username,
      status: signal.status,
    });

    // 3. VÉRIFIER LES AUTORISATIONS
    console.log("🔐 Vérification autorisations...");

    // Vérification par userId (plus fiable)
    const isAuthorized = signal.toUserId._id.toString() === userId.toString();

    if (!isAuthorized) {
      console.log("❌ Non autorisé - UserId mismatch");
      console.log("   Signal.toUserId:", signal.toUserId._id.toString());
      console.log("   User actuel:", userId.toString());
      return res.status(403).json({
        success: false,
        message: "Non autorisé à répondre à ce signal.",
      });
    }

    console.log("✅ Autorisation OK");

    // 4. VÉRIFIER SI DÉJÀ TRAITÉ
    if (signal.status !== "pending") {
      console.log("⚠️ Signal déjà traité:", signal.status);
      return res.status(400).json({
        success: false,
        message: "Ce signal a déjà été traité.",
      });
    }

    // 5. METTRE À JOUR LE STATUT
    console.log("🔄 Mise à jour statut:", response);
    signal.status = response;
    signal.respondedAt = new Date();

    let chatId = null;

    // 6. SI ACCEPTÉ, VÉRIFIER ET CRÉER UN CHAT
    if (response === "accepted") {
      console.log("💬 [CHAT] Début création chat pour signal:", signalId);

      // VÉRIFIER SI UN CHAT EXISTE DÉJÀ ENTRE CES DEUX UTILISATEURS
      console.log("🔍 [CHAT] Vérification chat existant...");
      const existingChat = await Chat.findOne({
        $or: [
          {
            participant1: signal.fromUserId._id,
            participant2: signal.toUserId._id,
          },
          {
            participant1: signal.toUserId._id,
            participant2: signal.fromUserId._id,
          },
        ],
        isActive: true,
      }).populate("participant1 participant2", "username");

      if (existingChat) {
       
        // Mettre à jour le signal avec l'ID du chat existant
        // signal.chatId = existingChat._id;
        // chatId = existingChat._id;

        // console.log("✅ [CHAT] Utilisation du chat existant");

        return res.status(400).json({
          success: false,
          message: `Il y a déjà un CHAT entre ${signal.toUserId.username} et ${signal.fromUserId.username} . Rendez-vous dans CHAT !`,
          // data: {
          //   chatId: existingChat._id,
          //   chatExists: true,
          //   signal: {
          //     _id: signal._id,
          //     status: "accepted",
          //     fromUser: {
          //       _id: signal.fromUserId._id,
          //       username: signal.fromUserId.username,
          //       profilePicture: signal.fromUserId.profilePicture,
          //     },
          //   },
          // },
        });
      }

      console.log("✅ [CHAT] Aucun chat existant trouvé, création...");

      try {
        // Vérifier que les ObjectId sont valides
        const isValid1 = mongoose.Types.ObjectId.isValid(signal.fromUserId._id);
        const isValid2 = mongoose.Types.ObjectId.isValid(signal.toUserId._id);
        console.log("   ✅ Participant1 ObjectId valide:", isValid1);
        console.log("   ✅ Participant2 ObjectId valide:", isValid2);

        if (!isValid1 || !isValid2) {
          throw new Error("ObjectId invalide pour les participants");
        }

        // 🔥 CRÉATION DU NOUVEAU CHAT
        const chatData = {
          participant1: signal.fromUserId._id,
          participant2: signal.toUserId._id,
          initiatedFromSignal: signalId,
          lastActivity: new Date(),
          lastMessage: "Conversation démarrée",
          isActive: true,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 jours
        };

        console.log("📦 [CHAT] Données de création:", chatData);

        const chat = await Chat.create(chatData);
        console.log("✅ [CHAT] Chat créé avec succès! ID:", chat._id);

        chatId = chat._id;
        signal.chatId = chatId;

        // 🔥 VÉRIFICATION IMMÉDIATE
        console.log("🔎 [CHAT] Vérification en base...");
        const savedChat = await Chat.findById(chat._id)
          .populate("participant1", "username")
          .populate("participant2", "username");

        if (savedChat) {
          console.log("✅ [CHAT] Chat confirmé en base:", {
            id: savedChat._id,
            participant1: savedChat.participant1.username,
            participant2: savedChat.participant2.username,
            isActive: savedChat.isActive,
          });
        } else {
          console.log("❌ [CHAT] Chat NON TROUVÉ en base après création!");
        }
      } catch (chatError) {
        console.error("❌ [CHAT] ERREUR création chat:", chatError.message);
        console.error("📝 [CHAT] Stack:", chatError.stack);

        // Gestion spécifique des erreurs
        if (chatError.code === 11000) {
          console.log("⚠️ [CHAT] Erreur de doublon - Chat déjà existant");

          // Chercher le chat existant (dernière vérification)
          const existingChat = await Chat.findOne({
            $or: [
              {
                participant1: signal.fromUserId._id,
                participant2: signal.toUserId._id,
              },
              {
                participant1: signal.toUserId._id,
                participant2: signal.fromUserId._id,
              },
            ],
          }).populate("participant1 participant2");

          if (existingChat) {
            console.log("🔍 [CHAT] Chat existant trouvé:", existingChat._id);
            return res.status(401).json({
              success:false,
              message:"Vous avez déjà accepté son signal regar"
            })
            // chatId = existingChat._id;
            // signal.chatId = chatId;
            // console.log("✅ [CHAT] Utilisation du chat existant");
          }
        } else {
          // Relancer l'erreur pour les autres cas
          throw chatError;
        }
      }

      // 7. NOTIFICATION TEMPS RÉEL
      console.log("📨 [NOTIF] Envoi notification...");
      const io = req.app.get("io");

      if (io) {
        const socketService = require("../services/socketServices");

        // Vérifier si l'expéditeur est connecté
        const isFromUserOnline = socketService.isUserOnline(
          signal.fromUserId._id.toString()
        );
        console.log(
          `📨 [NOTIF] Expéditeur ${signal.fromUserId.username} en ligne: ${isFromUserOnline}`
        );

        if (isFromUserOnline) {
          const acceptedByUser = await User.findById(userId).select(
            "username profilePicture"
          );
          console.log(`📨 [NOTIF] Accepté par: ${acceptedByUser.username}`);

          const notificationSent = socketService.notifySignalAccepted(
            io,
            signal.fromUserId._id,
            acceptedByUser,
            chatId
          );

          console.log(`📨 [NOTIF] Notification envoyée: ${notificationSent}`);
        } else {
          console.log(
            "📨 [NOTIF] Expéditeur non connecté, notification non envoyée"
          );
        }
      } else {
        console.log("❌ [NOTIF] IO non disponible");
      }
    }

    // SI IGNORÉ
    if (response === "ignored") {
      // NOTIFICATION TEMPS RÉEL
      console.log("📨 [NOTIF] Envoi notification signal ignoré...");
      const io = req.app.get("io");

      if (io) {
        const socketService = require("../services/socketServices");

        // Vérifier si l'expéditeur est connecté
        const isFromUserOnline = socketService.isUserOnline(
          signal.fromUserId._id.toString()
        );
        console.log(
          `📨 [NOTIF] Expéditeur ${signal.fromUserId.username} en ligne: ${isFromUserOnline}`
        );

        if (isFromUserOnline) {
          const declinedByUser = await User.findById(userId).select(
            "username profilePicture"
          );
          const notificationSent = socketService.notifySignalDeclined(
            io,
            signal.fromUserId._id,
            declinedByUser
          );

          console.log(`📨 [NOTIF] Notification envoyée: ${notificationSent}`);
        } else {
          console.log(
            "📨 [NOTIF] Expéditeur non connecté, notification non envoyée"
          );
        }
      } else {
        console.log("❌ [NOTIF] IO non disponible");
      }
    }

    // 8. SAUVEGARDER LE SIGNAL
    console.log("💾 Sauvegarde du signal...");
    await signal.save();
    console.log("✅ Signal sauvegardé avec chatId:", signal.chatId);

    // 9. RÉPONSE FINALE
    const responseData = {
      success: true,
      message:
        response === "accepted"
          ? "Signal accepté ! Chat créé."
          : "Signal ignoré.",
      data: {
        chatId: chatId,
        chatExists: chatId !== null,
        signal: {
          _id: signal._id,
          status: signal.status,
          fromUser: {
            _id: signal.fromUserId._id,
            username: signal.fromUserId.username,
            profilePicture: signal.fromUserId.profilePicture,
          },
        },
      },
    };

    console.log("📤 [REPONSE] Envoi réponse finale:", responseData);
    res.json(responseData);
    console.log("🎉 [SIGNAL] FIN respondToSignal - SUCCÈS");
  } catch (error) {
    console.error("💥 [SIGNAL] ERREUR CRITIQUE respondToSignal:", error);
    console.error("📝 [SIGNAL] Stack:", error.stack);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la réponse au signal.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
// À AJOUTER dans vos contrôleurs backend
// @desc    Récupérer les signaux reçus
// @route   GET /api/signals/received
// @access  Privé
const getReceivedSignals = async (req, res) => {
  try {
    const userId = req.user._id;

    // Trouver la session active de l'utilisateur
    const userSession = await UserSession.findOne({ userId, isActive: true });
    if (!userSession) {
      return res.status(404).json({
        success: false,
        message: "Aucune session active trouvée",
      });
    }

    // Récupérer les signaux où l'utilisateur est le destinataire
    const signals = await Signal.find({
      toUserId: userId,
    })
      .populate("fromUserId", "username profilePicture interests")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: signals,
      count: signals.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des signaux",
    });
  }
};
// Supprimer un signal
// @route Patch /api/signals/delete/:signalid
const deleteOneSignal = async (req, res) => {
  const { signalId } = req.params;
  const userId = req.user._id;
  try {
    if (!signalId) {
      return res.status(400).json({
        success: false,
        message: "Signal ID est réquis",
      });
    }

    const signal = await Signal.deleteOne({ _id: signalId });

    if (!signal) {
      return res.status(401).json({
        success: false,
        message: "le signal est invalide ",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Le signal est supprimé",
    });
    console.log("les signau est  supprimé :", signal);
  } catch (error) {
    console.log("Error delete signal :", error);
  }
};
module.exports = {
  sendSignal,
  respondToSignal,
  getReceivedSignals,
  deleteOneSignal,
};
