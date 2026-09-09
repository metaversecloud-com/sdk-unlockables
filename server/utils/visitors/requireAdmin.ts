import { Response } from "express";
import { Credentials } from "../../types/index.js";
import { getVisitor } from "./getVisitor.js";

/** True only for a real visitor object flagged admin — never inferred from anything client-supplied. */
export const isAdminVisitor = (visitor: any): boolean => !!visitor?.isAdmin;

/**
 * Gate an admin-only route. Responds 403 and returns null when the caller isn't an admin, so the
 * controller can `if (!visitor) return;`.
 *
 * Every drop-mutating route needs this: the client-side gear button is a UI affordance, not access
 * control, and an unguarded route lets any visitor rewrite the whole schedule or wipe its stats.
 */
export const requireAdmin = async (credentials: Credentials, res: Response): Promise<any | null> => {
  const visitor = await getVisitor(credentials);

  if (!isAdminVisitor(visitor)) {
    res.status(403).json({ success: false, message: "Admin access required" });
    return null;
  }

  return visitor;
};
