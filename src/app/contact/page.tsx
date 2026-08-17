'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function Contact() {
  const [form, setForm] = useState({ name: '', phone: '', email: '', subject: '', message: '' })
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-800 text-slate-900 dark:text-white mb-2">Get in Touch</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">We're happy to answer your questions about laptops, smartphones, pre-owned products, or orders.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-10">
        {/* Form */}
        <div>
          {submitted ? (
            <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="text-5xl mb-4">✅</div>
              <h3 className="text-xl font-700 text-slate-900 dark:text-white mb-2">Message Sent!</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm">We'll get back to you within 24 hours.</p>
              <button onClick={() => setSubmitted(false)} className="mt-4 text-blue-600 dark:text-blue-400 font-600 text-sm hover:underline">Send Another Message</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700/80 transition-colors">
              <h2 className="font-700 text-slate-900 dark:text-white mb-4">Send a Message</h2>
              {[
                ['Full Name', 'name', 'text'],
                ['Phone Number', 'phone', 'tel'],
                ['Email Address', 'email', 'email'],
                ['Subject', 'subject', 'text'],
              ].map(([label, field, type]) => (
                <div key={field}>
                  <label className="text-xs font-700 text-slate-700 dark:text-slate-300 block mb-1.5">{label}</label>
                  <input
                    type={type}
                    value={(form as any)[field]}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors"
                    placeholder={label as string}
                  />
                </div>
              ))}
              <div>
                <label className="text-xs font-700 text-slate-700 dark:text-slate-300 block mb-1.5">Message</label>
                <textarea
                  rows={5}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors resize-none"
                  placeholder="How can we help you?"
                />
              </div>
              <button type="submit" className="w-full py-3.5 bg-blue-600 text-white font-700 rounded-xl hover:bg-blue-700 transition-colors text-sm">
                Send Message
              </button>
            </form>
          )}
        </div>

        {/* Info */}
        <div className="space-y-6">
          <div>
            <h2 className="font-700 text-slate-900 dark:text-white mb-4">Contact Information</h2>
            <div className="space-y-3">
              {[
                ['📞', 'Hotline / Phone', '01781485588 / 01723249598'],
                ['📧', 'Email', 'info@smstech.bd'],
                ['🕐', 'Store Hours', '10:00 AM – 8:00 PM (Everyday)'],
              ].map(([icon, label, value]) => (
                <div key={label} className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700/80">
                  <span className="text-xl">{icon}</span>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-600">{label}</p>
                    <p className="text-sm font-700 text-slate-900 dark:text-white">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Main Store Location */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-5 bg-white dark:bg-slate-800 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-700 text-slate-900 dark:text-white">SMSTech — Multiplan Branch</h3>
              <span className="text-xs font-700 px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 rounded-full">Main Store</span>
            </div>
            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <p className="font-600 text-slate-900 dark:text-white">📍 Shop - 309, Level -03, Computer City Market (Multiplan), New Elephant Road (69-71), Dhaka - 1205</p>
              <p>📞 01781485588, 01723249598</p>
              <p>🕐 10:00 AM – 8:00 PM</p>
            </div>
            <Link href="/stores" className="block mt-4 text-sm text-blue-600 dark:text-blue-400 font-600 hover:underline">View Map &amp; Directions →</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
