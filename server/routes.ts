import express from "express";

import { getVersion } from "./utils/getVersion.js";
import {
  handleDeleteDrop,
  handleDuplicateDrop,
  handleGetDrops,
  handleGetGameState,
  handleGetUnlockables,
  handleSaveDrop,
  handleUnlockAttempt,
} from "./controllers/index.js";

const router = express.Router();
const SERVER_START_DATE = new Date();

router.get("/", (req, res) => {
  res.json({ message: "Hello from server!" });
});

router.get("/system/health", (req, res) => {
  return res.json({
    appVersion: getVersion(),
    status: "OK",
    serverStartDate: SERVER_START_DATE,
    envs: {
      COMMIT_HASH: process.env.COMMIT_HASH ?? "NOT SET",
      BUILD_TIME: process.env.BUILD_TIME ?? "NOT SET",
      NODE_ENV: process.env.NODE_ENV,
      INSTANCE_DOMAIN: process.env.INSTANCE_DOMAIN,
      INTERACTIVE_KEY: process.env.INTERACTIVE_KEY,
      S3_BUCKET: process.env.S3_BUCKET,
    },
  });
});

router.get("/game-state", handleGetGameState);
router.post("/unlock/attempt", handleUnlockAttempt);

// Admin — every handler below gates on visitor.isAdmin
router.get("/drops", handleGetDrops);
router.post("/drops", handleSaveDrop);
router.put("/drops/:dropId", handleSaveDrop);
router.delete("/drops/:dropId", handleDeleteDrop);
router.post("/drops/:dropId/duplicate", handleDuplicateDrop);
router.get("/unlockables", handleGetUnlockables);

export default router;
