
const Chat = require("../models/Chat");
const Message = require("../models/Message");
const User = require("../models/User");
const asyncHandler = require("../middleware/asyncHandler");


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

    //  Formater la réponse pour correspondre au frontend
    const formattedChats = chats.map((chat) => ({
      _id: chat._id,
      participant1: chat.participant1,
      participant2: chat.participant2,
      lastActivity: chat.lastActivity,
      expiresAt: chat.expiresAt,
      isActive: chat.isActive,
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
      chatId: chatId, 
      sender: senderId,
      content,
    });

    // 3. Peupler les données pour la réponse
    await message.populate("sender", "username profilePicture");

    // 4. Mettre à jour la dernière activité du chat
    chat.lastActivity = new Date();
    chat.lastMessage = content
    chat.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await chat.save();

    // 5.  Émettre l'événement socket
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
        chatId: chatId,
        createdAt: message.createdAt,
      };

      // Émettre à tous les participants du chat
      io.to(`chat_${chatId}`).emit("new_message", messageData);

      // Émettre une mise à jour de la liste des chats
      const otherParticipantId =
        chat.participant1.toString() === senderId.toString()
          ? chat.participant2
          : chat.participant1;
  //  Émettre la mise à jour du chat pour l'expéditeur
      io.to(`user_${senderId}`).emit("chat_updated", {
        _id: chat._id,
        lastActivity: chat.lastActivity,
        lastMessage: content,
        senderId: senderId,
        unreadCount: 0 // Pour l'expéditeur
      });
      console.log(`📨 chat_updated émis à expéditeur ${senderId}`);

      //  Émettre la mise à jour du chat pour le destinataire
      io.to(`user_${otherParticipantId._id}`).emit("chat_updated", {
        _id: chat._id,
        lastActivity: chat.lastActivity,
        lastMessage: content,
        senderId: senderId,
        unreadCount: 1 //  IMPORTANT: Pour le destinataire
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
const getChatMessages =asyncHandler(async (req, res) => {
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

    const messages = await Message.find({ chatId: chatId })
      .populate("sender", "username profilePicture")
      .sort({ createdAt: 1 });

    // Formater pour le frontend
    const formattedMessages = messages.map((msg) => ({
      _id: msg._id,
      sender: {
        _id: msg.sender._id,
        username: msg.sender.username,
        profilePicture: msg.sender.profilePicture,
      },
      content: msg.content,
      audioUrl: msg.audioUrl || null,  
      duration: msg.duration || 0,      
      type: msg.type || (msg.audioUrl ? 'audio' : 'text'),
      chatId: chatId,
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
});

const sendVoiceMessage = asyncHandler(async (req, res) => {
  try {
     const senderId = req.user._id;
    console.log('\n=== 🎤 DÉBUT sendVoiceMessage ===');
    console.log('📥 Données reçues:');
    console.log('- Chat ID:', req.params.chatId);
    console.log('- User ID:', req.user.id);
    console.log('- Fichier:', req.file?.filename);
    console.log('- Durée:', req.body.duration);

    // 1. Vérifier le fichier
    if (!req.file) {
      console.log('❌ ERREUR: Aucun fichier reçu');
      return res.status(400).json({
        success: false,
        message: "Aucun fichier audio reçu",
      });
    }

    // 2. Chercher le chat avec la bonne méthode
    console.log('\n🔍 Recherche du chat...');
    const chat = await Chat.findOne({
      _id: req.params.chatId,
      isActive: true,
      $or: [{ participant1: req.user.id }, { participant2: req.user.id }],
    });

    if (!chat) {
      console.log(' ERREUR: Chat non trouvé ou accès non autorisé');
      return res.status(404).json({
        success: false,
        message: "Chat non trouvé ou accès refusé",
      });
    }

    console.log('✅ Chat trouvé et utilisateur autorisé');

    // 3. URLs du fichier
    const audioUrl = `/uploads/voice_messages/${req.file.filename}`;
    const audioFullUrl = `${req.protocol}://${req.get("host")}${audioUrl}`;
    console.log('📁 URLs:', { audioUrl, audioFullUrl });

    // 4. Créer le message AVEC LE BON CHAMP
    console.log('\n💾 Création du message...');
    const messageData = {
      chatId: req.params.chatId,
      sender: req.user.id,
      content: '',
      audioUrl: audioUrl,
      duration: parseInt(req.body.duration) || 0,
      type: 'audio',
      tempId: req.body.tempId || null,
    };


    let message;
    try {
      message = await Message.create(messageData);
      console.log('✅ Message créé avec succès! ID:', message._id);
    } catch (createError) {
      console.error('❌ ERREUR création message:', createError.message);
      if (createError.name === 'ValidationError') {
        console.error('❌ Erreurs détaillées:', createError.errors);
      }
      throw createError;
    }

    // 5. Mettre à jour le chat
    console.log('\n🔄 Mise à jour du chat...');
    chat.lastActivity = new Date();
    chat.lastMessage = "🎤 Message vocal";
    await chat.save();
    console.log('✅ Chat mis à jour');

    // 6. Populer le message
    console.log('\n👤 Population du sender...');
    await message.populate('sender', 'username _id profilePicture');
    console.log('✅ Sender peuplé:', message.sender.username);

    // 7. Formater la réponse
    const responseData = {
      _id: message._id.toString(),
      sender: {
        _id: message.sender._id.toString(),
        username: message.sender.username,
        profilePicture: message.sender.profilePicture
      },
      audioUrl: audioUrl,
      audioFullUrl: audioFullUrl,
      duration: message.duration,
      chatId: req.params.chatId,
      type: 'audio',
      createdAt: message.createdAt,
      tempId: req.body.tempId
    };

    // 8. Émettre via socket
    const io = req.app.get('io');
    if (io) {
      console.log('\n📡 Émission socket...');
      io.to(`chat_${req.params.chatId}`).emit('new_voice_message', responseData);
       // Émettre une mise à jour de la liste des chats
      const otherParticipantId =
        chat.participant1.toString() === senderId.toString()
          ? chat.participant2
          : chat.participant1;
   io.to(`user_${senderId}`).emit("chat_updated", {
        _id: chat._id,
        lastActivity: chat.lastActivity,
        lastMessage: "🎤 Message vocal",
        senderId: senderId,
        unreadCount: 0
      });
      console.log(`📨 chat_updated émis à expéditeur ${senderId}`);

      //  Émettre la mise à jour du chat pour le destinataire
      io.to(`user_${otherParticipantId._id}`).emit("chat_updated", {
        _id: chat._id,
        lastActivity: chat.lastActivity,
        lastMessage: "🎤 Message vocal",
        senderId: senderId,
        unreadCount: 1
      });


    }

    // 9. Réponse HTTP
    console.log('\n🎉 Envoi réponse HTTP 201...');
    res.status(201).json({
      success: true,
      message: "Message vocal envoyé",
      data: responseData,
    });

    console.log('\n=== ✅ FIN sendVoiceMessage avec succès ===\n');

  } catch (error) {
    
    res.status(500).json({
      success: false,
      message: "Erreur serveur: " + error.message,
    });
  }
});
// Supprimer un signal
// @route Patch /api/chats/delete/:chatId
const deleteOneChat = asyncHandler(async (req,res)=>{
const {chatId} = req.params
const userId = req.user._id
try {
     if (!chatId) {
      return res.status(400).json({
        success: false,
        message: "ChatId ID est réquis",
      });
    }

  // Vérifie que c'est la personne qui a accepté le signal de conversation veut supprimer le chat
const chatToDelete = await Chat.findOne({
  _id:chatId,
  participant2:userId
})
if(!chatToDelete){
  return  res.status(400).json({
    success:false,
    message:"Ce chat ne peut être supprimer que par la personne qui a accepté le signal de la conversation "
  })
}
const chat = await Chat.deleteOne({_id:chatId})
   if (!chat) {
      return res.status(401).json({
        success: false,
        message: "Le chat invalide !",
      });
    }
return res.status(200).json({
  success:true,
  message:"Chat supprimé",
  data:chat
})


} catch (error) {
  return res.status(501).json({
    success:false,
    message:"Chat deleting Error : " + error.message
  })
}
})
const deleteYourMessage = asyncHandler(async (req,res)=>{
const {messageId,chatId} = req.params
const userId = req.user._id

try {
if(!messageId || !chatId){
  return res.status(401).json({
    success:false,
    message:"ID de message est réquis ou ce chat n'est pas valide !"
  })
}
// Vérifiez que c'est votre propre message que voulez supprimer
const messageToCheck = await Message.findOne({
  _id:messageId,
  chatId:chatId,
  sender:{
    _id:userId
  }
})
if(!messageToCheck){
  return res.status(401).json({
    success:false,
    message:"Vous ne pouvez supprimer que votre propre message dans ce Chat !"
  })
}
  // Alors on supprime le message 
const messageToDelete = await Message.deleteOne({_id:messageId})
if(!messageToDelete){
  return res.status(500).json({
    success:false,
    message:"ID du message est réquis !"
  })
}
// Réponse principale 
return res.status(200).json({
  success:true,
  message:"Message supprimé",
  data:messageToDelete
})
  
} catch (error) {
   return res.status(501).json({
    success:false,
    message:"Message Deleting Error : " + error.message
  })
}
})

module.exports = { getUserChats, sendMessage, getChatMessages ,sendVoiceMessage,deleteOneChat,deleteYourMessage};
