
const Chat = require("../models/Chat");
const Message = require("../models/Message");
const User = require("../models/User");

// @desc    Récupérer les chats actifs d'un utilisateur
// @route   GET /api/chats
// @access  Privé
const getUserChats = async (req, res) => {
  try {
    const userId = req.user._id;

    const chats = await Chat.find({
      isActive: true,
      $or: [{ participant1: userId }, { participant2: userId }],
    })
      .populate("participant1", "username profilePicture interests")
      .populate("participant2", "username profilePicture interests")
      .sort({ lastActivity: -1 });

    // 🔥 CORRECTION : Formater la réponse pour correspondre au frontend
    const formattedChats = chats.map((chat) => ({
      _id: chat._id,
      participant1: chat.participant1,
      participant2: chat.participant2,
      lastActivity: chat.lastActivity,
      expiresAt: chat.expiresAt,
      isActive: chat.isActive,
      // 🔥 AJOUT : Dernier message pour l'aperçu
      lastMessage: chat.lastMessage || "Démarrer la conversation",
    }));

    res.json({
      success: true,
      data: formattedChats,
    });
  } catch (error) {
    console.error("Error getUserChats:", error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur.",
    });
  }
};

// @desc    Envoyer un message dans un chat
// @route   POST /api/chats/:chatId/messages
// @access  Privé
const sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content } = req.body;
    const senderId = req.user._id;

    // 1. Vérifier l'accès au chat
    const chat = await Chat.findOne({
      _id: chatId,
      isActive: true,
      $or: [{ participant1: senderId }, { participant2: senderId }],
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat non trouvé.",
      });
    }

    // 2. Créer le message
    const message = await Message.create({
      chat: chatId, // 🔥 CORRECTION : Utiliser 'chat' au lieu de 'chatId'
      sender: senderId,
      content,
    });

    // 3. Peupler les données pour la réponse
    await message.populate("sender", "username profilePicture");

    // 4. Mettre à jour la dernière activité du chat
    chat.lastActivity = new Date();
    chat.lastMessage = content; // 🔥 AJOUT : Sauvegarder le dernier message
    chat.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await chat.save();

    // 5. 🔥 Émettre l'événement socket
    const io = req.app.get("io");
    if (io) {  
      // Formater les données pour le frontend
      const messageData = {
        _id: message._id,
        sender: {
          _id: message.sender._id,
          username: message.sender.username,
          profilePicture: message.sender.profilePicture,
        },
        content: message.content,
        chat: chatId,
        createdAt: message.createdAt,
      };

      // Émettre à tous les participants du chat
      io.to(`chat_${chatId}`).emit("new_message", messageData);

      // Émettre une mise à jour de la liste des chats
      const otherParticipantId =
        chat.participant1.toString() === senderId.toString()
          ? chat.participant2
          : chat.participant1;

      io.to(`user_${otherParticipantId}`).emit("chat_updated", {
        _id: chat._id,
        lastActivity: chat.lastActivity,
        lastMessage: chat.lastMessage,
      });
    }

    res.status(201).json({
      success: true,
      data: messageData || message,
    });
  } catch (error) {
    console.error("Error sendMessage:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'envoi du message.",
    });
  }
};

// @desc    Récupérer les messages d'un chat
// @route   GET /api/chats/:chatId/messages
// @access  Privé
const getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    // Vérifier l'accès au chat
    const chat = await Chat.findOne({
      _id: chatId,
      isActive: true,
      $or: [{ participant1: userId }, { participant2: userId }],
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat non trouvé.",
      });
    }

    const messages = await Message.find({ chat: chatId })
      .populate("sender", "username profilePicture")
      .sort({ createdAt: 1 });

    // 🔥 CORRECTION : Formater pour le frontend
    const formattedMessages = messages.map((msg) => ({
      _id: msg._id,
      sender: {
        _id: msg.sender._id,
        username: msg.sender.username,
        profilePicture: msg.sender.profilePicture,
      },
      content: msg.content,
      chat: chatId,
      createdAt: msg.createdAt,
    }));

    res.json({
      success: true,
      data: formattedMessages,
    });
  } catch (error) {
    console.error("Error getChatMessages:", error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur.",
    });
  }
};

module.exports = { getUserChats, sendMessage, getChatMessages };
