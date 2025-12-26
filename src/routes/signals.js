const express = require('express');
const { sendSignal, respondToSignal, getReceivedSignals,deleteOneSignal } = require('../controllers/signalController');
const { protect } = require('../middleware/auth');
const router = express.Router();

router.route('/send').post(protect, sendSignal);
router.route('/respond').post(protect, respondToSignal);
router.route('/received').get(protect,getReceivedSignals)
router.route('/delete/:signalId').delete(protect,deleteOneSignal)

module.exports = router;
