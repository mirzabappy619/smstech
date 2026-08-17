'use client'

import { useState, useEffect } from 'react'

type Slide = {
  id?: string
  title: string
  subtitle: string
  badge: string
  image_url: string
  link_url: string
  button_text: string
  sort_order: number
  is_active: boolean
}

const emptySlide: Slide = {
  title: '',
  subtitle: '',
  badge: '⚡ HOT DEAL 2026',
  image_url: '',
  link_url: '/laptops',
  button_text: 'Shop Now',
  sort_order: 1,
  is_active: true,
}

export default function AdminSliders() {
  const [slides, setSlides] = useState<Slide[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSlide, setEditingSlide] = useState<Slide | null>(null)
  const [formData, setFormData] = useState<Slide>(emptySlide)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    loadSlides()
  }, [])

  async function loadSlides() {
    try {
      setLoading(true)
      const res = await fetch('/api/v1/admin/sliders')
      const data = await res.json()
      if (Array.isArray(data)) {
        setSlides(data)
      }
    } catch (e) {
      console.error('Failed to load slides:', e)
    } finally {
      setLoading(false)
    }
  }

  function handleOpenAdd() {
    setEditingSlide(null)
    setFormData({ ...emptySlide, sort_order: slides.length + 1 })
    setUploadError('')
    setModalOpen(true)
  }

  function handleOpenEdit(slide: Slide) {
    setEditingSlide(slide)
    setFormData({ ...slide })
    setUploadError('')
    setModalOpen(true)
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setUploading(true)
      setUploadError('')

      const uploadData = new FormData()
      uploadData.append('file', file)
      uploadData.append('bucket', 'products')
      uploadData.append('folder', 'hero-sliders')

      const res = await fetch('/api/v1/storage/upload', {
        method: 'POST',
        body: uploadData,
      })

      const json = await res.json()
      if (res.ok && json.data?.publicUrl) {
        setFormData((prev) => ({ ...prev, image_url: json.data.publicUrl }))
      } else {
        // Fallback: convert to base64 preview or alert
        const url = URL.createObjectURL(file)
        setFormData((prev) => ({ ...prev, image_url: json.publicUrl || url }))
        if (json.error) setUploadError(json.error)
      }
    } catch (err: any) {
      console.error('Image upload failed:', err)
      setUploadError(err.message || 'Image upload failed. You can paste a direct image URL.')
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.title || !formData.image_url) {
      alert('Please fill in slide title and image URL!')
      return
    }

    try {
      if (editingSlide?.id && !editingSlide.id.startsWith('slide-')) {
        // PUT update
        const res = await fetch(`/api/v1/admin/sliders/${editingSlide.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
        if (res.ok) {
          setSuccessMsg('Slide updated successfully!')
        }
      } else {
        // POST create
        const res = await fetch('/api/v1/admin/sliders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
        if (res.ok) {
          setSuccessMsg('New slide added successfully!')
        }
      }

      setModalOpen(false)
      loadSlides()
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err) {
      console.error('Failed to save slide:', err)
      alert('Error saving slide. Please try again.')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this slide?')) return

    try {
      if (!id.startsWith('slide-')) {
        await fetch(`/api/v1/admin/sliders/${id}`, { method: 'DELETE' })
      }
      setSlides((prev) => prev.filter((s) => s.id !== id))
      setSuccessMsg('Slide deleted successfully.')
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (e) {
      console.error('Delete failed:', e)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm">
        <div>
          <h1 className="text-2xl font-800 text-slate-900 dark:text-white">Hero Slider Management</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Manage storefront hero slides, banners, call-to-action buttons, and Supabase image uploads.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-700 text-sm rounded-xl transition-all shadow-md shadow-blue-500/20 shrink-0 flex items-center gap-2"
        >
          <span>+ Add New Slide</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 font-600 text-sm rounded-xl flex items-center gap-2">
          <span>✅</span> {successMsg}
        </div>
      )}

      {/* Slide Cards */}
      {loading ? (
        <div className="text-center py-16 text-slate-500 dark:text-slate-400">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
          Loading slides...
        </div>
      ) : slides.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
          <p className="text-slate-700 dark:text-slate-200 font-600 text-lg">No slides configured yet</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 mb-4">Add your first slide to customize your homepage hero carousel.</p>
          <button onClick={handleOpenAdd} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-600">
            Create First Slide
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {slides.map((slide, i) => (
            <div
              key={slide.id || i}
              className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col"
            >
              {/* Preview Thumbnail */}
              <div className="relative h-44 bg-slate-900 overflow-hidden">
                <img
                  src={slide.image_url}
                  alt={slide.title}
                  className="w-full h-full object-cover opacity-60"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
                <span className="absolute top-3 left-3 px-2.5 py-1 bg-blue-600 text-white text-[10px] font-800 rounded-full uppercase tracking-wider">
                  {slide.badge || 'FEATURED'}
                </span>
                <span
                  className={`absolute top-3 right-3 px-2.5 py-1 text-[10px] font-700 rounded-full ${
                    slide.is_active !== false
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-600 text-slate-200'
                  }`}
                >
                  {slide.is_active !== false ? 'Active' : 'Draft'}
                </span>
              </div>

              {/* Info */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="font-800 text-slate-900 dark:text-white text-base leading-snug line-clamp-1">
                    {slide.title}
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 line-clamp-2">
                    {slide.subtitle}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-700/80 pt-2.5">
                    <span>Target: <strong className="text-slate-700 dark:text-slate-300 font-600">{slide.link_url}</strong></span>
                    <span>Order: #{slide.sort_order || i + 1}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 border-t border-slate-100 dark:border-slate-700/80 pt-3">
                  <button
                    onClick={() => handleOpenEdit(slide)}
                    className="flex-1 py-2 text-xs font-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    ✏️ Edit Slide
                  </button>
                  <button
                    onClick={() => handleDelete(slide.id || '')}
                    className="px-3 py-2 text-xs font-700 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
              <h2 className="font-800 text-lg text-slate-900 dark:text-white">
                {editingSlide ? 'Edit Hero Slide' : 'Add New Hero Slide'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xl">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-700 text-slate-700 dark:text-slate-300 block mb-1">Slide Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Next-Gen Laptops & Workstations"
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-700 text-slate-700 dark:text-slate-300 block mb-1">Subtitle / Description</label>
                <textarea
                  rows={2}
                  value={formData.subtitle}
                  onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                  placeholder="e.g. High-performance laptops with official warranty & EMI options."
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-700 text-slate-700 dark:text-slate-300 block mb-1">Badge Text</label>
                  <input
                    type="text"
                    value={formData.badge}
                    onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
                    placeholder="e.g. ⚡ NEW ARRIVALS"
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-700 text-slate-700 dark:text-slate-300 block mb-1">Button Text</label>
                  <input
                    type="text"
                    value={formData.button_text}
                    onChange={(e) => setFormData({ ...formData, button_text: e.target.value })}
                    placeholder="e.g. Shop Now"
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-700 text-slate-700 dark:text-slate-300 block mb-1">Target Link URL</label>
                <input
                  type="text"
                  value={formData.link_url}
                  onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                  placeholder="e.g. /laptops or /laptops?cat=pre-owned"
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Supabase Image Upload */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                <label className="text-xs font-700 text-slate-700 dark:text-slate-300 block mb-1">Hero Image *</label>
                
                {/* Upload Box */}
                <div className="p-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-center bg-slate-50 dark:bg-slate-800/60 mb-3">
                  {uploading ? (
                    <div className="text-xs text-blue-600 dark:text-blue-400 font-600 py-2">
                      Uploading to Supabase Storage...
                    </div>
                  ) : (
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        id="slide-image-file"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <label
                        htmlFor="slide-image-file"
                        className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-700 rounded-lg cursor-pointer transition-colors"
                      >
                        📤 Upload Image to Supabase Storage
                      </label>
                      <p className="text-[11px] text-slate-400 mt-1.5">PNG, JPG, WebP up to 10MB</p>
                    </div>
                  )}
                </div>

                {uploadError && (
                  <p className="text-xs text-red-500 mb-2 font-600">{uploadError}</p>
                )}

                {/* Direct URL input */}
                <input
                  type="url"
                  required
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="Or paste image URL (e.g. https://images.unsplash.com/...)"
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:border-blue-500"
                />

                {formData.image_url && (
                  <div className="mt-3 aspect-video rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                    <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                <div>
                  <label className="text-xs font-700 text-slate-700 dark:text-slate-300 block mb-1">Sort Order</label>
                  <input
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 1 })}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-600 text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-4 h-4 rounded accent-blue-600"
                    />
                    <span>Active Slide</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-3 text-slate-600 dark:text-slate-300 font-700 text-sm border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-700 text-sm rounded-xl shadow-md shadow-blue-500/20"
                >
                  Save Slide
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
