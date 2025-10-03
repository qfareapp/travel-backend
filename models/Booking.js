// models/Booking.js
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  customerName: {
    type: String,
    required: true
  },
  customerContact: {
    type: String,
    required: true
  },
  pax: {
    type: Number,
    required: true
  },
  days: {
    type: Number,
    required: true
  },
  circuit: {
    type: String,
    required: true
  },
  theme: {
    type: String
  },
  homestay: {
    name: String,
    priceType: String,
    pricePerDay: Number,
    total: Number,
    distance: Number,
    contact: String,
    rooms: String
  },
  transport: {
    pickup: String,
    drop: String,
    carType: String,
    ratePerKm: Number,
    totalKm: Number,
    total: Number
  },
  itinerary: [
    {
      day: Number,
      activity: String
    }
  ],
  totalCost: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['Generated', 'Booked', 'Cancelled'],
    default: 'Generated'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Booking', bookingSchema);
