import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Mirror an emote's preview PNG into our own bucket so the card doesn't depend on the source URL
 * staying reachable.
 *
 * Non-fatal by design: on any failure the source URL is returned unchanged, so a bucket
 * misconfiguration degrades to a hotlinked image rather than blocking the admin's save.
 */
export const uploadEmotePreview = async ({ name, previewUrl }: { name: string; previewUrl: string }): Promise<string> => {
  const bucketName = process.env.S3_BUCKET || "sdk-emunlock";

  try {
    const response = await fetch(previewUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const body = Buffer.from(await response.arrayBuffer());
    const key = `${name}.png`;

    const client = new S3Client({ region: "us-east-1" });
    await client.send(
      new PutObjectCommand({ Bucket: bucketName, Key: key, ContentType: "image/png", Body: body }),
    );

    return `https://${bucketName}.s3.us-east-1.amazonaws.com/${key}`;
  } catch (error) {
    console.error("Error uploading emote preview:", error);
    return previewUrl;
  }
};
