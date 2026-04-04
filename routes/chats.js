// const express = require('express');
// const { getUserChats, sendMessage, getChatMessages,sendVoiceMessage } = require('../controllers/chatController');
// const { protect } = require('../middleware/auth');
// const router = express.Router();
// 
// router.route('/').get(protect, getUserChats);
// router.route('/:chatId/messages').get(protect, getChatMessages).post(protect, sendMessage);
// router.post('/:chatId/voice', protect, sendVoiceMessage);
// 
// module.exports = router;
// // ________________________________________


// // routes/chat.js
// const express = require('express');
// const { getUserChats, sendMessage, getChatMessages, sendVoiceMessage } = require('../controllers/chatController');
// const { protect } = require('../middleware/auth');
// const multer = require('multer');
// 
// // Configuration multer pour les messages vocaux
// const voiceStorage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, 'uploads/voice_messages/');
//   },
//   filename: function (req, file, cb) {
//     const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//     cb(null, 'voice-' + uniqueSuffix + path.extname(file.originalname));
//   }
// });
// 
// const uploadVoice = multer({
//   storage: voiceStorage,
//   fileFilter: (req, file, cb) => {
//     if (file.mimetype.startsWith('audio/')) {
//       cb(null, true);
//     } else {
//       cb(new Error('Seuls les fichiers audio sont autorisés'), false);
//     }
//   },
//   limits: { fileSize: 10 * 1024 * 1024 } // 10MB
// });
// 
// const router = express.Router();
// 
// router.route('/').get(protect, getUserChats);
// router.route('/:chatId/messages').get(protect, getChatMessages).post(protect, sendMessage);
// router.post('/:chatId/voice', protect, uploadVoice.single('audio'), sendVoiceMessage); // AJOUT DU MIDDLEWARE MULTER
// 
// module.exports = router;  



// routes/chat.js
const express = require('express');
const multer = require('multer');
const path = require('path'); // AJOUTER CET IMPORT
const fs = require('fs');
const { protect } = require('../middleware/auth');
const { 
  getUserChats, 
  sendMessage, 
  getChatMessages, 
  sendVoiceMessage ,
  deleteOneChat,
  deleteYourMessage
} = require('../controllers/chatController');

const router = express.Router();

// Configuration de multer pour les messages vocaux
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/voice_messages/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // ✅ CORRECTION : Utiliser path.extname
    cb(null, `voice_${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'audio/mpeg',        // mp3
      'audio/mp4',         // m4a, mp4
      'audio/mp4a-latm',   // m4a (variante)
      'audio/aac',         // aac
      'audio/x-m4a',       // m4a
      'audio/x-aac',       // aac
      'audio/wav',         // wav
      'audio/x-wav',       // wav
      'audio/ogg',         // ogg
      'audio/webm',        // webm
      'audio/x-caf',       // caf (iOS audio)
      'audio/amr',         // amr
      'audio/3gpp',        // 3gp
      'audio/3gpp2',       // 3g2
      'audio/basic',       // au
      'audio/aiff',        // aiff
      'audio/flac',        // flac
      'audio/x-mpegurl',   // m3u
      'audio/midi',        // mid
      'audio/x-midi',      // midi
      'application/octet-stream', // Fichier binaire générique
      'audio/*'        // webm
    ];
    
   // Accepter tous les fichiers audio
    if (file.mimetype.startsWith('audio/') || 
        file.mimetype === 'application/octet-stream' ||
        allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      console.error('❌ Type MIME refusé:', file.mimetype);
      cb(new Error(`Type de fichier non supporté: ${file.mimetype}`), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Routes
router.get('/', protect, getUserChats);
router.get('/:chatId/messages', protect, getChatMessages);
router.post('/:chatId/messages', protect, sendMessage);
router.post('/:chatId/voice', protect, upload.single('audio'), sendVoiceMessage);
router.delete('/delete/:chatId',protect,deleteOneChat)
router.delete('/:chatId/messages/delete/:messsageId',protect,deleteYourMessage)

module.exports = router;