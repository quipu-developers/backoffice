const express = require("express");
const morgan = require("morgan");
const winston = require("winston");
const cookieParser = require("cookie-parser");
const path = require("path");
const helmet = require("helmet");
const hpp = require("hpp");
const cors = require("cors");
const passport = require("passport");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const app = express();
const NODE_ENV = process.env.NODE_ENV || "development";
const PORT = process.env.PORT || 4000;

[
  "COOKIE_SECRET",
  "ACCESS_TOKEN_SECRET",
  "BO_BACKEND_URL",
  "BO_FRONTEND_URL",
  "BO_ALLOWED_ORIGINS",
  "MONGO_URI",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "SERVER_SECRET_SALT",
].forEach((k) => {
  if (!process.env[k]) throw new Error(`${k} is required`);
});

const { connectMongo } = require("./config/mongo");
const { bootstrapSuperAdmin } = require("./services/superAdminBootstrap");
const { getRedisMode } = require("./services/redisClient");
const passportConfig = require("./passport");

const memberRouter = require("./routes/member");
const seminaRouter = require("./routes/semina");
const featureRouter = require("./routes/feature");
const boAuthRouter = require("./routes/boAuth");
const boAdminUsersRouter = require("./routes/boAdminUsers");
const boAdminInvitesRouter = require("./routes/boAdminInvites");

const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./swagger.json");

const allowedOrigins = process.env.BO_ALLOWED_ORIGINS.split(",")
  .map((v) => v.trim())
  .filter(Boolean);

app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(passport.initialize());

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

app.use(
  helmet({
    contentSecurityPolicy: false,
    frameguard: { action: "deny" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    noSniff: true,
  })
);

if (NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.enable("trust proxy");
  app.use(morgan("combined"));
  app.use(hpp());
}

app.use("/bo/auth", boAuthRouter);
app.use("/bo/admin/users", boAdminUsersRouter);
app.use("/bo/admin/invites", boAdminInvitesRouter);
app.use("/bo/member", memberRouter);
app.use("/bo/semina", seminaRouter);
app.use("/bo/feature", featureRouter);

if (NODE_ENV === "development" || NODE_ENV === "test") {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

const logger = winston.createLogger({
  level: "error",
  format: winston.format.json(),
  transports: [new winston.transports.File({ filename: "error.log" })],
});

app.use((err, _req, res, _next) => {
  if (NODE_ENV === "development" || NODE_ENV === "test") {
    console.error(err.stack || err);
  } else {
    logger.error(err.message || "Unexpected error");
  }

  res.status(err.status || 500).json({
    code: "INTERNAL_ERROR",
    message: "Internal Server Error",
  });
});

async function startServer() {
  try {
    passportConfig();

    await connectMongo();
    await bootstrapSuperAdmin();

    const rateLimiterMode = getRedisMode();
    console.log(`[LOG] Rate limiter mode: ${rateLimiterMode}`);

    app.listen(PORT, () => {
      console.log(`PORT: ${PORT}`);
      console.log(`server: http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Server start failed:", err);
    process.exit(1);
  }
}

startServer();
