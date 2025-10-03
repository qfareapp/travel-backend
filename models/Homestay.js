// models/Homestay.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

/* ---------------- Room config (embedded) ---------------- */
const RoomConfigSchema = new Schema(
  {
    label:    { type: String, default: '', trim: true },
    capacity: { type: Number, default: 0, min: 0 },
    count:    { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

/* ---------------- Room type (with pricing & images) ---------------- */
const RoomTypeSchema = new Schema(                                     // [ADDED]
  {                                                                     // [ADDED]
    name:           { type: String, trim: true },                       // [ADDED]
    capacity:       { type: Number, default: 0, min: 0 },               // [ADDED]
    bedType:        { type: String, trim: true },                       // [ADDED]
    amenities:      { type: [String], default: [] },                    // [ADDED]
    images:         { type: [String], default: [] },                    // [ADDED]
    pricePerPerson: { type: Number, min: 0 },                           // [ADDED]
    pricePerRoom:   { type: Number, min: 0 },                           // [ADDED]
    count:          { type: Number, default: 0, min: 0 },               // [ADDED]
  },                                                                    // [ADDED]
  { _id: false }                                                        // [ADDED]
);                                                                      // [ADDED]

/* ---------------- Review (embedded) ---------------- */
const ReviewSchema = new Schema(                                        // [ADDED]
  {
    userName:  { type: String, trim: true, default: '' },               // [ADDED]
    rating:    { type: Number, required: true, min: 1, max: 5 },        // [ADDED]
    comment:   { type: String, trim: true, default: '' },               // [ADDED]
    createdAt: { type: Date, default: Date.now },                       // [ADDED]
  },                                                                    // [ADDED]
  { _id: true }                                                         // [ADDED]
);

/* ---------------- Homestay ---------------- */
const homestaySchema = new Schema(
  {
    circuitId:   { type: Schema.Types.ObjectId, ref: 'Circuit', required: true, index: true },

    homestayName:{ type: String, required: true, trim: true },
    placeName:   {                                                    // [UPDATED]
      type: String, trim: true,
      default: function () { return this.homestayName || undefined; },// [ADDED] derive for old docs
      required: function () {                                         // [ADDED] only hard-require if neither name exists on create
        return this.isNew && !this.homestayName;
      }
    },

    distance:    { type: Number, default: 0, min: 0 },
    images:      { type: [String], default: [] },
    description: { type: String, default: '', trim: true },

    // Pricing mode
    pricingType: {                                                    // [UPDATED]
      type: String,
      enum: ['perhead', 'perroom'],                                   // [UPDATED] support both
      default: 'perhead',
    },

    // Base price (used when pricingType = 'perhead'; optional if roomTypes carry pricing)
    price:       {                                                    // [UPDATED]
      type: Number, min: 1,
      required: function () {
        // Require a base price only if there's no usable room-type price
        const hasRoomTypePrice =
          Array.isArray(this.roomTypes) &&
          this.roomTypes.some(rt => Number(rt?.pricePerPerson) > 0 || Number(rt?.pricePerRoom) > 0);
        return !hasRoomTypePrice;
      }
    },

    contact:     { type: String, default: '', trim: true },

    // Total rooms (auto-calculated from roomConfigs/roomTypes)
    rooms:       { type: Number, default: 0, min: 0 },

    // Legacy simple room configs
    roomConfigs: { type: [RoomConfigSchema], default: [] },

    // Rich room types for UI (pricing & images)
    roomTypes:   { type: [RoomTypeSchema], default: [] },              // [ADDED]

    // Guests
    guestTypes:  { type: [String], enum: ['Family', 'Solo', 'Couple', 'Group'], default: [] },
    guestType:   { type: String, enum: ['Family', 'Solo', 'Couple', 'Group'] },

    addons:      { type: [String], default: [] },
    isFeatured:  { type: Boolean, default: false },

    experiences: { type: [String], default: [] },
    experienceDistances: {
      type: Map,
      of: Number,
      default: {},
    },

    locationTypes: { type: [String], enum: ['Offbeat', 'City'], default: [] },

    // Aggregated ratings
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount:   { type: Number, default: 0, min: 0 },

    // Embedded reviews
    reviews: { type: [ReviewSchema], default: [] },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* ------------- Useful indexes (avoid duplicates) ------------- */
homestaySchema.index(
  { circuitId: 1, homestayName: 1, placeName: 1 },
  { unique: true, name: 'uniq_circuit_homestay_place' }
);

/* ------------- Virtuals for UI convenience ------------- */
// Alias `placeName` to `location` so the frontend can use stay.location
homestaySchema.virtual('location').get(function () {
  return this.placeName;
});

// Provide a `circuit` virtual for code paths that still read `circuit`
homestaySchema.virtual('circuit').get(function () {                  // [ADDED]
  return this.circuitId;
});

// Compute a minimum per-person price (from roomTypes first, fallback to base price)
homestaySchema.virtual('minPricePerPerson').get(function () {       // [UPDATED]
  const candidates = Array.isArray(this.roomTypes)
    ? this.roomTypes
        .map(rt => Number(rt?.pricePerPerson || rt?.pricePerRoom || 0))
        .filter(n => Number.isFinite(n) && n > 0)
    : [];
  const fromRooms = candidates.length ? Math.min(...candidates) : 0;
  const fallback  = Number(this.price || 0);
  return fromRooms || fallback || 0;
});

// Prefer a single vibe value if you want to show a chip
homestaySchema.virtual('vibe').get(function () {
  return Array.isArray(this.locationTypes) && this.locationTypes.length ? this.locationTypes[0] : null;
});

/* ------------- Normalize + derive before validate/save ------------- */
homestaySchema.pre('validate', function (next) {
  // Normalize pricingType to lowercase and to the supported enum
  if (this.pricingType) {                                           // [ADDED]
    const v = String(this.pricingType).toLowerCase();
    this.pricingType = (v === 'perroom' || v === 'perhead') ? v : 'perhead';
  }

  // Derive rooms from roomConfigs or roomTypes
  if (Array.isArray(this.roomConfigs) && this.roomConfigs.length > 0) {
    this.rooms = this.roomConfigs.reduce((sum, rc) => sum + (Number(rc?.count) || 0), 0);
  } else if (Array.isArray(this.roomTypes) && this.roomTypes.length > 0) {
    this.rooms = this.roomTypes.reduce((sum, rt) => sum + (Number(rt?.count) || 0), 0); // [ADDED]
  } else {
    this.rooms = Number.isFinite(this.rooms) ? Number(this.rooms) : 0;
  }

  // Sanitize numeric fields
  this.distance = Number.isFinite(this.distance) ? Number(this.distance) : 0;

  // If base price is present, ensure it’s numeric (let `required` handle absence)
  if (this.price != null && !Number.isFinite(Number(this.price))) { // [ADDED]
    this.invalidate('price', 'Price must be a number');
  }

  next();
});

module.exports = mongoose.model('Homestay', homestaySchema);
