import { ref } from 'vue'

export interface DragData {
  type: string
  name: string
  sourceIndex?: number
}

const isDragging = ref(false)
const dragData = ref<DragData | null>(null)
const dragOverIndex = ref<number>(-1) // 拖拽经过的位置索引

export function useDrag() {
  const handleDragStart = (e: DragEvent, type: string, name: string, sourceIndex?: number) => {
    isDragging.value = true
    dragData.value = { type, name, sourceIndex }
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = sourceIndex !== undefined ? 'move' : 'copy'
      e.dataTransfer.setData('text/plain', JSON.stringify(dragData.value))
    }
  }

  const handleDragEnd = () => {
    isDragging.value = false
    dragData.value = null
    dragOverIndex.value = -1
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = dragData.value?.sourceIndex !== undefined ? 'move' : 'copy'
    }
  }

  // 设置拖拽经过的索引位置
  const setDragOverIndex = (index: number) => {
    dragOverIndex.value = index
  }

  const handleDrop = (e: DragEvent, callback: (type: string, name: string, sourceIndex?: number, targetIndex?: number) => void) => {
    e.preventDefault()
    const data = e.dataTransfer?.getData('text/plain')
    if (data) {
      try {
        const parsed = JSON.parse(data) as DragData
        callback(parsed.type, parsed.name, parsed.sourceIndex, dragOverIndex.value >= 0 ? dragOverIndex.value : undefined)
      } catch (e) {
        console.error('Failed to parse drag data')
      }
    }
    handleDragEnd()
  }

  return {
    isDragging,
    dragData,
    dragOverIndex,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
    setDragOverIndex
  }
}
