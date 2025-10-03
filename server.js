require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

/* ======================= Middleware ======================= */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images from the same place Multer writes to (process.cwd()/uploads)
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* ======================= Routes ======================= */
const circuitRoutes = require('./routes/circuitRoutes');
const homestayRoutes = require('./routes/homestayRoutes'); // make sure this file defines `/:id/detail`
const itineraryRoutes = require('./routes/itineraryRoutes');
// const bookingRoutes = require('./routes/bookingRoutes'); // Enable when ready

app.use('/api/circuits', circuitRoutes);
app.use('/api/homestays', homestayRoutes);
app.use('/api/itineraries', itineraryRoutes);   
// app.use('/api/bookings', bookingRoutes);

// Health check
app.get('/', (_req, res) => {
  res.send('🌍 Travel API is running...');
});

/* ======================= MongoDB ======================= */
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
      console.log(`📂 Serving uploads from: ${UPLOAD_DIR}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });
