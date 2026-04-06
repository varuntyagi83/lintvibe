import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe, STRIPE_PRICES, type PlanKey } from "@/lib/stripe";
import { checkRateLimit } from "@/lib/rate-limit";
import { bypassesRateLimit } from "@/lib/super-admin";

const bodySchema = z.object({
  plan: z.enum(["pro_monthly", "pro_annual"]),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Only org admins can manage billing" }, { status: 403 });
  }

  const { allowed } = checkRateLimit(
    session.user.id,
    5,
    60 * 60 * 1000,
    bypassesRateLimit(session.user.email)
  );
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { plan } = body;
  // Price ALWAYS comes from the server-side map — never from client
  const priceId = STRIPE_PRICES[plan as PlanKey];
  if (!priceId) {
    return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      name: true,
      orgId: true,
      organization: { select: { stripeCustomerId: true, stripeSubscriptionId: true, stripeCurrentPeriodEnd: true } },
    },
  });

  if (!user?.orgId) {
    return NextResponse.json({ error: "No organization found" }, { status: 400 });
  }

  // Block if already on active Pro subscription
  const org = user.organization as { stripeCustomerId: string | null; stripeSubscriptionId: string | null; stripeCurrentPeriodEnd: Date | null } | null;
  if (org?.stripeSubscriptionId && org?.stripeCurrentPeriodEnd) {
    const isActive = org.stripeCurrentPeriodEnd.getTime() > Date.now();
    if (isActive) {
      return NextResponse.json({ error: "Already subscribed — manage via billing portal" }, { status: 409 });
    }
  }

  const appUrl = process.env.NEXTAUTH_URL ?? "https://vibescan.app";

  // Reuse existing Stripe customer or create new one
  let customerId = org?.stripeCustomerId ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: user.name ?? undefined,
      metadata: { orgId: user.orgId, userId: session.user.id },
    });
    customerId = customer.id;
    await prisma.organization.update({
      where: { id: user.orgId },
      data: { stripeCustomerId: customerId },
    });
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/billing?success=1`,
    cancel_url: `${appUrl}/billing?cancelled=1`,
    subscription_data: {
      metadata: { orgId: user.orgId },
    },
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
