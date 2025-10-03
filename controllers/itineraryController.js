// controllers/itineraryController.js
const Itinerary = require('../models/Itinerary');
const Homestay = require('../models/Homestay'); // kept for population, if needed

// ----------------- helpers -----------------
const safeParse = (input, fallback = []) => {
  if (input == null) return fallback;
  if (typeof input === 'string') {
    try { return JSON.parse(input); } catch { return fallback; }
  }
  if (Array.isArray(input)) return input;
  return fallback;
};

const safeNumber = (val, fallback = 0) => {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
};

const safeBool = (v) => v === true || v === 'true';

/**
 * Pick uploaded file path (public URL) from either:
 * - upload.array('field') => req.files is an array
 * - upload.fields([{name:'field'}]) => req.files.field is an array
 * Falls back to .path if disk filename not present.
 */
const pickFilePath = (files, field) => {
  if (!files) return '';
  if (files[field]?.[0]) {
    const f = files[field][0];
    return f.filename ? `/uploads/${f.filename}` : (f.path || '');
  }
  if (Array.isArray(files) && files[0]) {
    const f = files[0];
    return f.filename ? `/uploads/${f.filename}` : (f.path || '');
  }
  return '';
};

const normalizePlan = (plan) =>
  safeParse(plan).map(d => ({
    ...d,
    day: safeNumber(d?.day, undefined),
    travelDistanceKm: safeNumber(d?.travelDistanceKm, 0),
  }));
// -------------------------------------------


// ✅ CREATE ITINERARY
exports.createItinerary = async (req, res) => {
  try {
    const {
      title, circuitId, theme, categoryTags, experienceTags, durationDays,
      guestType, paxMin, paxMax, budgetMin, budgetMax, transportIncluded,
      carType, isFeatured, dayWisePlan, noOfRooms,
      localGuideName, localGuideContact, localGuideLocation, localGuideBio
    } = req.body;

    const parsedPlan = normalizePlan(dayWisePlan);

    const image = pickFilePath(req.files, 'image');
    const localGuideImage = pickFilePath(req.files, 'localGuideImage');

    const itinerary = new Itinerary({
      title,
      circuitId,
      theme,
      categoryTags: safeParse(categoryTags),
      experienceTags: safeParse(experienceTags),
      durationDays: safeNumber(durationDays),
      guestType,
      paxMin: safeNumber(paxMin),
      paxMax: safeNumber(paxMax),
      budgetMin: safeNumber(budgetMin),
      budgetMax: safeNumber(budgetMax),
      transportIncluded: safeBool(transportIncluded),
      carType,
      isFeatured: safeBool(isFeatured),
      noOfRooms: safeNumber(noOfRooms),
      dayWisePlan: parsedPlan,
      localGuide: {
        name: localGuideName,
        contact: localGuideContact,
        location: localGuideLocation,
        bio: localGuideBio,
        image: localGuideImage
      },
      image
    });

    const saved = await itinerary.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error('❌ Itinerary creation failed:', err);
    res.status(500).json({ message: 'Error creating itinerary', error: err.message });
  }
};


// ✅ GET ALL ITINERARIES
exports.getAllItineraries = async (req, res) => {
  try {
    const itineraries = await Itinerary.find()
      .populate('circuitId')
      .populate('dayWisePlan.stayAtHomestayId');

    res.json(itineraries);
  } catch (err) {
    console.error('❌ Failed to fetch itineraries:', err);
    res.status(500).json({ message: 'Error fetching itineraries', error: err.message });
  }
};


// ✅ GET BY ID
exports.getItineraryById = async (req, res) => {
  try {
    const itinerary = await Itinerary.findById(req.params.id)
      .populate('circuitId')
      .populate('dayWisePlan.stayAtHomestayId');

    if (!itinerary) {
      return res.status(404).json({ message: 'Itinerary not found' });
    }

    res.json(itinerary);
  } catch (err) {
    console.error('❌ Failed to fetch itinerary:', err);
    res.status(500).json({ message: 'Error fetching itinerary', error: err.message });
  }
};


// ✅ MATCHING ITINERARIES BASED ON PREFERENCES
// Circuit must match 100% (by id or name if provided)
exports.getMatchingItineraries = async (req, res) => {
  try {
    // Hard circuit filter
    const circuitIdFilter = String(req.body.circuitId || '').trim();
    const circuitNameFilter = String(req.body.circuitName || '').trim().toLowerCase();

    // Other filters (unchanged)
    const tags = safeParse(req.body.tags);
    const experiences = safeParse(req.body.experiences);
    const theme = String(req.body.theme || '').trim();
    const withCar = safeBool(req.body.withCar);

    const days = safeNumber(req.body.days, null);
    const budget = safeNumber(req.body.budget, null);
    const pax = safeNumber(req.body.pax, null);
    const noOfRooms = safeNumber(req.body.noOfRooms, null);

    const allItineraries = await Itinerary.find()
      .populate('circuitId')
      .populate('dayWisePlan.stayAtHomestayId');

    const matched = allItineraries.filter((itin) => {
      const circuitDoc = itin.circuitId || {};

      // ✅ Require exact circuit match if provided
      if (circuitIdFilter) {
        const itinCircuitId = String(circuitDoc?._id || itin.circuitId || '');
        if (itinCircuitId !== circuitIdFilter) return false;
      }
      if (circuitNameFilter) {
        const itinCircuitName = String(circuitDoc?.name || '').toLowerCase();
        if (itinCircuitName !== circuitNameFilter) return false;
      }

      const circuitTags = [...(circuitDoc.tags || []), ...(circuitDoc.categories || [])];
      const circuitExperiences = circuitDoc.experiences || [];
      const itinExps = Array.isArray(itin.experienceTags) ? itin.experienceTags : [];

      const tagMatch =
        tags.length === 0 || circuitTags.some(t => tags.includes(t));

      const experienceMatch =
        experiences.length === 0 ||
        itinExps.some(e => experiences.includes(e)) ||
        circuitExperiences.some(e => experiences.includes(e));

      const themeMatch =
        !theme || (itin.theme || '').toLowerCase().includes(theme.toLowerCase());

      const budgetMatch =
        budget == null || (typeof itin.budgetMax === 'number' && itin.budgetMax <= budget + 30000);

      const daysMatch =
        days == null || (typeof itin.durationDays === 'number' && Math.abs(itin.durationDays - days) <= 2);

      const carMatch = !withCar || itin.transportIncluded === true;

      let score = 0;
      if (tagMatch) score++;
      if (experienceMatch) score++;
      if (themeMatch) score++;
      if (budgetMatch) score++;
      if (daysMatch) score++;
      if (carMatch) score++;

      return score >= 3;
    });

    // Enrich + convenience total km for FE
    const enriched = matched.map((itin) => {
      const plan = Array.isArray(itin.dayWisePlan) ? itin.dayWisePlan : [];
      const totalItineraryKm = plan.reduce((s, d) => s + safeNumber(d?.travelDistanceKm, 0), 0);

      return {
        ...itin.toObject(),
        pax,
        days,
        noOfRooms,
        totalItineraryKm,
      };
    });

    res.json({ success: true, matchedItineraries: enriched });
  } catch (err) {
    console.error('❌ Error matching itineraries:', err);
    res.status(500).json({ success: false, error: 'Server error while matching itineraries' });
  }
};
