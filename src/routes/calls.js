// src/routes/calls.js
// Handles Twilio call webhook — bridges calls between stranger and owner

const express = require("express");
const router = express.Router();
const twilio = require("twilio");

const firebaseService = require("../services/firebase");
const twilioService = require("../services/twilio");

function errorTwiML(message) {
  const response = new twilio.twiml.VoiceResponse();
  response.say({ voice: "alice" }, message);
  response.hangup();
  return response.toString();
}

/**
 * POST /call/request
 *
 * Called by the contact page when a stranger clicks "Call Me".
 * We initiate an outbound call to the stranger's phone, and when they
 * answer, Twilio fetches /call/bridge/:carId to connect them to the owner.
 */
router.post("/request", async (req, res) => {
  try {
    const { carId, callerPhone } = req.body;

    if (!carId || !callerPhone) {
      return res
        .status(400)
        .json({ success: false, message: "Car ID and phone number are required." });
    }

    const car = await firebaseService.getCarById(carId);
    if (!car || !car.isActive) {
      return res
        .status(404)
        .json({ success: false, message: "Vehicle not found or inactive." });
    }

    await firebaseService.logScan(carId, {
      action: "call_requested",
      callerNumber: callerPhone,
    });

    const callSid = await twilioService.initiateOutboundCall(callerPhone, carId);

    res.json({
      success: true,
      message: "Call initiated. Answer your phone!",
      callSid,
    });
  } catch (error) {
    console.error("Call request error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to initiate call. Please try again." });
  }
});

/**
 * POST /call/bridge/:carId
 *
 * Called by TWILIO (not the browser) when the outbound call connects.
 * Responds with TwiML XML that bridges the stranger to the owner's real number.
 */
router.post("/bridge/:carId", async (req, res) => {
  try {
    const { carId } = req.params;
    const car = await firebaseService.getCarById(carId);

    if (!car || !car.isActive) {
      res.type("text/xml");
      return res.send(
        errorTwiML("Sorry, this vehicle is not registered in our system."),
      );
    }

    await firebaseService.logScan(carId, {
      action: "call_initiated",
      callerNumber: req.body.From || "unknown",
    });

    const twiml = twilioService.generateCallBridgeTwiML(car.ownerPhone, car);
    res.type("text/xml");
    res.send(twiml);
  } catch (error) {
    console.error("Call bridge error:", error);
    res.type("text/xml");
    res.send(errorTwiML("An error occurred. Please try again later."));
  }
});

/**
 * POST /call/no-answer/:carId
 *
 * Called by Twilio when owner doesn't pick up.
 * Plays a message to the caller and SMSes the owner.
 */
router.post("/no-answer/:carId", async (req, res) => {
  try {
    const { carId } = req.params;
    const car = await firebaseService.getCarById(carId);

    if (car) {
      await twilioService.notifyOwnerMissedCall(car.ownerPhone, car);

      await firebaseService.logScan(carId, {
        action: "call_missed",
        callerNumber: req.body.From || "unknown",
      });
    }

    const twiml = twilioService.generateNoAnswerTwiML();
    res.type("text/xml");
    res.send(twiml);
  } catch (error) {
    console.error("No-answer handler error:", error);
    res.type("text/xml");
    res.send(errorTwiML("An error occurred. Goodbye."));
  }
});

/**
 * POST /call/status
 * Twilio call status callback — logs call completion
 */
router.post("/status", async (req, res) => {
  console.log("Call status update:", req.body.CallStatus);
  res.sendStatus(200);
});

module.exports = router;
