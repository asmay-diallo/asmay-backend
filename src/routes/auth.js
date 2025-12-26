// const express = require('express');
const { register, login, logout } = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const express = require("express");

const router = express.Router();

router.post("/register", register);
router.post("/login",protect, login);
router.post("/logout", protect, logout);

module.exports = router;
