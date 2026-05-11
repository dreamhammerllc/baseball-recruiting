import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY
    if (!stripeKey) {
      return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 })
    }
    const stripe = new Stripe(stripeKey)

    const db = createAdminClient()

    const { data: athlete } = await db
      .from('athletes')
      .select('stripe_customer_id')
      .eq('clerk_user_id', userId)
      .single()

    if (!athlete?.stripe_customer_id) {
      return NextResponse.json({ error: 'No billing account found' }, { status: 404 })
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer:   athlete.stripe_customer_id,
      return_url: 'https://diamondverified.app/dashboard/athlete/settings',
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[stripe/portal]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
