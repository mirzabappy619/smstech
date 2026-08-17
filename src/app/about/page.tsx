import Link from 'next/link'

export default function About() {
  return (
    <div>
      <div className="bg-slate-900 dark:bg-slate-950 py-24 text-center relative overflow-hidden transition-colors">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, #2563EB 0%, transparent 50%)' }} />
        <div className="relative max-w-3xl mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-800 text-white mb-4">Technology You Can Trust.</h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            SMSTech is a dedicated electronics retailer committed to bringing genuine, warranty-backed technology to customers across Bangladesh — both online and through our physical stores.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-16 space-y-16">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            ['2', 'Physical Stores'],
            ['100%', 'Genuine Products'],
            ['500+', 'Products'],
            ['24/7', 'Online Shopping'],
          ].map(([v, l]) => (
            <div key={l} className="text-center p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/80 transition-colors">
              <p className="text-3xl font-800 text-blue-600 dark:text-blue-400 mb-1">{v}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 font-600">{l}</p>
            </div>
          ))}
        </div>

        {/* Story */}
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-2xl font-800 text-slate-900 dark:text-white mb-4">Our Story</h2>
            <div className="space-y-4 text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
              <p>SMSTech was founded with a clear mission: to make genuine, high-quality technology accessible to everyone in Bangladesh. We specialize in laptops and smartphones from the world's most trusted brands.</p>
              <p>We operate physical retail locations in Dhaka where customers can see, touch, and compare products before making a purchase decision. Our in-store team is trained to help you find the right device for your budget and needs.</p>
              <p>Online, we offer a seamless shopping experience with transparent pricing, detailed specifications, and reliable nationwide delivery — or the option to pick up in-store on the same day.</p>
            </div>
          </div>
          <div>
            <img
              src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&h=450&fit=crop&auto=format"
              alt="SMSTech Store"
              className="rounded-2xl w-full object-cover h-64 border border-slate-200 dark:border-slate-700"
            />
          </div>
        </div>

        {/* Values */}
        <div>
          <h2 className="text-2xl font-800 text-slate-900 dark:text-white mb-8 text-center">What We Stand For</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5">
            {[
              { icon: '✅', title: 'Authenticity First', desc: 'Every product we sell is sourced from authorized distributors and carries full manufacturer authenticity.' },
              { icon: '🛡️', title: 'Warranty Backed', desc: 'All eligible products come with official manufacturer warranty — no grey market, no surprises.' },
              { icon: '💬', title: 'Expert Guidance', desc: 'Our team can guide you through specs, comparisons, and compatibility to help you make the right choice.' },
              { icon: '🏪', title: 'Physical Presence', desc: 'We believe in the power of in-person shopping — our stores are a place to explore and decide with confidence.' },
              { icon: '🚚', title: 'Reliable Delivery', desc: 'We partner with trusted courier services to deliver your purchase safely anywhere across Bangladesh.' },
              { icon: '🔄', title: 'Customer First', desc: "From purchase to after-sales, we're committed to making your experience smooth and trustworthy." },
            ].map((v) => (
              <div key={v.title} className="p-5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800/80 hover:border-blue-200 dark:hover:border-blue-500 hover:shadow-md transition-all">
                <div className="text-2xl mb-3">{v.icon}</div>
                <h3 className="font-700 text-slate-900 dark:text-white mb-2">{v.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Team CTA */}
        <div className="bg-blue-600 dark:bg-blue-700 rounded-3xl p-10 text-center text-white">
          <h3 className="text-2xl font-800 mb-2">Come Visit Us</h3>
          <p className="text-blue-200 text-sm mb-6">Our stores are open 6 days a week. Come meet our team, explore products, and shop with confidence.</p>
          <Link href="/stores" className="inline-block px-6 py-3 bg-white text-blue-600 font-700 rounded-xl hover:bg-blue-50 transition-colors text-sm">
            Find Our Stores →
          </Link>
        </div>
      </div>
    </div>
  )
}
