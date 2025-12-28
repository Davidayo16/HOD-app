const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const { auth, isHOD } = require('../middleware/auth');

// Create appointment (Student only)
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role === 'hod') {
      return res.status(403).json({ message: 'HOD cannot create appointments' });
    }

    const { date, time, purpose, notes } = req.body;

    // Check if appointment time slot is already taken
    const existingAppointment = await Appointment.findOne({
      date: new Date(date),
      time,
      status: { $in: ['pending', 'approved'] }
    });

    if (existingAppointment) {
      return res.status(400).json({ message: 'This time slot is already booked' });
    }

    const appointment = new Appointment({
      student: req.user._id,
      studentName: req.user.name,
      studentEmail: req.user.email,
      studentId: req.user.studentId || 'N/A',
      date: new Date(date),
      time,
      purpose,
      notes
    });

    await appointment.save();
    await appointment.populate('student', 'name email studentId');

    res.status(201).json(appointment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all appointments (HOD sees all, Student sees only their own)
router.get('/', auth, async (req, res) => {
  try {
    let appointments;
    
    if (req.user.role === 'hod') {
      appointments = await Appointment.find()
        .populate('student', 'name email studentId')
        .sort({ date: -1, time: -1 });
    } else {
      appointments = await Appointment.find({ student: req.user._id })
        .sort({ date: -1, time: -1 });
    }

    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single appointment
router.get('/:id', auth, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('student', 'name email studentId');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Students can only view their own appointments
    if (req.user.role === 'student' && appointment.student._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(appointment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update appointment status (HOD only)
router.patch('/:id/status', auth, isHOD, async (req, res) => {
  try {
    const { status, hodNotes } = req.body;

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    appointment.status = status;
    if (hodNotes) {
      appointment.hodNotes = hodNotes;
    }

    await appointment.save();
    await appointment.populate('student', 'name email studentId');

    res.json(appointment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update appointment (Student can update their own pending appointments)
router.put('/:id', auth, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Students can only update their own pending appointments
    if (req.user.role === 'student') {
      if (appointment.student.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
      if (appointment.status !== 'pending') {
        return res.status(400).json({ message: 'Can only update pending appointments' });
      }
    }

    const { date, time, purpose, notes } = req.body;

    // Check if new time slot is available (if time changed)
    if (time && time !== appointment.time) {
      const existingAppointment = await Appointment.findOne({
        date: date ? new Date(date) : appointment.date,
        time,
        status: { $in: ['pending', 'approved'] },
        _id: { $ne: appointment._id }
      });

      if (existingAppointment) {
        return res.status(400).json({ message: 'This time slot is already booked' });
      }
    }

    if (date) appointment.date = new Date(date);
    if (time) appointment.time = time;
    if (purpose) appointment.purpose = purpose;
    if (notes !== undefined) appointment.notes = notes;

    await appointment.save();
    await appointment.populate('student', 'name email studentId');

    res.json(appointment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete appointment (Student can delete their own, HOD can delete any)
router.delete('/:id', auth, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Students can only delete their own appointments
    if (req.user.role === 'student' && appointment.student.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await Appointment.findByIdAndDelete(req.params.id);
    res.json({ message: 'Appointment deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get available time slots for a date
router.get('/availability/:date', auth, async (req, res) => {
  try {
    const dateStr = req.params.date;
    const startDate = new Date(dateStr);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(dateStr);
    endDate.setHours(23, 59, 59, 999);
    
    const bookedSlots = await Appointment.find({
      date: {
        $gte: startDate,
        $lte: endDate
      },
      status: { $in: ['pending', 'approved'] }
    }).select('time');

    const bookedTimes = bookedSlots.map(slot => slot.time);
    
    // Standard office hours (9 AM to 5 PM, hourly slots)
    const allSlots = [];
    for (let hour = 9; hour < 17; hour++) {
      const time = `${hour.toString().padStart(2, '0')}:00`;
      allSlots.push({
        time,
        available: !bookedTimes.includes(time)
      });
    }

    res.json(allSlots);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

