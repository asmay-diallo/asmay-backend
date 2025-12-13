const express = require("express");
const router = express.Router();
const {
  uploadProfilePicture,
  getFile,
} = require("../controllers/uploadController");
const { protect } = require("../middleware/auth");

router.post("/profile", protect, uploadProfilePicture);
router.get("/:filename",protect, getFile);

module.exports = router;
