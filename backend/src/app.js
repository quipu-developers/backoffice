const express = require("express");
const app = express();
const morgan = require("morgan");
const winston = require("winston");

const cookieParser = require("cookie-parser");
const path = require("path");
const session = require("express-session");
const passport = require("passport");
const helmet = require("helmet");
const hpp = require("hpp");
const cors = require("cors");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const NODE_ENV = process.env.NODE_ENV;
console.log(`NODE_ENV = ${NODE_ENV}`);
const PORT = process.env.PORT;

const passportConfig = require("../src/passport");
passportConfig();

const { connectDB } = require("../src/models");
const loginRouter = require("../src/routes/login");
const memberRouter = require("../src/routes/member");
const seminaRouter = require("../src/routes/semina");
const featureRouter = require("../src/routes/feature");

const isProdOrTest = NODE_ENV === "production" || NODE_ENV === "test";
const PORT_NUMBER = Number(PORT) || 3001;

const SESSION_SECRET = process.env.COOKIE_SECRET;
if (!SESSION_SECRET && isProdOrTest) {
  throw new Error("COOKIE_SECRET 환경변수가 필요합니다.");
}
const safeSessionSecret = SESSION_SECRET || "dev-only-cookie-secret";

const sessionOption = {
  resave: false,
  saveUninitialized: false,
  secret: safeSessionSecret,
  cookie: {
    maxAge: 1000 * 60 * 60 * 2,
    httpOnly: true,
    secure: isProdOrTest,
    ...(isProdOrTest && { sameSite: "None" }),
  },
  ...(isProdOrTest && { proxy: true }),
};

app.use(cookieParser(safeSessionSecret));
app.use(session(sessionOption));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.json());

if (process.env.NODE_ENV === "development") {
  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN_DEV,
      methods: ["GET", "POST", "OPTIONS", "DELETE", "PATCH"],
      credentials: true,
    })
  );
  app.use(morgan("dev"));
  app.use(express.urlencoded({ extended: false }));
} else {
  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN,
      methods: ["GET", "POST", "PATCH", "OPTIONS"],
      credentials: true,
    })
  );
  app.enable("trust proxy");
  app.use(morgan("combined"));
  app.use(hpp());
  app.use(express.urlencoded({ extended: false }));
  app.use(
    helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'none'"],
        scriptSrc: ["'none'"],
        styleSrc: ["'none'"],
        frameSrc: ["'none'"],
      },
    })
  );
  app.use(helmet.frameguard({ action: "deny" }));
  app.use(helmet.noSniff());
  app.use(helmet.dnsPrefetchControl({ allow: false }));
  app.use(helmet.hidePoweredBy());
  app.use(helmet.referrerPolicy({ policy: "strict-origin-when-cross-origin" }));
}

const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./swagger.json");

async function startServer() {
  try {
    await connectDB();
    console.log("[LOG] MongoDB 연결 성공");

    app.listen(PORT_NUMBER, () => {
      console.log(`PORT: ${PORT_NUMBER}`);
      console.log(`swagger: http://localhost:${PORT_NUMBER}/api-docs`);
      console.log(`server: http://localhost:${PORT_NUMBER}`);
    });
  } catch (err) {
    console.error("DB 연결 실패:", err);
    process.exit(1);
  }
}

startServer();

app.get("/", (req, res) => {
  res.status(200).json({ message: "backoffice backend is running" });
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/bo/auth", loginRouter);
app.use("/bo/member", memberRouter);
app.use("/bo/semina", seminaRouter);
app.use("/bo/feature", featureRouter);

if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

const logger = winston.createLogger({
  level: "error",
  format: winston.format.json(),
  transports: [new winston.transports.File({ filename: "error.log" })],
});

app.use((err, req, res, next) => {
  if (process.env.NODE_ENV === "development") {
    console.log("[ERROR] error handler 동작");
    console.error(err.stack || err);
  } else {
    logger.error(err.message || "Unexpected error");
  }

  res.status(err.status || 500).json({
    error: { message: "Internal Server Error" },
  });
});
