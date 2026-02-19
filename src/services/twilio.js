// src/services/twilio.js
// Handles all Twilio operations: masked calls, SMS notifications

const twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const TWILIO_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const APP_URL = process.env.APP_URL;

// ─── MASKED CALLING ──────────────────────────────────────────────────

/**
 * Initiate a masked call:
 * Stranger calls Twilio number → Twilio bridges to owner's real number
 * Stranger never sees owner's real number.
 *
 * How it works:
 * 1. We use Twilio's "TwiML" (XML instructions) to tell Twilio what to do
 * 2. When stranger calls, Twilio fetches instructions from /call/bridge/:carId
 * 3. Those instructions say "dial the owner's real number"
 * 4. Twilio bridges the call — owner's number stays hidden
 *
 * @param {string} carId - Used to route the call to the right owner
 * @returns {string} - The Twilio virtual number to call
 */
function getMaskedCallNumber(carId) {
  // The stranger will call this number. Twilio will bridge to owner.
  // In a real setup, you'd buy one Twilio number per car owner (more private)
  // OR use a single number + IVR routing (more cost-effective)
  return TWILIO_NUMBER;
}

/**
 * Initiate outbound call to stranger — "Request Call" flow
 * We call the stranger first; when they answer, Twilio fetches /call/bridge/:carId
 * and bridges them to the owner. This works with ONE shared Twilio number.
 *
 * @param {string} callerPhone - Stranger's phone number (will receive the call)
 * @param {string} carId - Car ID for routing
 * @returns {Promise<string>} - Twilio call SID
 */
async function initiateOutboundCall(callerPhone, carId) {
  const bridgeUrl = `${APP_URL}/call/bridge/${carId}`;
  const call = await client.calls.create({
    to: callerPhone,
    from: TWILIO_NUMBER,
    url: bridgeUrl,
    method: 'POST',
  });
  return call.sid;
}

/**
 * Generate TwiML to bridge the call to owner's real number
 * This is called by Twilio when an incoming call arrives
 *
 * @param {string} ownerPhone - Owner's real phone number
 * @param {string} callerName - Label shown to owner (e.g., "Parking Alert")
 * @returns {string} - TwiML XML string
 */
function generateCallBridgeTwiML(ownerPhone, carInfo) {
  const twiml = new twilio.twiml.VoiceResponse();

  // Greet the caller (stranger)
  twiml.say(
    { voice: 'alice', language: 'en-IN' },
    `Connecting you to the owner of vehicle ${carInfo.vehicleNumber}. Please wait.`
  );

  // Bridge the call to the owner
  const dial = twiml.dial({
    callerId: TWILIO_NUMBER, // Owner sees Twilio number, not stranger's number
    timeout: 30,
    action: `${APP_URL}/call/no-answer/${carInfo.id}`, // If owner doesn't pick up
  });

  dial.number(ownerPhone);

  return twiml.toString();
}

/**
 * TwiML for when owner doesn't answer
 */
function generateNoAnswerTwiML() {
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say(
    { voice: 'alice', language: 'en-IN' },
    'The car owner is not available right now. An SMS notification has been sent to the owner. Thank you.'
  );
  twiml.hangup();
  return twiml.toString();
}

// ─── SMS NOTIFICATIONS ───────────────────────────────────────────────

/**
 * Notify owner via SMS when their QR code is scanned
 * Owner gets alerted but their number is still hidden from the stranger
 *
 * @param {string} ownerPhone - Owner's real phone number
 * @param {object} carInfo - Car details
 */
async function notifyOwnerOfScan(ownerPhone, carInfo) {
  const message = await client.messages.create({
    body: `🚗 Alert! Someone scanned the QR code on your vehicle ${carInfo.vehicleNumber}. They may need to contact you. Check your CarQR dashboard.`,
    from: TWILIO_NUMBER,
    to: ownerPhone,
  });

  return message.sid;
}

/**
 * Notify owner when someone tried to call but they missed it
 */
async function notifyOwnerMissedCall(ownerPhone, carInfo) {
  const message = await client.messages.create({
    body: `📞 Missed Alert! Someone tried to call you about your vehicle ${carInfo.vehicleNumber} but you didn't answer. Please move your car if it's blocking someone.`,
    from: TWILIO_NUMBER,
    to: ownerPhone,
  });

  return message.sid;
}

/**
 * Send a welcome SMS after registration
 */
async function sendWelcomeSMS(ownerPhone, carInfo) {
  const message = await client.messages.create({
    body: `Welcome to CarQR! Your vehicle ${carInfo.vehicleNumber} has been registered successfully. Your QR tag is ready to print. You'll receive alerts whenever someone scans it.`,
    from: TWILIO_NUMBER,
    to: ownerPhone,
  });
  return message.sid;
}

/**
 * Send OTP for owner login/verification
 */
async function sendOTP(phoneNumber, otp) {
  const message = await client.messages.create({
    body: `Your CarQR verification code is: ${otp}. Valid for 10 minutes. Do not share this with anyone.`,
    from: TWILIO_NUMBER,
    to: phoneNumber,
  });

  return message.sid;
}

module.exports = {
  getMaskedCallNumber,
  initiateOutboundCall,
  generateCallBridgeTwiML,
  generateNoAnswerTwiML,
  notifyOwnerOfScan,
  notifyOwnerMissedCall,
  sendWelcomeSMS,
  sendOTP,
};
