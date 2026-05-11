import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const resend = new Resend(process.env.RESEND_API_KEY!)

const PRICE_TO_TIER: Record<string, string> = {
  [process.env.STRIPE_VERIFIED_MONTHLY_PRICE_ID ?? 'price_1TUBy1IJP5BSkTrOV2GWhk4e']: 'verified',
  [process.env.STRIPE_VERIFIED_YEARLY_PRICE_ID  ?? 'price_1TUBy1IJP5BSkTrO38zxmCgU']: 'verified',
  [process.env.STRIPE_ELITE_MONTHLY_PRICE_ID    ?? 'price_1TUBzdIJP5BSkTrOTlCFNfKX']: 'elite',
  [process.env.STRIPE_ELITE_YEARLY_PRICE_ID     ?? 'price_1TUC0HIJP5BSkTrORs6SyEbm']: 'elite',
}

const TIER_LABEL: Record<string, string> = {
  verified: 'Diamond Verified',
  elite:    'Diamond Elite',
}

function tierFromPriceId(priceId: string): string {
  return PRICE_TO_TIER[priceId] ?? 'free'
}

async function sendSubscriptionEmail(email: string, tier: string, name: string | null) {
  const label    = TIER_LABEL[tier] ?? tier
  const greeting = name ? `Hi ${name.split(' ')[0]},` : 'Hi,'

  await resend.emails.send({
    from:    'Diamond Verified <noreply@diamondverified.app>',
    to:      email,
    subject: `Welcome to ${label} - Your subscription is active`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0d1117;color:#f0f6fc;padding:2rem;border-radius:12px">
        <p style="color:#e8a020;font-size:0.8rem;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 1rem">&#9670; Diamond Verified</p>
        <h1 style="font-size:1.4rem;font-weight:700;margin:0 0 1rem;color:#f0f6fc">${greeting}</h1>
        <p style="color:#9ca3af;line-height:1.6;margin:0 0 1rem">
          Your <strong style="color:#e8a020">${label}</strong> subscription is now active.
          ${tier === 'verified' ? 'Your Diamond Verified badge is live on your public profile.' : 'Your Diamond Verified badge and School Matches calculator are now unlocked.'}
        </p>
        <a href="https://diamondverified.app/dashboard/athlete" style="display:inline-block;background:#e8a020;color:#000;font-weight:700;padding:0.75rem 1.5rem;border-radius:8px;text-decoration:none;font-size:0.9rem;margin-top:0.5rem">
          View Your Profile &rarr;
        </a>
        <p style="color:#4b5563;font-size:0.78rem;margin-top:2rem;line-height:1.5">
          To manage or cancel your subscription, visit Settings in your dashboard. Questions? Reply to this email or contact support@diamondverified.app.
        </p>
      </div>
    `,
  })
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('[stripe/webhook] signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const db = createAdminClient()

  try {
    if (event.type === 'checkout.session.completed') {
      const session        = event.data.object as Stripe.Checkout.Session
      const subscriptionId = session.subscription as string
      const customerId     = session.customer as string

      const email =
        session.customer_details?.email ??
        (session.customer_email as string | null | undefined) ??
        null

      if (!email) {
        console.error('[stripe/webhook] checkout.session.completed: no email found')
        return NextResponse.json({ received: true })
      }

      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      const priceId = subscription.items.data[0]?.price?.id ?? ''
      const tier    = tierFromPriceId(priceId)

      const { data: athlete, error } = await db
        .from('athletes')
        .update({
          subscription_tier:       tier,
          subscription_status:     'active',
          stripe_customer_id:      customerId,
          stripe_subscription_id:  subscriptionId,
        })
        .eq('email', email)
        .select('full_name')
        .single()

      if (error) {
        console.error('[stripe/webhook] supabase update failed:', error)
      }

      try {
        await sendSubscriptionEmail(email, tier, athlete?.full_name ?? null)
      } catch (emailErr) {
        console.error('[stripe/webhook] resend email failed (non-fatal):', emailErr)
      }
    }

    else if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription
      const priceId      = subscription.items.data[0]?.price?.id ?? ''
      const status       = subscription.status
      const customerId   = subscription.customer as string

      // Downgrade to free if subscription is no longer in good standing
      const tier = (status === 'canceled' || status === 'unpaid')
        ? 'free'
        : tierFromPriceId(priceId)

      const { error } = await db
        .from('athletes')
        .update({
          subscription_tier:   tier,
          subscription_status: status,
        })
        .eq('stripe_customer_id', customerId)

      if (error) {
        console.error('[stripe/webhook] supabase update (subscription.updated) failed:', error)
      }
    }

    else if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription
      const customerId   = subscription.customer as string

      const { error } = await db
        .from('athletes')
        .update({
          subscription_tier:   'free',
          subscription_status: 'canceled',
        })
        .eq('stripe_customer_id', customerId)

      if (error) {
        console.error('[stripe/webhook] supabase update (subscription.deleted) failed:', error)
      }
    }
  } catch (err) {
    console.error('[stripe/webhook] handler error:', err)
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
