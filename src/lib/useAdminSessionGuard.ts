// src/lib/useAdminSessionGuard.ts
import { useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

const SESSION_TOKEN_KEY = 'satguru_admin_session_token'

export function getOrCreateSessionToken(): string {
  let token = localStorage.getItem(SESSION_TOKEN_KEY)
  if (!token) {
    token = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'sess_' + Math.random().toString(36).substring(2) + Date.now().toString(36)
    localStorage.setItem(SESSION_TOKEN_KEY, token)
  }
  return token
}

export function getDeviceDescription(): string {
  const ua = navigator.userAgent
  let browser = 'Browser'
  if (ua.includes('Chrome')) browser = 'Chrome'
  else if (ua.includes('Safari')) browser = 'Safari'
  else if (ua.includes('Firefox')) browser = 'Firefox'
  else if (ua.includes('Edge')) browser = 'Edge'

  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua)
  return `${isMobile ? 'Mobile' : 'Desktop'} (${browser})`
}

export function useAdminSessionGuard() {
  const navigate = useNavigate()
  const isMountedRef = useRef(true)

  const handleEviction = useCallback((reasonMsg?: string) => {
    if (!isMountedRef.current) return
    toast.error(
      reasonMsg || 'अधिकतम 2 एडमिन सीमा के कारण आपका सत्र समाप्त कर दिया गया है।',
      { duration: 6000, id: 'session_evict' }
    )
    localStorage.removeItem(SESSION_TOKEN_KEY)
    supabase.auth.signOut().finally(() => {
      if (isMountedRef.current) navigate('/login')
    })
  }, [navigate])

  useEffect(() => {
    isMountedRef.current = true
    let intervalId: ReturnType<typeof setInterval> | undefined
    const token = getOrCreateSessionToken()
    const deviceInfo = getDeviceDescription()

    async function initSession() {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session || !isMountedRef.current) return

      const { data, error } = await supabase.rpc('register_admin_session', {
        p_session_token: token,
        p_device_info: deviceInfo,
        p_force_takeover: false,
      })

      if (error) {
        console.warn('Session guard RPC not available or failed:', error.message)
        return
      }

      if (data?.status === 'REVOKED' || data?.status === 'LIMIT_EXCEEDED') {
        handleEviction(data.message)
      }
    }

    initSession()

    intervalId = setInterval(async () => {
      if (!isMountedRef.current) return
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session) return

      const { data, error } = await supabase.rpc('heartbeat_admin_session', {
        p_session_token: token,
      })

      if (!error && data && data.valid === false) {
        handleEviction(
          data.reason === 'SESSION_REVOKED'
            ? 'आपका सत्र किसी अन्य एडमिन द्वारा बंद कर दिया गया है।'
            : 'सत्र समाप्त हो गया है।'
        )
      }
    }, 30000)

    // ── FIX: Safe Try-Catch wrapper instead of .catch() ──
    return () => {
      isMountedRef.current = false
      if (intervalId) clearInterval(intervalId)

      const cleanupSession = async () => {
        try {
          await supabase.rpc('deregister_admin_session', {
            p_session_token: token,
          })
        } catch (e) {
          console.warn('Session cleanup failed silently:', e)
        }
      }

      void cleanupSession()
    }
  }, [handleEviction])

  return { getOrCreateSessionToken }
}