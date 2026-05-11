import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PRICE_MAP: Record<string, string | undefined> = {
  'verified:monthly': process.env.STRIPE_VERIFIED_MONTHLY_PRICE_ID,
  'verified:yearly':  process.env.STRIPE_VERIFIED_YEARLY_PRICE_ID,
  'elite:monthly':    process.env.STRIPE_ELITE_MONTHLY_PRICE_ID,
  'elite:yearly':     process.env.STRIPE_ELITE_YEARLY_PRICE_ID,
}

const SUCCESS_URL = 'https://diamondverified.app/dashboard/athlete?upgraded=true'
const CANCEL_URL  = 'https://diamondverified.app/dashboard/athlete/upgrade'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { tier, period } = await req.json()
    if (!tier || !period) {
      return NextResponse.json({ error: 'tier and period are required' }, { status: 400 })
    }

    const priceId = PRICE_MAP[`${tier}:${period}`]
    if (!priceId) {
      return NextResponse.json({ error: `No price configured for ${tier}:${period}` }, { status: 400 })
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY
    if (!stripeKey) {
      return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 })
    }
    const stripe = new Stripe(stripeKey)

    const db = createAdminClient()

    const { data: athlete } = await db
      .from('athletes')
      .select('stripe_customer_id, stripe_subscription_id, email, full_name')
      .eq('clerk_user_id', userId)
      .single()

    if (!athlete?.email) {
      return NextResponse.json({ error: 'Athlete record not found' }, { status: 404 })
    }

    // If athlete already has an active subscription, upgrade it in-place
    if (athlete.stripe_subscription_id) {
      try {
        const existing = await stripe.subscriptions.retrieve(athlete.stripe_subscription_id)

        if (existing.status === 'active' || existing.status === 'trialing') {
          const itemId = existing.items.data[0]?.id
          if (itemId) {
            await stripe.subscriptions.update(athlete.stripe_subscription_id, {
              items:              [{ id: itemId, price: priceId }],
              proration_behavior: 'create_prorations',
            })
            // Webhook will fire subscription.updated and sync Supabase
            return NextResponse.json({ url: SUCCESS_URL })
          }
        }
      } catch (retrieveErr) {
        // Subscription may have been deleted in Stripe; fall through to new checkout
        console.warn('[create-checkout] could not retrieve existing subscription:', retrieveErr)
      }
    }

    // No active subscription — create a new Stripe customer if needed
    let customerId = athlete.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email:    athlete.email,
        name:     athlete.full_name ?? undefined,
        metadata: { clerk_user_id: userId },
      })
      customerId = customer.id

      await db
        .from('athletes')
        .update({ stripe_customer_id: customerId })
        .eq('clerk_user_id', userId)
    }

    const session = await stripe.checkout.sessions.create({
      customer:             customerId,
      payment_method_types: ['card'],
      line_items:           [{ price: priceId, quantity: 1 }],
      mode:                 'subscription',
      success_url:          SUCCESS_URL,
      cancel_url:           CANCEL_URL,
      metadata:             { tier, clerk_user_id: userId },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[create-checkout]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
