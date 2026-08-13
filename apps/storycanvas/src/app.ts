// import "./logger";
import "./err";
import express, { Request, Response, NextFunction } from "express";
import { Server } from "socket.io";
import http from "node:http";
import expressWs from "express-ws";
import logger from "morgan";
import cors, { type CorsOptionsDelegate } from "cors";
import buildRoute from "@/core";
import path from "path";
import fs from "fs";
import u from "@/utils";
import jwt from "jsonwebtoken";
import socketInit from "@/socket/index";
import { isEletron } from "@/utils/getPath";
import { ensureThumbnail, ThumbnailSize } from "@/utils/image";
import { databaseReady, db } from "@/utils/db";
import { initializeModels } from "@/config/initializeModels";
import { capturePilotV02RawBody } from "@/routes/production/v0.2";
import { closePilotCanvasRuntimeResources, getPilotCanvasRuntimeCapability } from "@/services/storycanvas/pilotCanvasCapability";
import pilotCanvasBootstrapRouter, { clearPilotCanvasAuthorityRegistry } from "@/routes/production/pilot/canvas/bootstrap";
import pilotCanvasCapabilityRouter from "@/routes/production/pilot/canvas/capability";

const app = express();
const server = http.createServer(app);
let socketServer: Server | null = null;
let webSocketServer: ReturnType<typeof expressWs>["getWss"] extends () => infer T ? T | null : never = null;

function installPilotCanvasRequestBoundary() {
  app.use("/api/production/pilot/canvas/bootstrap", pilotCanvasBootstrapRouter);
  app.use("/api/production/pilot/canvas/capability", pilotCanvasCapabilityRouter);
}

async function checkPermissions() {
  if (!isEletron()) return true;
  const userDataPath = u.getPath();
  try {
    fs.mkdirSync(userDataPath, { recursive: true });
    const testFile = path.join(userDataPath, ".access_test");
    fs.writeFileSync(testFile, "test");
    fs.unlinkSync(testFile);
  } catch (e) {
    const { dialog, app } = require("electron");
    const { response } = await dialog.showMessageBox({
      type: "warning",
      title: "权限不足",
      message: "应用无法访问数据目录",
      detail: `无法读写以下目录：\n${userDataPath}\n\n请联系管理员授予权限，或以管理员身份运行本程序。`,
      buttons: ["确认退出"],
      defaultId: 0,
    });
    if (response === 0) {
      app.quit();
    }
  }
}

export default async function startServe(randomPort: Boolean = false) {
  await checkPermissions();
  if (process.env.STORYCANVAS_PILOT_CANVAS_ENABLED === "true") {
    const capability = await getPilotCanvasRuntimeCapability();
    if (capability.status !== "ready") {
      throw new Error(capability.code);
    }
  }
  await databaseReady;
  if (process.env.STORYCANVAS_PILOT_CANVAS_ENABLED !== "true") {
    await initializeModels(db);
    await u.writeVersion();
  }
  const io = new Server(server, { cors: { origin: "*" } });
  socketServer = io;
  socketInit(io);

  if (process.env.NODE_ENV == "dev") await buildRoute();

  const ws = expressWs(app, server);
  webSocketServer = ws.getWss();

  if (process.env.STORYCANVAS_PILOT_CANVAS_ENABLED !== "true") {
    app.use(logger("dev"));
  }
  const corsOptions: CorsOptionsDelegate<Request> = (request, callback) => {
    if (request.path.startsWith("/api/production/pilot/canvas/")) {
      const allowedOrigin = process.env.STORYCANVAS_PILOT_ALLOWED_ORIGIN?.trim();
      callback(null, {
        origin: allowedOrigin || false,
        credentials: true,
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["Content-Type", "X-StoryCanvas-CSRF", "X-Request-ID"],
      });
      return;
    }
    callback(null, { origin: "*" });
  };
  app.use(cors(corsOptions));
  installPilotCanvasRequestBoundary();
  app.use(express.json({ limit: "100mb", verify: capturePilotV02RawBody }));
  app.use(express.urlencoded({ extended: true, limit: "100mb" }));

  // oss 静态资源
  const ossDir = u.getPath("oss");
  if (!fs.existsSync(ossDir)) {
    fs.mkdirSync(ossDir, { recursive: true });
  }
  app.use(
    "/oss",
    (req, res, next) => {
      // 如果传参 type=small，则返回小图
      if (req.query.size) {
        const size = req.query.size as string;
        const smallImageBaseDir = path.join(ossDir, "smallImage");
        const originalPath = path.join(ossDir, req.path);

        // 解析 size 参数
        let sizeSubDir: string;
        let sizeOpts: ThumbnailSize | undefined;

        // 判断是否为 WIDTHxHEIGHT 格式，如 "200x300"：等比压缩到指定宽高边界
        const dimensMatch = size.match(/^(\d+)x(\d+)$/i);
        // 判断是否为百分比格式，如 "30"、"30%"：等比压缩到原图的指定百分比
        const percentMatch = size.match(/^(\d+(?:\.\d+)?)\s*%?$/);

        if (dimensMatch) {
          const w = parseInt(dimensMatch[1], 10);
          const h = parseInt(dimensMatch[2], 10);
          sizeSubDir = `${w}x${h}`;
          sizeOpts = { type: "dimensions", width: w, height: h };
        } else if (percentMatch) {
          const pct = parseFloat(percentMatch[1]);
          sizeSubDir = `${percentMatch[1]}p`;
          sizeOpts = { type: "percentage", value: pct };
        } else {
          // 无效的 size 参数，降级返回原图
          express.static(ossDir, { acceptRanges: true })(req, res, next);
          return;
        }

        const ext = path.extname(req.path);
        const base = path.basename(req.path, ext);
        const dir = path.dirname(req.path);
        const smallImagePath = path.join(smallImageBaseDir, dir, `${base}_${sizeSubDir}${ext}`);

        ensureThumbnail(originalPath, smallImagePath, sizeOpts).then((thumbnailPath) => {
          if (thumbnailPath) {
            res.sendFile(thumbnailPath);
          } else {
            // 缩略图生成失败，降级返回原图
            express.static(ossDir, { acceptRanges: true })(req, res, next);
          }
        });
        return;
      }
      next();
    },
    express.static(ossDir, { acceptRanges: true }),
  );
  // skills 静态资源
  const skillsDir = u.getPath("skills");
  if (!fs.existsSync(skillsDir)) {
    fs.mkdirSync(skillsDir, { recursive: true });
  }
  // 只允许图片文件访问
  app.use(
    "/skills",
    (req, res, next) => {
      /\.(jpe?g|png|gif|webp|svg|ico|bmp)$/i.test(req.path) ? next() : res.status(403).end();
    },
    express.static(skillsDir, { acceptRanges: false }),
  );

  // assets 静态资源
  const assetsDir = u.getPath("assets");
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }
  app.use("/assets", express.static(assetsDir, { acceptRanges: false }));

  // StoryCanvas UI is integrated into the root SaaS application. This process
  // intentionally exposes API and media routes only.
  app.get("/", (_req, res) =>
    res.status(404).send({
      message: "StoryCanvas is an internal API. Open the SaaS application on port 5173.",
    }),
  );
  app.get("/favicon.ico", (_req, res) => res.status(204).end());

  app.use(async (req, res, next) => {
    if (req.path.startsWith("/api/production/pilot/canvas/")) {
      return next();
    }
    const setting = await u.db("o_setting").where("key", "tokenKey").select("value").first();
    if (!setting) return res.status(444).send({ message: "服务器秘钥未配置，请联系管理员" });
    const { value: tokenKey } = setting;
    // 从 header 或 query 参数获取 token
    const rawToken = req.headers.authorization || (req.query.token as string) || "";
    const token = rawToken.replace("Bearer ", "");
    // Canonical D1 production routes authenticate with the explicit,
    // project-scoped grant validated by the production contract adapter.
    if (
      req.path === "/api/login/login"
      || req.path.startsWith("/api/production/v0.1/")
      || req.path.startsWith("/api/production/v0.2/")
    ) {
      return next();
    }

    if (!token) return res.status(401).send({ message: "未提供token" });
    try {
      const decoded = jwt.verify(token, tokenKey as string);
      (req as any).user = decoded;
      next();
    } catch (err) {
      return res.status(401).send({ message: "无效的token" });
    }
  });

  const router = await import("@/router");
  await router.default(app);

  // 404 处理
  app.use((_, res, next: NextFunction) => {
    return res.status(404).send({ message: "API 404 Not Found" });
  });

  // 错误处理
  app.use((err: any, _: Request, res: Response, __: NextFunction) => {
    res.locals.message = err.message;
    res.locals.error = err;
    if (process.env.STORYCANVAS_PILOT_CANVAS_ENABLED !== "true") console.error(err);
    res.status(err.status || 500).send(err);
  });

  const configuredPort = process.env.STORYCANVAS_PORT?.trim();
  const parsedPort = configuredPort ? Number(configuredPort) : 10588;
  if (!randomPort && (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535)) {
    throw new Error("STORYCANVAS_PORT_INVALID");
  }
  const port = randomPort ? 0 : parsedPort;
  return await new Promise((resolve) => {
    const onListening = async () => {
      const address = server.address();
      const realPort = typeof address === "string" ? address : address?.port;
      const marker = process.env.STORYCANVAS_PILOT_CANVAS_ENABLED === "true"
        ? "PILOT_CANVAS_RUNTIME_READY"
        : "STORYCANVAS_RUNTIME_READY";
      console.log(`${marker} http://127.0.0.1:${realPort}`);
      resolve(realPort);
    };
    if (process.env.STORYCANVAS_PILOT_CANVAS_ENABLED === "true") {
      server.listen(port, "127.0.0.1", onListening);
    } else {
      server.listen(port, onListening);
    }
  });
}

// 支持await关闭
export async function closeServe(timeoutMs = 5000, signal: "SIGTERM" | "SIGINT" = "SIGTERM"): Promise<void> {
  await closePilotCanvasRuntimeResources({
    signal,
    timeoutMs,
    registry: { clear: clearPilotCanvasAuthorityRegistry },
    http: server,
    socketIo: socketServer,
    webSocket: webSocketServer,
  });
  await db.destroy();
  socketServer = null;
  webSocketServer = null;
  console.log("PILOT_CANVAS_RUNTIME_STOPPED");
}

const isElectron =
  typeof process.versions?.electron !== "undefined" &&
  process.env.ELECTRON_RUN_AS_NODE !== "1";
if (!isElectron) {
  void startServe().catch(() => {
    console.log("PILOT_CANVAS_RUNTIME_BLOCKED");
    process.exitCode = 1;
  });
  let shuttingDown = false;
  const shutdown = (signal: "SIGTERM" | "SIGINT") => {
    if (shuttingDown) return;
    shuttingDown = true;
    void closeServe(5000, signal).then(() => {
      process.exitCode = 0;
    }).catch(() => {
      process.exitCode = 1;
    });
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}
