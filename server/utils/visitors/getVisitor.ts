import { Visitor } from "../topiaInit.js";
import { errorHandler } from "../errorHandler.js";
import { Credentials } from "../../types/Credentials.js";

export const getVisitor = async (credentials: Credentials) => {
  try {
    const { urlSlug, visitorId } = credentials;

    const visitor = await Visitor.get(visitorId, urlSlug, { credentials });

    if (!visitor) throw "Not in world";

    return visitor;
  } catch (error) {
    // Rethrown, not returned: an `{ error }` result would be treated as a non-admin visitor
    // ("Admin access required") or fail later with an unrelated error.
    errorHandler({
      error,
      functionName: "getVisitor",
      message: "Error getting visitor",
    });
    throw error;
  }
};
