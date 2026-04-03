import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GitHub from "next-auth/providers/github";
import Nodemailer from "next-auth/providers/nodemailer";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";

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
    Nodemailer({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM ?? "VibeScan <noreply@vibescan.dev>",
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // Fetch role + orgId from DB on first sign-in
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true, orgId: true },
        });
        token.role = dbUser?.role;
        token.orgId = dbUser?.orgId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { orgId?: string | null }).orgId = token.orgId as string | null;
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
        data: { orgId: org.id, role: "ADMIN" },
      });
    },
  },
});
