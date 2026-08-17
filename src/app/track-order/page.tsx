'use client'

import { useState } from 'react'

const deliverySteps = ['Order Confirmed', 'Processing', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered']
const pickupSteps = ['Order Confirmed', 'Preparing', 'Ready for Pickup', 'Collected']

export default function TrackOrder() {
  const [form, setForm] = useState({ orderNumber: '', phone: '' })
  const [tracked, setTracked] = useState(false)
  const [type, setType] = useState<'delivery' | 'pickup'>('delivery')

  const activeStep = 3
  const steps = type === 'delivery' ? deliverySteps : pickupSteps

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (form.orderNumber && form.phone) setTracked(true)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <h1 className="text-2xl font-800 text-slate-900 dark:text-white mb-2">Track Your Order</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Enter your order number and phone to check delivery status.</p>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 rounded-2xl p-6 mb-8 transition-colors">
        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <label className="text-xs font-700 text-slate-700 dark:text-slate-300 block mb-1.5">Order Number</label>
            <input
              value={form.orderNumber}
              onChange={(e) => setForm({ ...form, orderNumber: e.target.value })}
              placeholder="e.g. SMST-2026-000123"
              className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs font-700 text-slate-700 dark:text-slate-300 block mb-1.5">Phone Number</label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+880 1XXX-XXXXXX"
              className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors"
            />
          </div>
          <button type="submit" className="w-full py-3.5 bg-blue-600 text-white font-700 rounded-xl hover:bg-blue-700 transition-colors text-sm">
            Track Order
          </button>
        </form>
      </div>

      {tracked && (
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 rounded-2xl p-6 space-y-6 transition-colors">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-700 text-slate-900 dark:text-white">Order {form.orderNumber || '#SMST-2026-000123'}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Placed on 14 August 2026</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setType('delivery')} className={`px-3 py-1.5 text-xs font-600 rounded-lg ${type === 'delivery' ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>Delivery</button>
              <button onClick={() => setType('pickup')} className={`px-3 py-1.5 text-xs font-600 rounded-lg ${type === 'pickup' ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>Pickup</button>
            </div>
          </div>

          {/* Timeline */}
          <div className="relative">
            <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-slate-100 dark:bg-slate-700" />
            <div className="space-y-6">
              {steps.map((step, i) => {
                const done = i < activeStep
                const current = i === activeStep
                return (
                  <div key={step} className="flex items-start gap-4 relative">
                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 z-10 transition-all
                      ${done ? 'border-emerald-500 bg-emerald-500' :
                        current ? 'border-blue-600 bg-blue-600 dark:border-blue-400 dark:bg-blue-500' :
                        'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'}`}>
                      {done ? (
                        <svg viewBox="0 0 12 12" className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M2 6l3 3 5-5" />
                        </svg>
                      ) : (
                        <div className={`w-2 h-2 rounded-full ${current ? 'bg-white' : 'bg-slate-300 dark:bg-slate-600'}`} />
                      )}
                    </div>
                    <div className="pt-1">
                      <p className={`text-sm font-700 ${done || current ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>{step}</p>
                      {done && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Completed</p>}
                      {current && <p className="text-xs text-blue-600 dark:text-blue-400 font-600 mt-0.5">Current Status · August 14, 2026</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {type === 'delivery' && (
            <div className="p-4 bg-blue-50 dark:bg-blue-950/60 rounded-xl border border-blue-100 dark:border-blue-900">
              <p className="text-sm font-600 text-blue-900 dark:text-blue-200">📦 Estimated delivery: August 15–16, 2026</p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">Our courier will contact you before delivery.</p>
            </div>
          )}
          {type === 'pickup' && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl border border-emerald-100 dark:border-emerald-900">
              <p className="text-sm font-600 text-emerald-900 dark:text-emerald-200">🏪 Ready for pickup at SMSTech — Store 01</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">Bring this order number and your phone for pickup.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
