import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { FolderOpen, FileText, ExternalLink, Loader2, ShieldCheck, Image as ImageIcon, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Strict Type Definitions ─────────────────────────────────────────
type Farmer = {
  id: string
  farmer_id: string
  farmer_name: string
}

type FarmerDocument = {
  id: string
  farmer_id: string
  document_type: string
  file_name: string | null
  storage_path: string
  created_at: string
}

const BUCKET_NAME = 'farmer-documents'

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

export default function DocumentViewer() {
  const [farmers, setFarmers] = useState<Farmer[]>([])
  const [farmerId, setFarmerId] = useState<string>('')
  const [docs, setDocs] = useState<FarmerDocument[]>([])
  const [loadingFarmers, setLoadingFarmers] = useState<boolean>(true)
  const [loadingDocs, setLoadingDocs] = useState<boolean>(false)
  const [generatingUrlFor, setGeneratingUrlFor] = useState<string | null>(null)

  const isMountedRef = useRef<boolean>(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // ── Step 1: Load Active Farmers ──
  const loadFarmersList = useCallback(async () => {
    try {
      setLoadingFarmers(true)
      const { data, error } = await supabase
        .from('farmers')
        .select('id, farmer_id, farmer_name')
        .eq('account_status', 'active')
        .order('farmer_name')

      if (error) throw error
      if (isMountedRef.current) {
        setFarmers(data || [])
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load farmers list'
      if (isMountedRef.current) {
        toast.error(msg)
      }
    } fontally: {
      if (isMountedRef.current) {
        setLoadingFarmers(false)
      }
    }
  }, [])

  useEffect(() => {
    loadFarmersList()
  }, [loadFarmersList])

  // ── Step 2: Fetch Documents for Selected Farmer ──
  const loadDocs = async (selectedFarmerId: string) => {
    setFarmerId(selectedFarmerId)
    if (!selectedFarmerId) {
      setDocs([])
      return
    }

    setLoadingDocs(true)
    try {
      const { data, error } = await supabase
        .from('farmer_documents')
        .select('*')
        .eq('farmer_id', selectedFarmerId)
        .order('created_at', { ascending: false })

      if (error) throw error
      if (isMountedRef.current) {
        setDocs((data as FarmerDocument[]) || [])
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load documents'
      if (isMountedRef.current) {
        toast.error(msg)
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingDocs(false)
      }
    }
  }

  // ── Step 3: Secure Signed URL Generator with Popup Blocker Bypass ──
  const openSecureDocument = async (doc: FarmerDocument) => {
    // If it's already an external HTTP link
    if (doc.storage_path.startsWith('http://') || doc.storage_path.startsWith('https://')) {
      window.open(doc.storage_path, '_blank', 'noopener,noreferrer')
      return
    }

    // 📌 POPUP BLOCKER BYPASS: Open window synchronously on click thread
    const newWindow = window.open('', '_blank')
    if (newWindow) {
      newWindow.document.write('<html><body style="background:#091e17;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;"><h3>Generating secure signed link...</h3></body></html>')
    }

    setGeneratingUrlFor(doc.id)
    try {
      // Create a signed URL valid for 60 seconds (Private Bucket Security)
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(doc.storage_path, 60)

      if (error) {
        throw new Error(`Storage Error: ${error.message}`)
      }

      if (data?.signedUrl) {
        if (newWindow) {
          newWindow.location.href = data.signedUrl
        } else {
          window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
        }
      } else {
        if (newWindow) newWindow.close()
        toast.error('Could not generate secure document link')
      }
    } catch (err: unknown) {
      if (newWindow) newWindow.close()
      const msg = err instanceof Error ? err.message : 'Failed to open document'
      if (isMountedRef.current) {
        toast.error(msg)
      }
    } finally {
      if (isMountedRef.current) {
        setGeneratingUrlFor(null)
      }
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto p-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FolderOpen className="text-amber-400" size={28} /> Farmer Document Vault
        </h1>
        <p className="text-emerald-200 text-xs mt-1 flex items-center gap-1">
          <ShieldCheck size={14} className="text-emerald-400" />
          Secure Admin Access · Time-limited Signed URLs for Private Storage
        </p>
      </div>

      {/* Farmer Select Dropdown */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Select Active Farmer
        </label>
        <select
          value={farmerId}
          disabled={loadingFarmers}
          onChange={(e) => loadDocs(e.target.value)}
          aria-label="Select active farmer"
          className="w-full border border-slate-300 rounded-2xl px-4 py-3 text-sm font-bold bg-white text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:opacity-50"
        >
          <option value="">
            {loadingFarmers ? 'Loading farmers list...' : '-- Select Farmer --'}
          </option>
          {farmers.map((f) => (
            <option key={f.id} value={f.id}>
              {f.farmer_name} ({f.farmer_id})
            </option>
          ))}
        </select>
      </div>

      {/* Documents List Container */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {loadingDocs ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <Loader2 size={24} className="animate-spin mx-auto text-emerald-600" />
            <p className="text-xs font-semibold">Fetching documents...</p>
          </div>
        ) : !farmerId ? (
          <div className="p-12 text-center text-slate-400 text-xs font-medium">
            Please select a farmer above to view attached documents.
          </div>
        ) : docs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-1">
            <FileText size={32} className="mx-auto text-slate-300" />
            <p className="text-sm font-bold text-slate-700">No documents found</p>
            <p className="text-xs text-slate-400">No records uploaded for this farmer yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100" role="list" aria-label="Farmer documents list">
            {docs.map((d) => {
              const isOpening = generatingUrlFor === d.id
              const isImage = (d.file_name || d.storage_path).match(/\.(jpg|jpeg|png|webp)$/i)

              return (
                <div
                  key={d.id}
                  role="listitem"
                  className="p-4 flex justify-between items-center gap-4 hover:bg-slate-50/80 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 rounded-xl bg-slate-100 text-slate-600 shrink-0">
                      {isImage ? <ImageIcon size={20} /> : <FileText size={20} />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs uppercase tracking-wide text-emerald-950 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                          {d.document_type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                          <Calendar size={10} />
                          {formatDate(d.created_at)}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-slate-600 truncate mt-1 font-mono">
                        {d.file_name || d.storage_path}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isOpening}
                    onClick={() => openSecureDocument(d)}
                    aria-label={`View document ${d.document_type}`}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-sm transition-all shrink-0 active:scale-95 disabled:opacity-50"
                  >
                    {isOpening ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Signing...
                      </>
                    ) : (
                      <>
                        <ExternalLink size={14} />
                        View Document
                      </>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}