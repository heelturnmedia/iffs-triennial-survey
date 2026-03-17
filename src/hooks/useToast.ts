import { useUIStore } from '@/stores/uiStore'

export function useToast() {
  const { addToast } = useUIStore()
  return {
    toast:   (msg: string, type: 'ok' | 'err' | 'info' = 'info') => addToast(msg, type),
    success: (msg: string) => addToast(msg, 'ok'),
    error:   (msg: string) => addToast(msg, 'err'),
    info:    (msg: string) => addToast(msg, 'info'),
  }
}
