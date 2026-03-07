//
const mongoose = require("mongoose");
 const userSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    unique: true,
  // index:true,
  },
  lastKnownGeohash: {
    type: String,
    required: true,
    index: true
  },
  lat: {
    type: Number,
    required: true
  },
  lon: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});


userSessionSchema.index({ lastKnownGeohash: 1, isActive: 1, lastUpdated: -1 });
userSessionSchema.index({ userId: 1, lastUpdated: -1 });
module.exports = mongoose.model("UserSession", userSessionSchema);
