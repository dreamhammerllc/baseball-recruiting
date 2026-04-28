import { NextRequest, NextResponse } from 'next/server'
import { createClerkClient } from '@clerk/backend'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const clerk = createClerkClient({
  secretKey:      process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
})

async function getAuthenticatedUserId(req: NextRequest): Promise<string | null> {
  try {
    const state = await clerk.authenticateRequest(req, {
      secretKey:      process.env.CLERK_SECRET_KEY,
      publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    })
    if (!state.isSignedIn) return null
    return state.toAuth().userId
  } catch (err) {
    console.error('[stripe/checkout] authenticateRequest error:', err)
    return null
  }
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(req)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { priceId } = await req.json()

    const { data: athlete } = await supabase
      .from('athletes')
      .select('stripe_customer_id, email, full_name')
      .eq('clerk_user_id', userId)
      .single()

    let customerId = athlete?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: athlete?.email,
        name: athlete?.full_name,
        metadata: { clerk_user_id: userId }
      })
      customerId = customer.id

      await supabase
        .from('athletes')
        .update({ stripe_customer_id: customerId })
        .eq('clerk_user_id', userId)
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/athlete?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
