const mongoose = require('mongoose');

const { Schema } = mongoose;

const itinerarySchema = new Schema(
  {
    title: { type: String, required: true, trim: true },

    circuitId: { type: Schema.Types.ObjectId, ref: 'Circuit', required: true, index: true },

    theme: { type: String, trim: true, default: '' },

    categoryTags: { type: [String], default: [] },
    experienceTags: { type: [String], default: [] },

    durationDays: { type: Number, min: 1, default: 1 },

    // Optional – you can keep single guestType here if you want
    guestType: {
      type: String,
      enum: ['Family', 'Solo', 'Couple', 'Group'],
      default: undefined,
    },

    paxMin: { type: Number, min: 0, default: 0 },
    paxMax: { type: Number, min: 0, default: 0 },

    budgetMin: { type: Number, min: 0, default: 0 },
    budgetMax: { type: Number, min: 0, default: 0 },

    transportIncluded: { type: Boolean, default: false },

    carType: {
      type: String,
      enum: ['Hatchback', 'Sedan', 'SUV'],
      default: 'Hatchback',
    },

    isFeatured: { type: Boolean, default: false, index: true },

    image: { type: String, default: '' },

    dayWisePlan: [
      {
        day: { type: Number, min: 1 },
        title: { type: String, default: '' },
        description: { type: String, default: '' },
        stayAtHomestayId: { type: Schema.Types.ObjectId, ref: 'Homestay' },
        activities: { type: [String], default: [] },
        travelDistanceKm: { type: Number, min: 0, default: 0 }, // ✅ important for car pricing
      },
    ],

    localGuide: {
      name: { type: String, default: '' },
      contact: { type: String, default: '' },
      location: { type: String, default: '' },
      bio: { type: String, default: '' },
      image: { type: String, default: '' },
    },
   // ✅ NEW: Suggested addons for extra days
    addonSuggestions: [
      {
        title: { type: String, required: true, trim: true },
        description: { type: String, default: '' },
        images: { type: [String], default: [] },
        activities: { type: [String], default: [] },
        travelDistanceKm: { type: Number, min: 0, default: 0 },
        stayAtHomestayId: { type: Schema.Types.ObjectId, ref: 'Homestay' },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ✅ Virtual: total km from the plan (handy for FE)
itinerarySchema.virtual('totalItineraryKm').get(function () {
  return (this.dayWisePlan || []).reduce(
    (sum, d) => sum + (Number(d?.travelDistanceKm) || 0),
    0
  );
});

// ✅ Normalize numbers on save (extra safety)
itinerarySchema.pre('save', function (next) {
  this.durationDays = Number(this.durationDays) || 0;
  this.paxMin = Number(this.paxMin) || 0;
  this.paxMax = Number(this.paxMax) || 0;
  this.budgetMin = Number(this.budgetMin) || 0;
  this.budgetMax = Number(this.budgetMax) || 0;

  if (Array.isArray(this.dayWisePlan)) {
    this.dayWisePlan = this.dayWisePlan.map((d) => ({
      ...d,
      day: d?.day != null ? Number(d.day) : d.day,
      travelDistanceKm: Number(d?.travelDistanceKm) || 0,
    }));
  }
  next();
});

// Helpful for queries
itinerarySchema.index({ 'dayWisePlan.stayAtHomestayId': 1 });
itinerarySchema.index({ 'addonSuggestions.stayAtHomestayId': 1 });

module.exports = mongoose.model('Itinerary', itinerarySchema);
