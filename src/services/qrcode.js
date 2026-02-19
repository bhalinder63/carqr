// src/services/qrcode.js
// Generates QR codes for car tags

const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs').promises;

const OUTPUT_DIR = path.join(__dirname, '../../public/qrcodes');

// Ensure output directory exists
async function ensureDir() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

/**
 * Generate a QR code for a car
 * The QR code encodes the contact URL, NOT the phone number
 *
 * @param {string} carId - Unique car ID
 * @param {string} vehicleNumber - For filename
 * @returns {object} - { dataUrl, filePath, contactUrl }
 */
async function generateCarQRCode(carId, vehicleNumber) {
  await ensureDir();

  // This is what gets encoded in the QR — a URL, never a phone number
  const contactUrl = `${process.env.APP_URL}/contact/${carId}`;

  const qrOptions = {
    errorCorrectionLevel: 'H',   // High error correction (works even if sticker is slightly damaged)
    type: 'image/png',
    quality: 0.95,
    margin: 2,
    color: {
      dark: '#1a1a2e',            // Dark navy QR dots
      light: '#ffffff',           // White background
    },
    width: 400,                   // 400px — good resolution for printing
  };

  // Generate as base64 data URL (for sending to frontend)
  const dataUrl = await QRCode.toDataURL(contactUrl, qrOptions);

  // Also save as file
  const fileName = `${vehicleNumber.replace(/\s/g, '_')}_${carId}.png`;
  const filePath = path.join(OUTPUT_DIR, fileName);
  await QRCode.toFile(filePath, contactUrl, qrOptions);

  return {
    dataUrl,        // base64 PNG — use in <img src="..."> directly
    filePath,       // Server file path
    fileName,
    contactUrl,     // The URL encoded in QR
  };
}

/**
 * Generate QR as SVG string (for embedding in HTML print page)
 */
async function generateCarQRCodeSVG(carId) {
  const contactUrl = `${process.env.APP_URL}/contact/${carId}`;
  const svg = await QRCode.toString(contactUrl, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 2,
    color: {
      dark: '#1a1a2e',
      light: '#ffffff',
    },
  });
  return { svg, contactUrl };
}

module.exports = {
  generateCarQRCode,
  generateCarQRCodeSVG,
};
