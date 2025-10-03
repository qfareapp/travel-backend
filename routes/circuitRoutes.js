// routes/circuitRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const mongoose = require('mongoose');

const Circuit = require('../models/Circuit');
const Homestay = require('../models/Homestay');
const Itinerary = require('../models/Itinerary');

// ✅ Controller imports
const circuitController = require('../controllers/circuitController');
const {
  createCircuit,
  getCircuits,
  getMatchingCircuits,
} = circuitController;

// -------------------
// 🖼 Multer setup
// -------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // ⚠️ Ensure uploads/ folder exists
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'));
  },
});

const upload = multer({ storage });

// -------------------
// 📌 Main Routes
// -------------------

// Create circuit (support multiple images)
router.post('/', upload.array('images', 10), createCircuit);

// Get all circuits
router.get('/', getCircuits);

// Match circuits by tags
router.post('/match', getMatchingCircuits);

// -------------------
// 📌 Utility Routes
// -------------------

// Get distinct categories
router.get('/categories', async (req, res) => {
  try {
    const [single, multiple] = await Promise.all([
      Circuit.distinct('category'),
      Circuit.distinct('categories'),
    ]);

    const uniq = Array.from(
      new Set([...(single || []), ...(multiple || [])]
        .filter(Boolean)
        .map(String))
    );

    const formatted = uniq.map((cat) => ({
      label: cat,
      value: cat.toLowerCase().replace(/\s+/g, '_'),
    }));

    res.status(200).json(formatted);
  } catch (err) {
    console.error('❌ Failed to fetch categories:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get distinct experiences
router.get('/experiences', async (req, res) => {
  try {
    const experiences = await Circuit.distinct('experiences');
    const formatted = (experiences || [])
      .filter(Boolean)
      .map((exp) => ({
        label: String(exp),
        value: String(exp).toLowerCase().replace(/\s+/g, '_'),
        icon: '🎯',
      }));
    res.status(200).json(formatted);
  } catch (err) {
    console.error('❌ Failed to fetch experiences:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get travel themes
router.get('/themes', async (req, res) => {
  try {
    const themes = [
      {
        label: 'Offbeat',
        value: 'offbeat',
        description: 'Hidden gems, quiet villages & local life.',
      },
      {
        label: 'Popular Destinations',
        value: 'popular',
        description: 'Popular towns, sightseeing, cafes & markets.',
      },
      {
        label: 'Mixed',
        value: 'mixed',
        description: 'A blend of offbeat and mainstream spots.',
      },
    ];
    res.status(200).json(themes);
  } catch (err) {
    console.error('❌ Failed to fetch themes:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// -------------------
// 📌 Deep Payload Route
// -------------------
// Must be placed LAST to avoid clashing with /categories, /experiences, etc.
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 1️⃣ Find circuit by ObjectId OR slug
    const isOid = mongoose.Types.ObjectId.isValid(id);
    const circuit = isOid
      ? await Circuit.findById(id).lean()
      : await Circuit.findOne({ slug: id }).lean();

    if (!circuit) {
      return res.status(404).json({ message: 'Circuit not found' });
    }

    const cid = circuit._id;
    const oid = new mongoose.Types.ObjectId(cid);

    // 2️⃣ Flexible query for child documents
    const byCircuit = {
      $or: [
        { circuit: oid },
        { circuit: String(cid) },
        { circuitId: oid },
        { circuitId: String(cid) },
      ],
    };

    // 3️⃣ Fetch related data
    const [homestays, itineraries] = await Promise.all([
      Homestay.find(byCircuit)
        .select(
          'homestayName name placeName description price pricingType images distance guestType guestTypes experiences rooms averageRating ratingCount isFeatured'
        )
        .lean({ virtuals: true }),
      Itinerary.find(byCircuit)
        .select(
          'title durationDays guestType budgetMin budgetMax transportIncluded carType dayWisePlan image localGuide'
        )
        .lean(),
    ]);

    // 4️⃣ Deduplicate local guides
    const rawGuides = (itineraries || [])
      .map((i) => i?.localGuide)
      .filter(Boolean);

    const guideMap = new Map();
    for (const g of rawGuides) {
      guideMap.set(
        `${g?.name || ''}|${g?.location || ''}|${g?.image || ''}`,
        g
      );
    }
    const localGuides = [...guideMap.values()];

    // 5️⃣ Return payload
    res.json({
      ...circuit,
      homestays,
      itineraries,
      localGuides,
    });
  } catch (error) {
    console.error('❌ Error fetching circuit details:', error);
    res
      .status(500)
      .json({ message: 'Error fetching circuit details', error: error.message });
  }
});

module.exports = router;
