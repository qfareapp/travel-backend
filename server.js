require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

/* ======================= Middleware ======================= */
app.use(cors({
  origin: "*", // allow all for now, lock later to Vercel domain
  methods: ["GET","POST","PUT","DELETE"],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR));

/* ======================= Routes ======================= */
const circuitRoutes = require('./routes/circuitRoutes');
const homestayRoutes = require('./routes/homestayRoutes');
const itineraryRoutes = require('./routes/itineraryRoutes');
// const bookingRoutes = require('./routes/bookingRoutes');

app.use('/api/circuits', circuitRoutes);
app.use('/api/homestays', homestayRoutes);
app.use('/api/itineraries', itineraryRoutes);
// app.use('/api/bookings', bookingRoutes);

// Health check
app.get('/', (_req, res) => {
  res.send('🌍 Travel API is running...');
});

/* ======================= Server + MongoDB ======================= */
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

app.listen(PORT, () => {
  console.log(`🚀 Server running at port ${PORT}`);
  console.log(`📂 Serving uploads from: ${UPLOAD_DIR}`);
});

// connect DB after server starts
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });
