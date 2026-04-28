'use client'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const plans = [
  {
    name: 'Free',
    price: 0,
    description: 'Get started with a basic profile',
    features: [
      'Basic athlete profile',
      '3 school matches',
      'Public profile page',
    ],
    priceId: null,
    tier: 'free',
  },
  {
    name: 'Athlete',
    price: 29.99,
    description: 'Get verified and get noticed',
    features: [
      'Everything in Free',
      'Diamond Verified badge',
      'Document uploads',
      'AI scout assessment',
      'Unlimited school matches',
    ],
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ATHLETE,
    tier: 'athlete',
    popular: false,
  },
  {
    name: 'Athlete Pro',
    price: 59.99,
    description: 'Maximum exposure to coaches',
    features: [
      'Everything in Athlete',
      'PDF profile download',
      'Email profile to coaches',
      'AI development roadmap',
      'Priority in coach search',
    ],
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ATHLETE_PRO,
    tier: 'athlete_pro',
    popular: true,
  },
  {
    name: 'Team / Coach',
    price: 149,
    description: 'Full recruiting portal for coaches',
    features: [
      'Coach dashboard',
      'Advanced prospect search',
      'Save & bookmark athletes',
      'Athlete management tools',
      'Evaluation tools',
    ],
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_COACH,
    tier: 'coach',
    popular: false,
  },
]

export default function PricingPage() {
  const { user } = useUser()
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  const handleSubscribe = async (priceId: string | null | undefined, tier: string) => {
    if (tier === 'free') return
    if (!user) {
      router.push('/sign-in')
      return
    }
    setLoading(tier)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-600">
            Get verified. Get recruited.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.tier}
              className={`bg-white rounded-2xl shadow-sm border-2 p-6 flex flex-col ${
                plan.popular
                  ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-20'
                  : 'border-gray-200'
              }`}
            >
              {plan.popular && (
                <div className="bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full w-fit mb-4">
                  MOST POPULAR
                </div>
              )}
              <h2 className="text-xl font-bold text-gray-900">{plan.name}</h2>
              <p className="text-gray-500 text-sm mt-1 mb-4">{plan.description}</p>
              <div className="mb-6">
                {plan.price === 0 ? (
                  <span className="text-3xl font-bold text-gray-900">Free</span>
                ) : (
                  <>
                    <span className="text-3xl font-bold text-gray-900">
                      ${plan.price}
                    </span>
                    <span className="text-gray-500">/mo</span>
                  </>
                )}
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-green-500 font-bold mt-0.5">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleSubscribe(plan.priceId, plan.tier)}
                disabled={loading === plan.tier || plan.tier === 'free'}
                className={`w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all ${
                  plan.popular
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : plan.tier === 'free'
                    ? 'bg-gray-100 text-gray-400 cursor-default'
                    : 'bg-gray-900 text-white hover:bg-gray-700'
                } disabled:opacity-50`}
              >
                {loading === plan.tier
                  ? 'Loading...'
                  : plan.tier === 'free'
                  ? 'Current Plan'
                  : 'Get Started'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}