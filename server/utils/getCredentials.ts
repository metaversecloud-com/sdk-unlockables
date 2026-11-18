import { Credentials } from "../types/Credentials.js";

/**
 * Thrown (never returned) so a bad or missing credential stops the request at the controller's
 * catch block and reaches the client as a credential error, instead of an `{ error }` object
 * flowing on as if it were credentials and failing later as "Admin access required" or a Topia
 * API error. `message` is an own enumerable property so it survives JSON serialization in the
 * error response; `status` sets the HTTP code via `errorHandler`.
 */
const credentialsError = (status: number, message: string) => ({ status, message, functionName: "getCredentials" });

export const getCredentials = (query: any): Credentials => {
  const requiredFields = ["interactiveNonce", "interactivePublicKey", "urlSlug", "visitorId"];
  const missingFields = requiredFields.filter((variable) => !query?.[variable]);
  if (missingFields.length > 0) {
    throw credentialsError(400, `Missing required parameters: ${missingFields.join(", ")}`);
  }

  if (process.env.INTERACTIVE_KEY !== query.interactivePublicKey) {
    throw credentialsError(401, "Provided public key does not match");
  }

  return {
    assetId: query.assetId as string,
    displayName: query.displayName as string,
    identityId: query.identityId as string,
    interactiveNonce: query.interactiveNonce as string,
    interactivePublicKey: query.interactivePublicKey as string,
    profileId: query.profileId as string,
    sceneDropId: query.sceneDropId as string,
    uniqueName: query.uniqueName as string,
    urlSlug: query.urlSlug as string,
    username: query.username as string,
    visitorId: Number(query.visitorId),
  };
};
