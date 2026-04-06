import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GitHub from "next-auth/providers/github";
import Resend from "next-auth/providers/resend";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";
import { sendWelcome } from "@/lib/resend";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: { scope: "read:user user:email repo" },
      },
    }),
    Resend({
      apiKey: process.env.RESEND_API_KEY!,
      from: process.env.EMAIL_FROM ?? "VibeScan <noreply@vibescan.app>",
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      // Always re-fetch from DB so role/tier changes take effect immediately
      // Single query with org include to avoid N+1
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            role: true,
            orgId: true,
            organization: { select: { subscriptionTier: true, stripeCurrentPeriodEnd: true } },
          },
        });
        token.role = dbUser?.role;
        token.orgId = dbUser?.orgId;

        const org = dbUser?.organization ?? null;
        const periodEnd = org?.stripeCurrentPeriodEnd ?? null;
        const isActive = periodEnd ? periodEnd.getTime() > Date.now() : false;
        token.tier = isActive ? (org?.subscriptionTier ?? "FREE") : "FREE";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const u = session.user as any;
        u.role = token.role;
        u.orgId = token.orgId;
        u.tier = token.tier;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.email) return;
      const base = user.email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "-");
      const slug = `${base}-${Math.random().toString(36).slice(2, 7)}`;
      const org = await prisma.organization.create({
        data: { name: user.name ?? base, slug },
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { orgId: org.id, role: "MEMBER" },
      });
      // Welcome email — fire and forget, never block auth
      sendWelcome(user.email, user.name ?? null).catch(() => {});
    },
  },
});
