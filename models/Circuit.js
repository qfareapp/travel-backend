const mongoose = require('mongoose');

const circuitSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },

  category: { type: String, default: null, trim: true },     // single label
  categories: [{ type: String, trim: true }],                // multiple labels
  theme: { type: String, default: null, trim: true },

  experiences: [{ type: String, trim: true }],
  featuredActivities: [{ type: String, trim: true }],
  locations: [{ type: String, trim: true }],
  bestSeasons: [{ type: String, trim: true }],
  entryPoints: [{ type: String, trim: true }],
  transport: [{ type: String, trim: true }],
  tags: [{ type: String, trim: true }],

  description: { type: String, required: true },
  duration: { type: String, required: true, trim: true },
  isOffbeat: { type: Boolean, default: false },

  // Pricing
  carPriceHatchback: { type: Number, min: 0 },
  carPriceSedan: { type: Number, min: 0 },
  carPriceSUV: { type: Number, min: 0 },

  // Images
  img: { type: String, trim: true },               // cover image
  images: [{ type: String, trim: true }],          // multiple images

  // Relations
  homestays: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Homestay' }],
}, { timestamps: true });

// Virtual alias
circuitSchema.virtual('image').get(function () {
  return this.img;
});

circuitSchema.set('toJSON', { virtuals: true });
circuitSchema.set('toObject', { virtuals: true });

circuitSchema.index({ name: 1 });

module.exports = mongoose.model('Circuit', circuitSchema);
