const express = require('express');
const { sendSignal, respondToSignal, getReceivedSignals } = require('../controllers/signalController');
const { protect } = require('../middleware/auth');
const router = express.Router();

router.route('/send').post(protect, sendSignal);
router.route('/respond').post(protect, respondToSignal);
router.route('/received').get(protect,getReceivedSignals)

module.exports = router;
