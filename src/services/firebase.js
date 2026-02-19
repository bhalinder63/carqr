// src/services/firebase.js
// Handles all Firebase Firestore database operations

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK (only once)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

const db = admin.firestore();

// ─── COLLECTIONS ────────────────────────────────────────────────────
// cars        → stores car + owner info
// scan_logs   → logs every QR scan with timestamp + caller info

const COLLECTIONS = {
  CARS: 'cars',
  SCAN_LOGS: 'scan_logs',
};

// ─── CAR OPERATIONS ─────────────────────────────────────────────────

/**
 * Register a new car
 * @param {string} carId - Unique car ID (e.g. "ABC123")
 * @param {object} data - Car and owner details
 */
async function registerCar(carId, data) {
  const carRef = db.collection(COLLECTIONS.CARS).doc(carId);
  await carRef.set({
    ...data,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    isActive: true,
    scanCount: 0,
  });
  return carId;
}

/**
 * Get car details by car ID
 * @param {string} carId
 */
async function getCarById(carId) {
  const doc = await db.collection(COLLECTIONS.CARS).doc(carId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

/**
 * Get car by vehicle registration number
 * @param {string} vehicleNumber - e.g. "DL01AB1234"
 */
async function getCarByVehicleNumber(vehicleNumber) {
  const snapshot = await db
    .collection(COLLECTIONS.CARS)
    .where('vehicleNumber', '==', vehicleNumber.toUpperCase())
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}

/**
 * Update car details
 */
async function updateCar(carId, data) {
  await db.collection(COLLECTIONS.CARS).doc(carId).update({
    ...data,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Increment scan count when QR is scanned
 */
async function incrementScanCount(carId) {
  await db.collection(COLLECTIONS.CARS).doc(carId).update({
    scanCount: admin.firestore.FieldValue.increment(1),
    lastScannedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// ─── SCAN LOG OPERATIONS ─────────────────────────────────────────────

/**
 * Log a QR scan event
 */
async function logScan(carId, scanData) {
  await db.collection(COLLECTIONS.SCAN_LOGS).add({
    carId,
    ...scanData,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Get scan history for a car
 */
async function getScanHistory(carId, limit = 20) {
  const snapshot = await db
    .collection(COLLECTIONS.SCAN_LOGS)
    .where('carId', '==', carId)
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

module.exports = {
  db,
  registerCar,
  getCarById,
  getCarByVehicleNumber,
  updateCar,
  incrementScanCount,
  logScan,
  getScanHistory,
};
