// src/lib/auth.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from './supabase'
import { User, Session } from '@supabase/supabase-js'

type UserRole = 'admin' | 'farmer' | 'guest'

interface AuthContextType {
  user: User | null
  session: Session | null
  role: UserRole
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<UserRole>('guest')
  const [loading, setLoading] = useState(true)

  const syncUserProfileRole = async (userId: string, email: string): Promise<UserRole> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, is_active')
        .eq('id', userId)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      if (data) {
        // Enforce account activation check
        if (data.is_active === false) {
          await supabase.auth.signOut().catch(() => {})
          localStorage.removeItem('user_role')
          return 'guest'
        }

        const assignedRole: UserRole = (data.role as UserRole) || 'guest'
        localStorage.setItem('user_role', assignedRole)
        return assignedRole
      } else {
        // Secure Registration: Never grant admin role from client-side code.
        // Default to 'guest' until approved on server side.
        const { error: insertErr } = await supabase.from('profiles').insert([
          {
            id: userId,
            role: 'guest',
            full_name: email.split('@')[0] || 'User',
            is_active: true,
            can_share_whatsapp_history: false,
          },
        ])

        if (!insertErr) {
          localStorage.setItem('user_role', 'guest')
          return 'guest'
        }
        return 'guest'
      }
    } catch (err) {
      console.warn('Profile role sync failed:', err)
      localStorage.removeItem('user_role')
      return 'guest'
    }
  }

  useEffect(() => {
    let isMounted = true

    const initAuth = async () => {
      try {
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          console.warn('Stale auth session detected, resetting:', sessionError.message)
          await supabase.auth.signOut().catch(() => {})
          localStorage.removeItem('user_role')
          // Keep custom farmer PIN session; only native auth is stale here.
          if (isMounted) {
            setSession(null)
            setUser(null)
            setRole('guest')
            setLoading(false)
          }
          return
        }

        if (!isMounted) return

        setSession(currentSession)
        setUser(currentSession?.user ?? null)

        if (currentSession?.user) {
          const resolvedRole = await syncUserProfileRole(
            currentSession.user.id,
            currentSession.user.email || ''
          )
          if (!isMounted) return
          setRole(resolvedRole)
        } else {
          setRole('guest')
          localStorage.removeItem('user_role')
        }
      } catch (err) {
        console.warn('Auth initialization fallback:', err)
        if (isMounted) {
          setSession(null)
          setUser(null)
          setRole('guest')
          localStorage.removeItem('user_role')
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    initAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return

      if (event === 'SIGNED_OUT' || !newSession) {
        setSession(null)
        setUser(null)
        setRole('guest')
        localStorage.removeItem('user_role')
        setLoading(false)
        return
      }

      setSession(newSession)
      setUser(newSession.user ?? null)

      if (newSession.user) {
        setLoading(true)
        const resolvedRole = await syncUserProfileRole(
          newSession.user.id,
          newSession.user.email || ''
        )
        if (!isMounted) return
        setRole(resolvedRole)
        setLoading(false)
      } else {
        setRole('guest')
        localStorage.removeItem('user_role')
        setLoading(false)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setLoading(false)
    return { error }
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch (e) {
      console.warn('SignOut network exception ignored:', e)
    } finally {
      const farmerSession = sessionStorage.getItem('farmer_session')
      sessionStorage.clear()
      if (farmerSession) sessionStorage.setItem('farmer_session', farmerSession)
      localStorage.removeItem('user_role')
      setRole('guest')
      setUser(null)
      setSession(null)
      setLoading(false)
    }
  }

  return (
    <AuthContext.Provider value={{ user, session, role, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}