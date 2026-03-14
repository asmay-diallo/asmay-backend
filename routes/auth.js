// const express = require('express');
const {
     register, 
     login,
    logout,
    sendVerificationCode,verifyCode, 
   resendCode } = require("../controllers/authController");
const express = require("express");

const router = express.Router();

// Routes de vérification email 
router.post("/send-verification", sendVerificationCode);
router.post("/verify-code", verifyCode);
router.post("/resend-code", resendCode);


router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);

module.exports = router;
