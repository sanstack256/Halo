import crypto from "crypto";
import bcrypt from "bcrypt";

export async function generateApiKey() {
  const secret = crypto.randomBytes(32).toString("hex");

  const key = `hl_live_${secret}`;

  const prefix = key.slice(0, 18);

  const keyHash = await bcrypt.hash(key, 12);

  return {
    key,
    prefix,
    keyHash,
  };
}