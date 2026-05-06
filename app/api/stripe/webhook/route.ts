import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const PRICE_TO_TIER: Record<string, string> = {
  [process.env.STRIPE_VERIFIED_MONTHLY_PRICE_ID ?? 'price_1TUBy1IJP5BSkTrOV2GWhk4e']: 'verified',
  [process.env.STRIPE_VERIFIED_YEARLY_PRICE_ID  ?? 'price_1TUBy1IJP5BSkTrO38zxmCgU']: 'verified',
  [process.env.STRIPE_ELITE_MONTHLY_PRICE_ID    ?? 'price_1TUBzdIJP5BSkTrOTlCFNfKX']: 'elite',
  [process.env.STRIPE_ELITE_YEARLY_PRICE_ID     ?? 'price_1TUC0HIJP5BSkTrORs6SyEbm']: 'elite',
}

function tierFromPriceId(priceId: string): string {
  return PRICE_TO_TIER[priceId] ?? 'free'
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
      const session = event.data.object as Stripe.Checkout.Session
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

      const { error } = await db
        .from('athletes')
        .update({
          subscription_tier:       tier,
          subscription_status:     'active',
          stripe_customer_id:      customerId,
          stripe_subscription_id:  subscriptionId,
        })
        .eq('email', email)

      if (error) {
        console.error('[stripe/webhook] supabase update failed:', error)
      }
    }

    else if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription
      const priceId    = subscription.items.data[0]?.price?.id ?? ''
      const tier       = tierFromPriceId(priceId)
      const status     = subscription.status
      const customerId = subscription.customer as string

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
