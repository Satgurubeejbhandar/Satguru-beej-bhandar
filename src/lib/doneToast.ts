import toast from 'react-hot-toast'

/** Standard success UX: DONE message, auto-dismiss ~10s */
export function showDone(message: string = 'DONE') {
  toast.success(message, {
    duration: 10000,
    style: {
      background: '#064e3b',
      color: '#fff',
      fontWeight: 800,
      borderRadius: '14px',
      padding: '12px 16px',
    },
  })
}

export function showFormError(error: string) {
  toast.error(error, { duration: 6000 })
}