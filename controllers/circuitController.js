const Circuit = require('../models/Circuit');

// Utility: safely parse stringified arrays
const safeParse = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try {
    return JSON.parse(val);
  } catch {
    return String(val)
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);
  }
};

// ✅ Create a new circuit
const createCircuit = async (req, res) => {
  try {
    // Handle uploaded images
    const uploadedImages = (req.files || []).map(f =>
      `/uploads/${f.filename}`
    );

    if (!uploadedImages.length) {
      return res.status(400).json({ error: 'At least one image is required' });
    }

    const circuit = new Circuit({
      name: req.body.name?.trim(),
      category: req.body.category || null,
      categories: safeParse(req.body.categories).map(cat =>
        cat.trim().toLowerCase().replace(/\s+/g, '_')
      ),
      theme: req.body.theme || null,
      experiences: safeParse(req.body.experiences),
      featuredActivities: safeParse(req.body.featuredActivities),
      locations: safeParse(req.body.locations),
      duration: req.body.duration,
      bestSeasons: safeParse(req.body.bestSeasons),
      description: req.body.description,
      entryPoints: safeParse(req.body.entryPoints),
      transport: safeParse(req.body.transport),
      isOffbeat: req.body.isOffbeat === 'true' || req.body.isOffbeat === true,
      tags: safeParse(req.body.tags).map(tag =>
        tag.trim().toLowerCase().replace(/\s+/g, '_')
      ),

      carPriceHatchback: Number(req.body.carPriceHatchback) || 0,
      carPriceSedan: Number(req.body.carPriceSedan) || 0,
      carPriceSUV: Number(req.body.carPriceSUV) || 0,

      img: uploadedImages[0],     // cover image
      images: uploadedImages,     // all images
    });

    await circuit.save();
    res.status(201).json(circuit);
  } catch (err) {
    console.error('❌ Failed to create circuit:', err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Get all circuits
const getCircuits = async (req, res) => {
  try {
    const circuits = await Circuit.find().sort({ createdAt: -1 });
    res.status(200).json(circuits);
  } catch (err) {
    console.error('❌ Failed to fetch circuits:', err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Get matching circuits by tags/categories (ranked by overlap)
const getMatchingCircuits = async (req, res) => {
  try {
    const { categories } = req.body;

    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: 'Categories must be a non-empty array.' });
    }

    const normalizedCategories = categories.map(cat =>
      cat.trim().toLowerCase().replace(/\s+/g, '_')
    );

    const circuits = await Circuit.find({
      categories: { $in: normalizedCategories },
    }).sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: circuits });
  } catch (err) {
    console.error('❌ Failed to fetch matching circuits:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  createCircuit,
  getCircuits,
  getMatchingCircuits,
};
