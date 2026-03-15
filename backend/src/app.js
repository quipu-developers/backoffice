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

const sessionOption = {
  resave: false,
  saveUninitialized: false,
  secret: process.env.COOKIE_SECRET,
  cookie: {
    maxAge: 1000 * 60 * 60 * 2,
    httpOnly: isProdOrTest,
    secure: isProdOrTest,
    ...(isProdOrTest && { sameSite: "None" }),
  },
  ...(isProdOrTest && { proxy: true }),
};

app.use(cookieParser(process.env.COOKIE_SECRET));
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

    app.listen(PORT, () => {
      console.log(`PORT: ${PORT}`);
      console.log(`swagger: http://localhost:${PORT}/api-docs`);
      console.log(`server: http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("DB 연결 실패:", err);
    process.exit(1);
  }
}

startServer();

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
