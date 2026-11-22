import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db, hasDb } from "@/src/db";
import { users } from "@/src/db/schema";
import { credentials } from "@/src/lib/validation";
import { smtpConfig } from "@/src/lib/mail-config";
import {
  checkPassword,
  rateLimit,
  requestIP,
} from "@/src/features/account/security";

function eligibleToSignIn(user: {
  verifiedAt: Date | null;
  role: "customer" | "admin";
}) {
  return !!user.verifiedAt || (user.role === "customer" && !smtpConfig());
}

const authApp = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  pages: { signIn: "/logowanie" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  // Browsers share cookies between apps on different localhost ports.
  cookies:
    process.env.NODE_ENV === "development"
      ? {
          sessionToken: { name: "nexora.dev.session-token", options: {} },
          csrfToken: { name: "nexora.dev.csrf-token", options: {} },
          callbackUrl: { name: "nexora.dev.callback-url", options: {} },
        }
      : undefined,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(input, request) {
        const parsed = credentials.safeParse(input);
        if (!parsed.success || !hasDb) return null;
        const { email, password } = parsed.data;
        const ip = requestIP(request.headers);
        const allowed =
          (await rateLimit(`login-ip:${ip}`, 40)) &&
          (await rateLimit(`login-email:${email}`, 10));
        if (!allowed) return null;
        const [user] = await db()
          .select()
          .from(users)
          .where(eq(users.email, email));
        const valid = await checkPassword(password, user?.passwordHash);
        if (!user || !valid || !eligibleToSignIn(user)) return null;
        await db()
          .update(users)
          .set({ lastLoginAt: new Date() })
          .where(eq(users.id, user.id));
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          authVersion: user.authVersion,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user && "authVersion" in user) token.authVersion = user.authVersion;
      return token;
    },
    session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.sub,
          authVersion: token.authVersion,
        },
      };
    },
  },
});
export const { auth, handlers, signIn, signOut } = authApp;

export const viewer = cache(async () => {
  if (!hasDb || !process.env.AUTH_SECRET) return undefined;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return undefined;
  const [user] = await db()
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      phone: users.phone,
      lastLoginAt: users.lastLoginAt,
      verifiedAt: users.verifiedAt,
      version: users.authVersion,
    })
    .from(users)
    .where(eq(users.id, userId));
  return user &&
    eligibleToSignIn(user) &&
    user.version === (session.user as { authVersion?: number }).authVersion
    ? user
    : undefined;
});
export async function requireCustomer() {
  const user = await viewer();
  if (!user) redirect("/logowanie");
  return user;
}
export async function requireAdmin() {
  const user = await viewer();
  if (!user) redirect("/logowanie?powrot=/admin");
  if (user.role !== "admin") redirect("/konto");
  return user;
}
