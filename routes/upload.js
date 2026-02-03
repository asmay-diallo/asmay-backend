const express = require("express");
const router = express.Router();
const {
  uploadProfilePicture,
  getFile,
   uploadVoiceMessage,    // NOUVEAU
  getVoiceMessage,  
} = require("../controllers/uploadController");
const { protect } = require("../middleware/auth");

router.post("/profile", protect, uploadProfilePicture);
router.get("/:filename",protect, getFile);
router.post('/voice/:chatId', protect, uploadVoiceMessage);
router.get('/voice/:filename', protect, getVoiceMessage);


module.exports = router;
