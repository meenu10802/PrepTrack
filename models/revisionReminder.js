const mongoose = require('mongoose');

const revisionReminderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  question: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true
  },
  topic: {
    type: String
  },
  reminderAt: {
    type: Date,
    required: true
  },
  sent: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('RevisionReminder', revisionReminderSchema);

