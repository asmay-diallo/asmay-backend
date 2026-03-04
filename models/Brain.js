const mongoose = require("mongoose")


const brainSchema = new mongoose.Schema(
     {
    posterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref:'User',
      required: true,

    },
    message: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    picture: {
      type: String,
      default: "",
    },
    video: {
      type: String,
    },
    likers: {
      type: [String],
      required: true,
      ref:'User'
    },
    comments: {
      type: [
        {
          commenterId: String,
          commenterPseudo: String,
          text: String,
          timestamp: Number,
        },
      ],
      required: true,
    },
  },
  {
    timestamp: true,
  }
)

module.exports = mongoose.model("Brain",brainSchema)