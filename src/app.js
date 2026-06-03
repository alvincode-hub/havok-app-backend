const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const path = require("path");
const rateLimit = require("express-rate-limit");
const { allowed_origins, demo_mode, trust_proxy } = require("./config/env.js");

if (!demo_mode) {
  require("./jobs/cron");
}

const apiRoutesTournaments = require("./routes/api.tournaments.routes.js");
const appAuthRoutes = require("./routes/api.auth.routes.js");
const { logDebug, logInfo, logWarning } = require("./utils/logger.js");

const app = express();
const publicDir = path.join(__dirname, "public");

if (trust_proxy !== false) {
  app.set("trust proxy", trust_proxy);
}

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: {
    success: false,
    error: "Too many requests"
  }
});

const appChallengeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: {
    success: false,
    error: "Trop de demandes de challenge"
  }
});

const appSessionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: "Trop de creations de session"
  }
});

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:8081",
  "http://localhost:19006",
  ...allowed_origins
].filter(Boolean);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "data:"]
      }
    }
  })
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS bloque"));
    },
    credentials: true
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use("/static", express.static(path.join(publicDir, "site")));

app.use((req, res, next) => {
  const startedAt = Date.now();
  logDebug(`HTTP start ${req.method} ${req.originalUrl}`, "Http");

  res.on("finish", () => {
    const duration = Date.now() - startedAt;
    const message = `HTTP ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`;

    if (res.statusCode >= 400) {
      logWarning(message, "Http");
      return;
    }

    logInfo(message, "Http");
  });

  next();
});

app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "site/index.html"));
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", success: true });
});

app.use("/api/app/challenge", appChallengeLimiter);
app.use("/api/app/session", appSessionLimiter);
app.use("/api", apiLimiter);

app.use(appAuthRoutes);
app.use(apiRoutesTournaments);

app.use((req, res) => {
  res.status(404).json({
    error: "Route introuvable",
    path: req.originalUrl
  });
});

module.exports = app;
