const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  studentName: {
    type: String,
    required: true
  },
  studentEmail: {
    type: String,
    required: true
  },
  studentId: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  purpose: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'completed', 'cancelled'],
    default: 'pending'
  },
  notes: {
    type: String,
    trim: true
  },
  hodNotes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
appointmentSchema.index({ date: 1, time: 1 });
appointmentSchema.index({ student: 1, date: -1 });

module.exports = mongoose.model('Appointment', appointmentSchema);

