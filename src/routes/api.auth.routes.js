const express = require("express");
const { requireAppKey } = require("../security/apiKey.secure.js");
const {
  createAppChallengeController,
  createAppSessionController
} = require("../controllers/appSession.controller.js");

const router = express.Router();

router.post("/api/app/challenge", requireAppKey, createAppChallengeController);
router.post("/api/app/session", requireAppKey, createAppSessionController);

module.exports = router;
