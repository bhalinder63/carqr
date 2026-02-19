// src/routes/printTag.js
// Generates a print-ready QR tag for the car owner to stick on their windscreen

const express = require('express');
const router = express.Router();

const firebaseService = require('../services/firebase');
const qrService = require('../services/qrcode');

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * GET /print-tag/:carId
 * Returns a print-ready HTML page with the QR code tag
 * Car owner opens this, clicks print, cuts it out, and sticks it on their car
 */
router.get('/:carId', async (req, res) => {
  try {
    const car = await firebaseService.getCarById(req.params.carId);
    if (!car) return res.status(404).send('Car not found');

    const { svg } = await qrService.generateCarQRCodeSVG(car.id);

    res.send(renderPrintPage(car, svg));
  } catch (error) {
    console.error('Print tag error:', error);
    res.status(500).send('Failed to generate print tag');
  }
});

function renderPrintPage(car, qrSvg) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Print QR Tag — ${escapeHtml(car.vehicleNumber)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f0f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }

    .page { background: white; padding: 30px; }

    /* The actual tag — designed to be cut out and laminated */
    .tag {
      width: 85mm;           /* Credit card width */
      border: 2px dashed #ccc;
      border-radius: 12px;
      padding: 16px;
      text-align: center;
      background: white;
      margin: 0 auto 20px;
    }

    .tag-header {
      background: linear-gradient(135deg, #1a56db, #3b82f6);
      color: white;
      border-radius: 8px;
      padding: 8px;
      margin-bottom: 12px;
    }

    .tag-header h1 { font-size: 13px; font-weight: 700; letter-spacing: 1px; }
    .tag-header p  { font-size: 9px; opacity: 0.85; margin-top: 2px; }

    .qr-container { background: white; padding: 8px; border-radius: 8px; display: inline-block; margin: 8px 0; }
    .qr-container svg { width: 120px; height: 120px; }

    .vehicle-number {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: 3px;
      color: #1a1a2e;
      margin: 8px 0 4px;
      font-family: 'Courier New', monospace;
    }

    .tag-footer {
      font-size: 8px;
      color: #666;
      border-top: 1px solid #eee;
      padding-top: 8px;
      margin-top: 8px;
      line-height: 1.5;
    }

    .scan-instruction {
      background: #eff6ff;
      border-radius: 6px;
      padding: 6px 8px;
      font-size: 9px;
      color: #1d4ed8;
      margin: 8px 0;
    }

    /* Print controls (not printed) */
    .controls { text-align: center; margin-top: 16px; }
    .btn-print {
      background: #1a56db; color: white;
      border: none; padding: 10px 24px;
      border-radius: 8px; font-size: 14px;
      cursor: pointer; margin: 4px;
    }

    @media print {
      body { background: white; }
      .controls { display: none; }
      .tag { border: 2px dashed #999; }
      @page { margin: 10mm; }
    }
  </style>
</head>
<body>
  <div class="page">
    
    <!-- Print Tag -->
    <div class="tag">
      <div class="tag-header">
        <h1>🚗 PARKING ALERT</h1>
        <p>Scan to contact car owner</p>
      </div>

      <div class="qr-container">
        ${qrSvg}
      </div>

      <div class="vehicle-number">${escapeHtml(car.vehicleNumber)}</div>
      ${car.vehicleModel ? `<p style="font-size:9px;color:#888;margin-bottom:4px">${escapeHtml(car.vehicleModel)}</p>` : ''}

      <div class="scan-instruction">
        📱 Scan QR code with any camera app<br>
        to contact the owner securely
      </div>

      <div class="tag-footer">
        Phone numbers are protected &amp; private.<br>
        Powered by CarQR &bull; carqr.app
      </div>
    </div>

    <!-- Print Controls -->
    <div class="controls">
      <p style="font-size:12px;color:#888;margin-bottom:12px">
        Print this page, cut along the dashed border, and laminate for best results.
      </p>
      <button class="btn-print" onclick="window.print()">🖨️ Print Tag</button>
      <button class="btn-print" style="background:#6b7280" onclick="window.history.back()">← Back</button>
    </div>

  </div>
</body>
</html>`;
}

module.exports = router;
