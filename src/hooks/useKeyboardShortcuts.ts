// src/hooks/useKeyboardShortcuts.ts
import { useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'

export function useKeyboardShortcuts() {
  const navigate = useNavigate()
  const location = useLocation()

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input/textarea
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      // Don't trigger if contentEditable
      if ((e.target as HTMLElement)?.isContentEditable) return

      const isCtrl = e.ctrlKey || e.metaKey
      const isAlt = e.altKey
      const isShift = e.shiftKey
      const key = e.key.toLowerCase()

      // ─── NAVIGATION SHORTCUTS ───

      // Alt + Q → Quick Actions
      if (isAlt && !isCtrl && key === 'q') {
        e.preventDefault()
        navigate('/admin/quick')
        toast.success('⚡ Quick Actions', { duration: 1500 })
        return
      }

      // Alt + F → Farmer Search
      if (isAlt && !isCtrl && key === 'f') {
        e.preventDefault()
        navigate('/admin/farmer-search')
        toast.success('👨‍🌾 Farmer Search', { duration: 1500 })
        return
      }

      // Alt + S → Sara Saman (Stock)
      if (isAlt && !isCtrl && key === 's') {
        e.preventDefault()
        navigate('/admin/sara-saman')
        toast.success('📦 Sara Saman Stock', { duration: 1500 })
        return
      }

      // Alt + N → New Bill (Billing POS)
      if (isAlt && !isCtrl && key === 'n') {
        e.preventDefault()
        navigate('/admin/bills')
        toast.success('🧾 Billing POS Opened', { duration: 1500 })
        return
      }

      // Alt + L → Farmer Ledger
      if (isAlt && !isCtrl && key === 'l') {
        e.preventDefault()
        navigate('/admin/ledger')
        toast.success('📒 Farmer Ledger', { duration: 1500 })
        return
      }

      // Alt + P → Payments
      if (isAlt && !isCtrl && key === 'p') {
        e.preventDefault()
        navigate('/admin/payments')
        toast.success('💰 Payments', { duration: 1500 })
        return
      }

      // Alt + D → Dashboard
      if (isAlt && !isCtrl && key === 'd') {
        e.preventDefault()
        navigate('/admin')
        toast.success('🏠 Dashboard', { duration: 1500 })
        return
      }

      // Alt + R → Reports Hub
      if (isAlt && !isCtrl && key === 'r') {
        e.preventDefault()
        navigate('/admin/reports')
        toast.success('📊 Reports Hub', { duration: 1500 })
        return
      }

      // ─── SYSTEM SHORTCUTS ───

      // Ctrl + Shift + R → Hard Refresh
      if (isCtrl && isShift && key === 'r') {
        e.preventDefault()
        toast.loading('🔄 Hard refreshing...', { duration: 1000 })
        setTimeout(() => window.location.reload(), 500)
        return
      }

      // Ctrl + K → Focus Search (navigate to farmer search)
      if (isCtrl && !isShift && key === 'k') {
        e.preventDefault()
        navigate('/admin/farmer-search')
        toast.success('🔍 Search', { duration: 1500 })
        return
      }

      // Escape → Go back to dashboard if on sub-page
      if (key === 'escape' && !isCtrl && !isAlt) {
        if (location.pathname !== '/admin' && location.pathname.startsWith('/admin/')) {
          e.preventDefault()
          navigate('/admin')
          return
        }
      }
    },
    [navigate, location.pathname]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}