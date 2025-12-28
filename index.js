const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
let MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hod-appointments';

// Fix MongoDB Atlas connection string if database name is missing
if (MONGODB_URI.includes('mongodb+srv://') && !MONGODB_URI.match(/\/[^/?]+(\?|$)/)) {
  // Add database name if missing
  const separator = MONGODB_URI.includes('?') ? '&' : '?';
  MONGODB_URI = MONGODB_URI.replace(/\/(\?|$)/, '/hod-appointments$1');
  if (!MONGODB_URI.includes('retryWrites')) {
    MONGODB_URI += `${separator}retryWrites=true&w=majority`;
  }
}

const mongooseOptions = {
  // MongoDB Atlas requires SSL/TLS
  ...(MONGODB_URI.includes('mongodb+srv://') && {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
};

mongoose.connect(MONGODB_URI, mongooseOptions)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    console.error('Please check your MONGODB_URI in .env file');
    console.error('Make sure your IP is whitelisted in MongoDB Atlas');
  });

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/appointments', require('./routes/appointments'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ message: 'Server is running' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

