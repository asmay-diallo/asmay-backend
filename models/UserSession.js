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

// TTL index - supprime automatiquement après 24h
// userSessionSchema.index({ lastUpdated: 1 }, { expireAfterSeconds: 86400 });

// const mongoose = require("mongoose");
// 
// const userSessionSchema = new mongoose.Schema(
//   {
//     userId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//       index: true,
//     },
//     sessionId: {
//       type: String,
//       required: true,
//       // ❌ SUPPRIMEZ: unique: true
//     },
//     lastKnownGeohash: {
//       type: String,
//       required: true,
//       index: true,
//     },
//     lat: {
//       type: Number,
//       required: true,
//     },
//     lon: {
//       type: Number,
//       required: true,
//     },
//     isActive: {
//       type: Boolean,
//       default: true,
//       index: true,
//     },
//     lastUpdated: {
//       type: Date,
//       default: Date.now,
//       index: true,
//     },
//   },
//   {
//     timestamps: true,
//   }
// );
// 
// // ✅ Index composé pour garantir l'unicité userId + sessionId
userSessionSchema.index({ userId: 1, sessionId: 1 }, { unique: true });
// 
// // TTL index
userSessionSchema.index( { expireAfterSeconds: 86400 });
module.exports = mongoose.model("UserSession", userSessionSchema);
