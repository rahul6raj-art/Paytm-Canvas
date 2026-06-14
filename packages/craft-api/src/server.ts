import cors from "cors";
import express from "express";
import {
  corsAllowedOrigins,
  isAnonAccessAllowed,
  isCraftApiProduction,
  trustProxy,
  validateCraftApiConfig,
} from "./config.js";
import { attachSessionUser, enforceApiTokenScope } from "./middleware/auth.js";
import { assetsRouter } from "./routes/assets.js";
import { authRouter } from "./routes/auth.js";
import { invitesRouter } from "./routes/invites.js";
import { membersRouter } from "./routes/members.js";
import { teamsRouter } from "./routes/teams.js";
import { v1Router } from "./routes/v1.js";

const port = Number(process.env.CRAFT_API_PORT ?? 4000);

const app = express();
if (trustProxy()) {
  app.set("trust proxy", 1);
}

const corsOrigins = corsAllowedOrigins();
app.use(
  cors({
    origin: corsOrigins === true ? true : corsOrigins,
    credentials: true,
  }),
);
app.use(express.json({ limit: "32mb" }));
app.use(attachSessionUser);
app.use("/v1", enforceApiTokenScope);

for (const warning of validateCraftApiConfig()) {
  console.warn(`[craft-api] config: ${warning}`);
}

app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "craft-api",
    env: isCraftApiProduction() ? "production" : "development",
    anonAccess: isAnonAccessAllowed(),
  });
});

app.use("/v1/auth", authRouter);
v1Router.use("/teams", teamsRouter);
v1Router.use("/workspaces/:workspaceId/members", membersRouter);
v1Router.use("/workspaces/:workspaceId/invites", invitesRouter);
v1Router.use("/workspaces/:workspaceId/assets", assetsRouter);
app.use("/v1", v1Router);

app.use((_req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
});

app.listen(port, () => {
  console.log(
    `[craft-api] http://localhost:${port}/v1 (health: /health, anon=${isAnonAccessAllowed() ? "on" : "off"})`,
  );
});
