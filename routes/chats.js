const express = require('express');
const { getUserChats, sendMessage, getChatMessages } = require('../controllers/chatController');
const { protect } = require('../middleware/auth');
const router = express.Router();

router.route('/').get(protect, getUserChats);
router.route('/:chatId/messages').get(protect, getChatMessages).post(protect, sendMessage);

module.exports = router;
// ________________________________________
