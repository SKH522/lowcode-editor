import { ref } from 'vue'

export interface DragData {
  type: string
  name: string
}

const isDragging = ref(false)
const dragData = ref<DragData | null>(null)

export function useDrag() {
  const handleDragStart = (e: DragEvent, type: string, name: string) => {
    isDragging.value = true
    dragData.value = { type, name }
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'copy'
      e.dataTransfer.setData('text/plain', JSON.stringify(dragData.value))
    }
  }

  const handleDragEnd = () => {
    isDragging.value = false
    dragData.value = null
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy'
    }
  }

  const handleDrop = (e: DragEvent, callback: (type: string) => void) => {
    e.preventDefault()
    const data = e.dataTransfer?.getData('text/plain')
    if (data) {
      try {
        const parsed = JSON.parse(data) as DragData
        callback(parsed.type)
      } catch (e) {
        console.error('Failed to parse drag data')
      }
    }
    handleDragEnd()
  }

  return {
    isDragging,
    dragData,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop
  }
}
