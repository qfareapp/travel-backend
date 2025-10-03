const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const itineraryController = require('../controllers/itineraryController');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Multer storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});

const upload = multer({ storage });

// POST /api/itinerary - create itinerary with images
router.post(
  '/',
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'localGuideImage', maxCount: 1 }
  ]),
  itineraryController.createItinerary
);

// GET /api/itinerary - all itineraries
router.get('/', itineraryController.getAllItineraries);

// GET /api/itinerary/:id - by ID
router.get('/:id', itineraryController.getItineraryById);

// POST /api/itinerary/match - match by user preferences
router.post('/match', itineraryController.getMatchingItineraries);

module.exports = router;
