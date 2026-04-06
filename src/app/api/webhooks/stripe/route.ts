import { NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { sendSubscriptionConfirmation } from "@/lib/resend";
import type Stripe from "stripe";

export const maxDuration = 30;

// Stripe requires the raw body to verify signatures — must NOT parse as JSON first
export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET not set");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stripe/webhook] Signature verification failed:", msg);
    return new Response(`Webhook signature invalid: ${msg}`, { status: 400 });
  }

  // DB-backed idempotency — survives deploys and works across multiple instances
  try {
    await prisma.processedStripeEvent.create({ data: { id: event.id } });
  } catch {
    // Unique constraint violation = already processed; return 200 to stop Stripe retrying
    return new Response(JSON.stringify({ received: true, skipped: "duplicate" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;
        if (checkoutSession.mode !== "subscription") break;

        const subscriptionId = checkoutSession.subscription as string;
        const customerId = checkoutSession.customer as string;
        const orgId = checkoutSession.metadata?.orgId;

        if (!subscriptionId || !customerId || !orgId) {
          console.error("[stripe/webhook] checkout.session.completed missing required fields");
          break;
        }

        const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0]?.price.id ?? null;
        const periodEnd = new Date((subscription as unknown as { current_period_end: number }).current_period_end * 1000);

        await prisma.organization.update({
          where: { id: orgId },
          data: {
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            stripePriceId: priceId,
            stripeCurrentPeriodEnd: periodEnd,
            subscriptionTier: "PRO",
          },
        });

        // Send confirmation email to the org's admin
        const admin = await prisma.user.findFirst({
          where: { orgId, role: "ADMIN" },
          select: { email: true },
        });
        if (admin?.email) {
          sendSubscriptionConfirmation(admin.email, "Pro", periodEnd).catch(() => {});
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string; customer?: string };
        const subscriptionId = invoice.subscription;
        if (!subscriptionId) break;

        const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
        const periodEnd = new Date((subscription as unknown as { current_period_end: number }).current_period_end * 1000);
        const orgId = subscription.metadata?.orgId;
        if (!orgId) break;

        await prisma.organization.update({
          where: { id: orgId },
          data: {
            stripeCurrentPeriodEnd: periodEnd,
            subscriptionTier: "PRO",
          },
        });
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription & { current_period_end: number };
        const orgId = sub.metadata?.orgId;
        if (!orgId) break;

        const priceId = sub.items.data[0]?.price.id ?? null;
        const periodEnd = new Date(sub.current_period_end * 1000);
        // cancel_at_period_end = true means they've cancelled but are still active until period end
        const isActive = sub.status === "active" || sub.status === "trialing";

        await prisma.organization.update({
          where: { id: orgId },
          data: {
            stripePriceId: priceId,
            stripeCurrentPeriodEnd: periodEnd,
            subscriptionTier: isActive ? "PRO" : "FREE",
          },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const orgId = sub.metadata?.orgId;
        if (!orgId) break;

        await prisma.organization.update({
          where: { id: orgId },
          data: {
            stripeSubscriptionId: null,
            stripePriceId: null,
            stripeCurrentPeriodEnd: null,
            subscriptionTier: "FREE",
          },
        });
        break;
      }

      default:
        // Ignore unhandled event types
        break;
    }
  } catch (err) {
    console.error(`[stripe/webhook] Error handling ${event.type}:`, err);
    // Return 200 so Stripe doesn't retry — log and investigate separately
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
