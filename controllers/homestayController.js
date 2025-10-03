// controllers/homestayController.js
const mongoose = require('mongoose');
const Homestay = require('../models/Homestay');
const Circuit  = require('../models/Circuit');

/* ============================== helpers ============================== */
const num = (v, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};
const bool = (v) => v === true || v === 'true';
const parseArray = (v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch { return v ? [v] : []; }
  }
  if (v && typeof v === 'object') return [v];
  return [];
};
const parseObject = (v) => {
  if (!v) return {};
  if (typeof v === 'object' && !Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch { return {}; }
  }
  return {};
};
// Collect bracket-style fields like experienceDistances[Safari]=5
const collectExperienceDistancesFromBrackets = (body = {}) => {
  const out = {};
  for (const [k, v] of Object.entries(body)) {
    const m = k.match(/^experienceDistances\[(.+?)\]$/);
    if (m && m[1]) out[m[1]] = num(v, 0);
  }
  return out;
};

 // Compute min per-person rate using roomTypes, fallback to top-level price     
const computeMinPerPerson = (hs) => {                                           
const fromRooms = Array.isArray(hs?.roomTypes)                                 
? hs.roomTypes                                                               
.map(rt => num(rt?.pricePerPerson, 0))                                   
.filter(Boolean)                                                         
: [];                                                                        
const minRoom = fromRooms.length ? Math.min(...fromRooms) : 0;                 
const fallback = num(hs?.price, 0);                                            
return minRoom || fallback || 0;                                               
};                                  

/**
 * POST /api/homestays
 * Supports: upload.array('images') OR upload.fields([{ name: 'images' }])
 */
exports.createHomestay = async (req, res) => {
  try {
    // Gather uploaded images in "/uploads/<filename>" format
    let images = [];
    if (Array.isArray(req.files)) {
      images = req.files.map((f) => `/uploads/${f.filename}`);
    } else if (req.files?.images) {
      images = req.files.images.map((f) => `/uploads/${f.filename}`);
    }

    const {
      circuitId,
      homestayName,
      placeName,
      description,
      contact,
      isFeatured,
      pricingType,  // must be "perhead"
      price,        // per head per night (> 0)
      distance,
      rooms,        // optional, overridden by roomConfigs sum when present

      // array/object-ish (can arrive as JSON strings or arrays)
      guestTypes,
      guestType,           // legacy single
      addons,
      experiences,
      locationTypes,
      roomConfigs,         // [{ label, capacity, count }]
      experienceDistances, // { expName: km, ... }
      ...rest              // picks up bracketed keys like experienceDistances[Safari]
    } = req.body;

    // Validate circuitId exists
    if (!circuitId) return res.status(400).json({ message: 'circuitId is required' });
    const circuitExists = await Circuit.exists({ _id: circuitId });
    if (!circuitExists) return res.status(400).json({ message: 'Invalid circuitId' });

    // Trim strings and ensure presence
    const nameTrim = (homestayName || '').trim();
    const placeTrim = (placeName || '').trim();
    if (!nameTrim)  return res.status(400).json({ message: 'homestayName is required' });
    if (!placeTrim) return res.status(400).json({ message: 'placeName is required' });

    // Pricing constraints
    const normalizedPricing = String(pricingType || 'perhead').toLowerCase();
    if (normalizedPricing !== 'perhead') {
      return res.status(400).json({ message: 'pricingType must be perhead (per-head with food)' });
    }
    const perHeadPrice = num(price, NaN);
    if (!(perHeadPrice > 0)) {
      return res.status(400).json({ message: 'price (per head per night) must be > 0' });
    }

    // Parse multi fields
    const parsedGuestTypes = parseArray(guestTypes).length
      ? parseArray(guestTypes)
      : (guestType ? [guestType] : []);
    const parsedAddons        = parseArray(addons);
    const parsedExperiences   = parseArray(experiences);
    const parsedLocationTypes = parseArray(locationTypes);

    // roomConfigs: coerce numbers, ignore empties
    const parsedRoomConfigs = parseArray(roomConfigs)
      .map((rc) => ({
        label: (rc?.label || '').trim(),
        capacity: num(rc?.capacity, 0),
        count: num(rc?.count, 0),
      }))
      .filter((rc) => rc.label || rc.capacity > 0 || rc.count > 0);

    // experienceDistances: merge JSON object + bracketed keys, coerce numbers
    const objDistances = Object.fromEntries(
      Object.entries(parseObject(experienceDistances)).map(([k, v]) => [k, num(v, 0)])
    );
    const bracketDistances = collectExperienceDistancesFromBrackets(rest);
    const parsedExperienceDistances = { ...objDistances, ...bracketDistances };

    // Final rooms: sum of roomConfigs counts (if > 0), else provided value
    const roomsFromConfigs = parsedRoomConfigs.reduce((s, r) => s + num(r.count, 0), 0);
    const finalRooms = Math.max(0, roomsFromConfigs > 0 ? roomsFromConfigs : num(rooms, 0));

    // Create doc
    const doc = await Homestay.create({
      circuitId,
      homestayName: nameTrim,
      placeName: placeTrim,
      description: (description || '').trim(),
      contact: (contact || '').trim(),
      isFeatured: bool(isFeatured),

      pricingType: 'perhead',
      price: perHeadPrice,

      distance: num(distance, 0),
      rooms: finalRooms,

      guestTypes: parsedGuestTypes,
      addons: parsedAddons,
      experiences: parsedExperiences,
      locationTypes: parsedLocationTypes,
      roomConfigs: parsedRoomConfigs,
      experienceDistances: parsedExperienceDistances,
      images,
    });

    // Ensure the place is listed under the circuit (deduped)
    await Circuit.findByIdAndUpdate(
      circuitId,
      { $addToSet: { locations: placeTrim } },
      { new: true }
    );

    return res.status(201).json(doc);
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ message: 'Homestay already exists for this circuit and place' });
    }
    console.error('❌ Error creating homestay:', err);
    return res.status(500).json({ error: err.message || 'Internal error creating homestay' });
  }
};

/**
 * GET /api/homestays
 */
exports.getHomestays = async (req, res) => {
  try {
    const homestays = await Homestay.find({})
      .populate('circuitId')
      .sort({ isFeatured: -1, createdAt: -1 })
      .lean();

    return res.status(200).json(homestays);
  } catch (err) {
    console.error('❌ Error fetching homestays:', err);
    return res.status(500).json({ error: err.message || 'Internal error fetching homestays' });
  }
};

/**
 * GET /api/homestays/:id/detail
 * Rich payload for the details page.
 */
exports.getHomestayDetail = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid homestay id' });
    }

    const homestay = await Homestay.findById(id).populate('circuitId');
    if (!homestay) return res.status(404).json({ message: 'Homestay not found' });

    // If you later add room-level pricing, compute the min here.
    const minPerPerson = Number(homestay.price || 0);

    return res.status(200).json({
      homestay,
      reviews: homestay.reviews || [],                                              // [UPDATED]
      minPerPerson,
      reviews: [],         // plug in real reviews later
      minPerPerson,
    });
  } catch (err) {
    console.error('❌ Error fetching homestay detail:', err);
    return res.status(500).json({ error: err.message || 'Internal error fetching detail' });
  }
};

/**
 * (Optional) GET /api/homestays/:id
 * Simple fetch by id (handy for admin/edit screens).
 */
exports.getHomestayById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid homestay id' });
    }

    const doc = await Homestay.findById(id).populate('circuitId');
    if (!doc) return res.status(404).json({ message: 'Homestay not found' });

    return res.status(200).json(doc);
  } catch (err) {
    console.error('❌ Error fetching homestay by id:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
};
/**
* POST /api/homestays/:id/reviews
* Add a review, update aggregates, and return new aggregates.
*/
exports.addHomestayReview = async (req, res) => {                                  // [ADDED]
try {                                                                             // [ADDED]
    const { id } = req.params;                                                      // [ADDED]
    if (!mongoose.isValidObjectId(id)) {                                            // [ADDED]
      return res.status(400).json({ message: 'Invalid homestay id' });              // [ADDED]
     }                                                                               // [ADDED]
    const { userName = '', rating, comment = '' } = req.body;                       // [ADDED]
    const r = Number(rating);                                                       // [ADDED]
    if (!Number.isFinite(r) || r < 1 || r > 5) {                                    // [ADDED]
    return res.status(400).json({ message: 'rating must be between 1 and 5' });   // [ADDED]
     }                                                                               // [ADDED]

    const hs = await Homestay.findById(id);                                         // [ADDED]
     if (!hs) return res.status(404).json({ message: 'Homestay not found' });        // [ADDED]

    if (!Array.isArray(hs.reviews)) hs.reviews = [];                                // [ADDED]
    hs.reviews.push({ userName, rating: r, comment });                               // [ADDED]

    // Recompute aggregates                                                         // [ADDED]
    const total = hs.reviews.reduce((s, rr) => s + num(rr?.rating, 0), 0);          // [ADDED]
    hs.ratingCount = hs.reviews.length;                                             // [ADDED]
    hs.averageRating = hs.ratingCount ? total / hs.ratingCount : 0;                 // [ADDED]
     await hs.save();                                                                 // [ADDED]
    return res.status(200).json({                                                   // [ADDED]
    message: 'Review added',                                                      // [ADDED]
     averageRating: hs.averageRating,                                              // [ADDED]
     ratingCount: hs.ratingCount,                                                  // [ADDED]
     });                                                                             // [ADDED]
   } catch (err) {                                                                    // [ADDED]
    console.error('❌ Error adding review:', err);                                   // [ADDED]
    return res.status(500).json({ error: err.message || 'Internal error adding review' }); // [ADDED]
   }                                                                                 // [ADDED]
 }; 