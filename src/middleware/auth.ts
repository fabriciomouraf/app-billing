import { bearerAuth } from "hono/bearer-auth";
import type { Env } from "../lib/env.js";
import { SignJWT, jwtVerify } from "jose";

const JWT_ISSUER = "app-billing";
const JWT_AUDIENCE = "app-billing";

export function createAuthMiddleware() {
  return bearerAuth({
    verifyToken: async (token, c) => {
      const secret = c.env.JWT_SECRET;
      if (!secret) return false;
      try {
        const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
        });
        const sub = payload.sub;
        if (typeof sub === "string") {
          c.set("userId", sub);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
  });
}

export async function signToken(
  userId: string,
  secret: string,
  expiresIn = "24h"
): Promise<string> {
  const exp = expiresIn === "24h" ? "24h" : "7d";
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(new TextEncoder().encode(secret));
}
