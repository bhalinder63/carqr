// src/routes/contact.js
// Public-facing contact page — what a stranger sees after scanning the QR code

const express = require('express');
const router = express.Router();

const firebaseService = require('../services/firebase');
const twilioService = require('../services/twilio');

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
 * GET /contact/:carId
 *
 * The landing page a stranger sees after scanning the QR code.
 * Shows car info and a "Call Owner" button.
 * Real phone number is NEVER sent to the browser.
 */
router.get('/:carId', async (req, res) => {
  try {
    const { carId } = req.params;
    const car = await firebaseService.getCarById(carId);

    if (!car || !car.isActive) {
      return res.status(404).send(renderErrorPage('This QR tag is not active or not found.'));
    }

    // Log the scan
    await firebaseService.incrementScanCount(carId);
    await firebaseService.logScan(carId, {
      action: 'qr_scanned',
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    // Notify owner via SMS that their code was scanned
    try {
      await twilioService.notifyOwnerOfScan(car.ownerPhone, car);
    } catch (e) {
      console.warn('Scan notification SMS failed:', e.message);
    }

    // Render the contact page
    // maskedNumber is the Twilio virtual number — safe to display
    res.send(renderContactPage(car));

  } catch (error) {
    console.error('Contact page error:', error);
    res.status(500).send(renderErrorPage('Something went wrong. Please try again.'));
  }
});

// ─── HTML PAGE RENDERERS ─────────────────────────────────────────────

function renderContactPage(car) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Contact Car Owner — ${escapeHtml(car.vehicleNumber)}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    body { font-family: 'Inter', sans-serif; }
    .pulse { animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.6} }
  </style>
</head>
<body class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">

  <div class="bg-white rounded-3xl shadow-xl max-w-sm w-full overflow-hidden">
    
    <!-- Header -->
    <div class="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white text-center">
      <div class="text-4xl mb-2">🚗</div>
      <h1 class="text-xl font-bold">Parking Alert</h1>
      <p class="text-blue-100 text-sm mt-1">Contact the car owner</p>
    </div>

    <!-- Car Info -->
    <div class="p-6">
      <div class="bg-gray-50 rounded-2xl p-4 mb-4 text-center">
        <p class="text-xs text-gray-400 uppercase tracking-widest mb-1">Vehicle Number</p>
        <p class="text-2xl font-bold text-gray-800 tracking-wider">${escapeHtml(car.vehicleNumber)}</p>
        ${car.vehicleModel ? `<p class="text-sm text-gray-500 mt-1">${escapeHtml(car.vehicleModel)}</p>` : ''}
      </div>

      <!-- Owner badge -->
      <div class="flex items-center gap-3 mb-6 bg-green-50 rounded-xl p-3">
        <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold text-lg">
          ${escapeHtml(car.ownerName.charAt(0).toUpperCase())}
        </div>
        <div>
          <p class="text-xs text-gray-400">Owner</p>
          <p class="font-semibold text-gray-700">${escapeHtml(car.ownerName)}</p>
        </div>
        <div class="ml-auto">
          <span class="bg-green-100 text-green-600 text-xs px-2 py-1 rounded-full">Active</span>
        </div>
      </div>

      <!-- Request Call Form -->
      <p class="text-xs text-gray-500 mb-2">Enter your number — we'll call you and connect you to the owner.</p>
      <form id="callRequestForm" class="space-y-3">
        <div class="flex gap-2">
          <select id="callerPrefix" class="border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white w-24">
            <option value="+91">🇮🇳 +91</option>
            <option value="+1">🇺🇸 +1</option>
            <option value="+44">🇬🇧 +44</option>
            <option value="+971">🇦🇪 +971</option>
          </select>
          <input type="tel" id="callerPhone" placeholder="9876543210" required
            class="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button type="submit" id="callBtn"
          class="block w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white text-center py-4 rounded-2xl font-semibold text-lg hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-blue-200 disabled:opacity-60 disabled:cursor-not-allowed">
          📞 Call Me
        </button>
      </form>
      <p id="callStatus" class="text-center text-sm mt-2 hidden"></p>
      
      <p class="text-center text-xs text-gray-400 mt-3">
        Your call will be connected securely.<br>Phone numbers are protected.
      </p>

      <script>
        (function() {
          const form = document.getElementById('callRequestForm');
          const btn = document.getElementById('callBtn');
          const status = document.getElementById('callStatus');
          const carId = '${car.id}';

          form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const phone = document.getElementById('callerPrefix').value + document.getElementById('callerPhone').value.replace(/\\s/g, '');
            btn.disabled = true;
            btn.textContent = 'Calling...';
            status.classList.remove('hidden', 'text-green-600', 'text-red-600');
            status.textContent = '';

            try {
              const res = await fetch('/call/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ carId, callerPhone: phone }),
              });
              const json = await res.json();

              if (res.ok) {
                status.textContent = 'Answer your phone! Connecting you to the owner...';
                status.classList.add('text-green-600');
              } else {
                status.textContent = json.message || 'Failed. Please try again.';
                status.classList.add('text-red-600');
                btn.disabled = false;
                btn.textContent = '📞 Call Me';
              }
            } catch (err) {
              status.textContent = 'Network error. Please try again.';
              status.classList.add('text-red-600');
              btn.disabled = false;
              btn.textContent = '📞 Call Me';
            }
          });
        })();
      </script>

      <!-- Info Note -->
      <div class="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-3">
        <p class="text-xs text-amber-700 text-center">
          ℹ️ The owner has been notified by SMS that someone scanned their QR tag.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div class="border-t p-4 text-center">
      <p class="text-xs text-gray-300">Powered by CarQR • Privacy Protected</p>
    </div>
  </div>

</body>
</html>`;
}

function renderErrorPage(message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Not Found — CarQR</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-3xl shadow-lg max-w-sm w-full p-8 text-center">
    <div class="text-5xl mb-4">😕</div>
    <h1 class="text-xl font-bold text-gray-800 mb-2">Tag Not Found</h1>
    <p class="text-gray-500 text-sm">${escapeHtml(message)}</p>
  </div>
</body>
</html>`;
}

module.exports = router;
