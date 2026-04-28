import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const PRICE_TO_TIER: Record<string, string> = {
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_ATHLETE!]:     'athlete',
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_ATHLETE_PRO!]: 'athlete_pro',
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_COACH!]:       'coach',
};

function tierFromSubscription(subscription: Stripe.Subscription): string {
  const priceId = subscription.items.data[0]?.price?.id;
  return priceId ? (PRICE_TO_TIER[priceId] ?? 'free') : 'free';
}

async function updateAthleteByCustomer(customerId: string, tier: string) {
  const db = createAdminClient();
  const { error } = await db
    .from('athletes')
    .update({ subscription_tier: tier })
    .eq('stripe_customer_id', customerId);
  if (error) {
    console.error('[stripe-webhook] athlete update error:', error.message);
  }
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[stripe-webhook] signature verification failed:', message);
    return NextResponse.json({ error: `Webhook signature invalid: ${message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'subscription' || !session.subscription || !session.customer) break;

        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        const tier = tierFromSubscription(subscription);
        await updateAthleteByCustomer(session.customer as string, tier);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const tier = subscription.status === 'active' ? tierFromSubscription(subscription) : 'free';
        await updateAthleteByCustomer(subscription.customer as string, tier);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await updateAthleteByCustomer(subscription.customer as string, 'free');
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.customer) {
          await updateAthleteByCustomer(invoice.customer as string, 'free');
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error('[stripe-webhook] handler error:', err);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
