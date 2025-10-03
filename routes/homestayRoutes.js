// routes/homestays.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { createHomestay, getHomestays, getHomestayById, getHomestayDetail, addHomestayReview } = require('../controllers/homestayController');

const router = express.Router();

// Ensure uploads folder exists
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Multer storage config: keep original ext, unique name
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    const base = path.basename(file.originalname || 'image', ext).replace(/\s+/g, '_');
    cb(null, `${base}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif'].includes(file.mimetype);
  if (!ok) return cb(new Error('Only image files are allowed (jpeg, jpg, png, webp, gif).'));
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 8 * 1024 * 1024,   // 8MB per file
    files: 20,                   // up to 20 images
  },
});

// Use fields so req.files.images exists (your controller already handles both styles)
const uploadImages = upload.fields([{ name: 'images', maxCount: 20 }]);

// Multer error wrapper to return 400 instead of crashing
const multerSafe = (mw) => (req, res, next) =>
  mw(req, res, (err) => {
    if (err instanceof multer.MulterError || err?.message?.startsWith('Only image files')) {
      return res.status(400).json({ message: 'Upload error', error: err.message });
    }
    return next(err);
  });

router.post('/', multerSafe(uploadImages), createHomestay);
router.get('/', getHomestays);
router.get('/:id', getHomestayById);
router.get('/:id/detail', getHomestayDetail);
router.post('/:id/reviews', addHomestayReview);

module.exports = router;
