const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const path = require("path");
const rateLimit = require("express-rate-limit");
const session = require("express-session");
const createMemoryStore = require("memorystore");
const bcrypt = require("bcrypt");
const {
  admin_password,
  admin_username,
  allowed_origins,
  dashboard_origin,
  demo_mode,
  node_env,
  session_secret,
  trust_proxy
} = require("./config/env.js");

if (!demo_mode) {
  require("./jobs/cron");
}

const apiRoutesTournaments = require("./routes/api.tournaments.routes.js");
const appAuthRoutes = require("./routes/api.auth.routes.js");
const dashboardRoutes = require("./routes/dashboard.routes.js");
const { logDebug, logInfo, logWarning } = require("./utils/logger.js");

const app = express();
const MemoryStore = createMemoryStore(session);

const publicDir = path.join(__dirname, "public");
const useSecureCookies = node_env === "production";
const sessionStore = useSecureCookies
  ? new MemoryStore({
      checkPeriod: 24 * 60 * 60 * 1000
    })
  : undefined;

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

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: "Trop de tentatives. Reessaie plus tard."
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
  dashboard_origin,
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

app.use(
  session({
    secret: session_secret,
    store: sessionStore,
    proxy: useSecureCookies,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: useSecureCookies ? "auto" : false,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 2
    }
  })
);

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

/* Root */

app.get("/", (req, res) => {
  res.redirect(demo_mode ? "/dashboard/" : "/dashboard/login");
});

/* Dashboard login page + login assets */

app.get("/dashboard/login", (req, res) => {
  if (demo_mode) {
    return res.redirect("/dashboard/");
  }

  res.set("Cache-Control", "no-store");
  res.sendFile(path.join(publicDir, "login/login.html"));
});

app.use(
  "/dashboard/login",
  express.static(path.join(publicDir, "login"), {
    setHeaders(res) {
      res.set("Cache-Control", "no-store");
    }
  })
);

/* Dashboard auth */

app.post("/dashboard/login", loginLimiter, async (req, res) => {
  try {
    if (demo_mode) {
      req.session.admin = true;
      return res.json({
        success: true,
        demo: true
      });
    }

    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: "Identifiants manquants"
      });
    }

    if (username !== admin_username) {
      return res.status(401).json({
        success: false,
        error: "Identifiants invalides"
      });
    }

    const valid = await bcrypt.compare(
      password,
      admin_password
    );

    if (!valid) {
      return res.status(401).json({
        success: false,
        error: "Identifiants invalides"
      });
    }

    req.session.admin = true;

    return res.json({
      success: true
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      error: "Erreur serveur"
    });
  }
});

app.post("/dashboard/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({
      success: true
    });
  });
});

/* Static files */

app.use(
  "/dashboard-assets",
  express.static(path.join(__dirname, "../data/dashboard-assets"))
);

app.use(
  "/dashboard",
  express.static(path.join(publicDir, "dashboard"), {
    setHeaders(res) {
      res.set("Cache-Control", "no-store");
    }
  })
);

/* API */

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", success: true });
});

app.use("/api/app/challenge", appChallengeLimiter);
app.use("/api/app/session", appSessionLimiter);
app.use("/api", apiLimiter);

app.use(appAuthRoutes);
app.use(apiRoutesTournaments);

/* Dashboard dynamic routes AFTER login/static */

app.use(dashboardRoutes);

/* 404 */

app.use((req, res) => {
  res.status(404).json({
    error: "Route introuvable",
    path: req.originalUrl
  });
});

module.exports = app;
