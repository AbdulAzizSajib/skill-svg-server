import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import { toNodeHandler } from "better-auth/node";
import path from "path";
import authRouter from "./module/auth/auth.router";
import userRouter from "./module/user/user.router";



import { globalErrorHandler } from "./middleware/globalErrorHandler";
import { notFoundMiddleware } from "./middleware/notFound";
import { envVars } from "./config/env";
import { auth } from "./lib/auth";
import { prisma } from "./lib/prisma";
import categoryRouter from "./module/category/category.router";
import svgRouter from "./module/svg/svg.router";
import tagRouter from "./module/tag/tag.router";
import usageEventRouter from "./module/usageEvent/usageEvent.router";

const app: Express = express();

app.set("trust proxy", true);

app.set("view engine", "ejs");
app.set("views", path.resolve(process.cwd(), `src/app/templates`));

app.use(
  cors({
    origin: [
      envVars.FRONTEND_URL,
      envVars.BETTER_AUTH_URL,
      "http://localhost:3000",
      "http://localhost:5000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Better Auth handler (must be before body parsers)
app.use("/api/auth", toNodeHandler(auth));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// server health check
app.get("/", (_req, res) => {
  res.status(200).send("Server is running...");
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/categories", categoryRouter);
app.use("/api/v1/svg",svgRouter);
app.use("/api/v1/tags", tagRouter);
app.use("/api/v1/usage-events", usageEventRouter);



// temporary db test
app.get("/db-test", async (req, res) => {
  try {
    await prisma.$connect();
    res.json({ success: true, message: "Database connected" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Database connection failed" });
  }
});

app.use(globalErrorHandler);
app.use(notFoundMiddleware);

export default app;
