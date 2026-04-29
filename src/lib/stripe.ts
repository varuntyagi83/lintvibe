import Stripe from "stripe";

// Lazily instantiated — avoids constructor throw during `next build` when env vars aren't set
let _stripe: Stripe | undefined;
export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("[stripe] STRIPE_SECRET_KEY is not configured");
    _stripe = new Stripe(key, { apiVersion: "2026-04-22.dahlia", typescript: true });
  }
  return _stripe;
}

// Canonical price IDs — never accept these from the client
export const STRIPE_PRICES = {
  pro_monthly:  process.env.STRIPE_PRICE_PRO_MONTHLY!,
  pro_annual:   process.env.STRIPE_PRICE_PRO_ANNUAL!,
} as const;

export type PlanKey = keyof typeof STRIPE_PRICES;

export const PLAN_NAMES: Record<PlanKey, string> = {
  pro_monthly: "Pro (monthly)",
  pro_annual:  "Pro (annual)",
};

/** Maps a Stripe price ID back to our tier string */
export function tierFromPriceId(priceId: string | null | undefined): "FREE" | "PRO" {
  if (!priceId) return "FREE";
  const values = Object.values(STRIPE_PRICES);
  return values.includes(priceId as never) ? "PRO" : "FREE";
}

/** Returns true if the subscription is currently active (period not expired) */
export function isSubscriptionActive(periodEnd: Date | null | undefined): boolean {
  if (!periodEnd) return false;
  return periodEnd.getTime() > Date.now();
}
