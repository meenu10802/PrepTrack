const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  source: { type: String },
  /** Legacy: older builds stored OpenRouter reasoning payloads; no longer written */
  reasoningDetails: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
});

const chatConversationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    topic: { type: String, default: 'DBMS' },
    title: { type: String, maxlength: 200 },
    messages: [chatMessageSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('ChatConversation', chatConversationSchema);
