import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase'
import { getAuthenticatedUserId } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { priceId, tier } = await req.json()
  if (!priceId) {
    return NextResponse.json({ error: 'priceId is required' }, { status: 400 })
  }

  const db = createAdminClient()

  const { data: athlete } = await db
    .from('athletes')
    .select('stripe_customer_id, email, full_name')
    .eq('clerk_user_id', userId)
    .single()

  if (!athlete?.email) {
    return NextResponse.json({ error: 'Athlete record not found' }, { status: 404 })
  }

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
    success_url:          'https://diamondverified.app/dashboard/athlete?upgraded=true',
    cancel_url:           'https://diamondverified.app/dashboard/athlete/settings',
    customer_email:       customerId ? undefined : athlete.email,
    metadata:             { tier: tier ?? '', clerk_user_id: userId },
  })

  return NextResponse.json({ url: session.url })
}
