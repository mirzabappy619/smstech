import Link from 'next/link'

export default function OrderSuccess() {
  const orderNumber = `#SMST-2026-${Math.floor(Math.random() * 90000 + 10000)}`

  return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950/60 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg viewBox="0 0 24 24" className="w-10 h-10 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h1 className="text-3xl font-800 text-slate-900 dark:text-white mb-2">Order Confirmed!</h1>
      <p className="text-slate-500 dark:text-slate-400 mb-2">Thank you for shopping with SMSTech.</p>
      <p className="font-700 text-blue-600 dark:text-blue-400 text-lg mb-8">{orderNumber}</p>

      <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-6 text-left space-y-3 mb-8 border border-slate-100 dark:border-slate-700/80 transition-colors">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500 dark:text-slate-400">Delivery method</span>
          <span className="font-600 text-slate-900 dark:text-white">Home Delivery</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500 dark:text-slate-400">Expected delivery</span>
          <span className="font-600 text-slate-900 dark:text-white">2–3 business days</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500 dark:text-slate-400">Payment</span>
          <span className="font-600 text-slate-900 dark:text-white">Cash on Delivery</span>
        </div>
      </div>

      <div className="p-4 bg-blue-50 dark:bg-blue-950/60 rounded-2xl border border-blue-100 dark:border-blue-900 mb-8 text-sm text-blue-800 dark:text-blue-300">
        📦 Your order has been recorded into the SMSTech system. You will receive tracking updates shortly.
      </div>

      <div className="flex flex-wrap gap-3 justify-center">
        <Link href="/track-order" className="px-6 py-3 border border-slate-200 dark:border-slate-700 rounded-xl font-600 text-slate-700 dark:text-slate-200 hover:border-blue-300 dark:hover:border-blue-500 transition-colors text-sm">
          Track Order
        </Link>
        <Link href="/admin/orders" className="px-6 py-3 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 rounded-xl font-600 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors text-sm">
          View in Admin Orders
        </Link>
        <Link href="/" className="px-6 py-3 bg-blue-600 text-white font-700 rounded-xl hover:bg-blue-700 transition-colors text-sm">
          Continue Shopping
        </Link>
      </div>
    </div>
  )
}
