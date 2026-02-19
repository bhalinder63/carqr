// src/routes/cars.js
// Car owner registration and management endpoints

const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const { v4: uuidv4 } = require("uuid");

const firebaseService = require("../services/firebase");
const twilioService = require("../services/twilio");
const qrService = require("../services/qrcode");

// ─── VALIDATION RULES ────────────────────────────────────────────────

const registerValidation = [
  body("ownerName")
    .trim()
    .notEmpty()
    .withMessage("Owner name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be 2-50 characters"),

  body("ownerPhone")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required")
    .matches(/^\+?[1-9]\d{9,14}$/)
    .withMessage("Invalid phone number format"),

  body("vehicleNumber")
    .trim()
    .notEmpty()
    .withMessage("Vehicle number is required")
    .toUpperCase(),

  body("vehicleModel").trim().optional().isLength({ max: 50 }),

  body("address.street")
    .trim()
    .notEmpty()
    .withMessage("Street address is required")
    .isLength({ max: 200 }),

  body("address.city")
    .trim()
    .notEmpty()
    .withMessage("City is required")
    .isLength({ max: 100 }),

  body("address.state")
    .trim()
    .notEmpty()
    .withMessage("State is required")
    .isLength({ max: 100 }),

  body("address.pincode")
    .trim()
    .notEmpty()
    .withMessage("PIN code is required")
    .isLength({ min: 5, max: 10 })
    .withMessage("Invalid PIN code"),
];

// ─── ROUTES ──────────────────────────────────────────────────────────

/**
 * POST /api/cars/register
 * Register a new car and generate its QR code
 *
 * Body: { ownerName, ownerPhone, vehicleNumber, vehicleModel }
 * Returns: { carId, qrCodeDataUrl, contactUrl }
 */
router.post("/register", registerValidation, async (req, res) => {
  try {
    // 1. Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { ownerName, ownerPhone, vehicleNumber, vehicleModel, address } =
      req.body;

    // 2. Check if vehicle is already registered
    const existing = await firebaseService.getCarByVehicleNumber(vehicleNumber);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "This vehicle number is already registered.",
      });
    }

    // 3. Generate a unique Car ID
    // We use first 8 chars of UUID — short but unique enough
    const carId = uuidv4().split("-")[0].toUpperCase();

    // 4. Get the masked Twilio number for this car
    // In production: buy a dedicated number per owner for full masking
    // For MVP: use one shared Twilio number with call routing
    const maskedNumber = twilioService.getMaskedCallNumber(carId);

    // 5. Save car to Firebase
    await firebaseService.registerCar(carId, {
      ownerName,
      ownerPhone,
      vehicleNumber: vehicleNumber.toUpperCase(),
      vehicleModel: vehicleModel || "",
      maskedNumber,
      carId,
      address: {
        street: address.street,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
      },
      tagStatus: "pending",
    });

    // 6. Generate QR Code
    const qrResult = await qrService.generateCarQRCode(carId, vehicleNumber);

    // 7. Send welcome SMS to owner
    try {
      await twilioService.sendWelcomeSMS(ownerPhone, {
        vehicleNumber,
        id: carId,
      });
    } catch (smsErr) {
      console.warn("Welcome SMS failed (non-critical):", smsErr.message);
    }

    // 8. Return success response (QR code is NOT sent to the owner)
    res.status(201).json({
      success: true,
      message:
        "Vehicle registered successfully! Your QR tag will be mailed to your address.",
      data: {
        carId,
        vehicleNumber,
        maskedNumber,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Registration failed. Please try again.",
      });
  }
});

/**
 * GET /api/cars/:carId
 * Get car public info (used by the contact landing page)
 * NOTE: Only returns safe/public fields — never the owner's real phone
 */
router.get("/:carId", async (req, res) => {
  try {
    const car = await firebaseService.getCarById(req.params.carId);

    if (!car || !car.isActive) {
      return res
        .status(404)
        .json({ success: false, message: "Car not found or inactive." });
    }

    // Return only PUBLIC safe fields
    res.json({
      success: true,
      data: {
        carId: car.id,
        vehicleNumber: car.vehicleNumber,
        vehicleModel: car.vehicleModel,
        ownerName: car.ownerName, // First name only is fine
        maskedNumber: car.maskedNumber, // Virtual Twilio number — safe to show
      },
    });
  } catch (error) {
    console.error("Get car error:", error);
    res.status(500).json({ success: false, message: "Something went wrong." });
  }
});

/**
 * GET /api/cars/:carId/qr
 * Re-download QR code for a registered car
 */
router.get("/:carId/qr", async (req, res) => {
  try {
    const car = await firebaseService.getCarById(req.params.carId);
    if (!car)
      return res
        .status(404)
        .json({ success: false, message: "Car not found." });

    const qrResult = await qrService.generateCarQRCode(
      car.id,
      car.vehicleNumber,
    );

    res.json({
      success: true,
      data: {
        qrCodeDataUrl: qrResult.dataUrl,
        contactUrl: qrResult.contactUrl,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "QR generation failed." });
  }
});

/**
 * GET /api/cars/:carId/history
 * Get scan history for a car (owner only — add auth middleware in production)
 */
router.get("/:carId/history", async (req, res) => {
  try {
    const history = await firebaseService.getScanHistory(req.params.carId);
    res.json({ success: true, data: history });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch history." });
  }
});

module.exports = router;
