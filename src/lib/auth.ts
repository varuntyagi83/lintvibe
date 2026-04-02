import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GitHub from "next-auth/providers/github";
import Nodemailer from "next-auth/providers/nodemailer";
import { prisma } from "@/lib/prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    Nodemailer({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM ?? "VibeScan <noreply@vibescan.dev>",
    }),
  ],
  session: {
    strategy: "database",
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        (session.user as { role?: string }).role = (user as { role?: string }).role;
        (session.user as { orgId?: string | null }).orgId = (user as { orgId?: string | null }).orgId;
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
