import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { CanvasComponent, EditorState } from '@/types/editor'
import { COMPONENT_CONFIGS } from '@/types/editor'

// 生成唯一 ID
const generateId = () => `comp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

export const useEditorStore = defineStore('editor', () => {
  // State
  const components = ref<CanvasComponent[]>([])
  const selectedId = ref<string | null>(null)
  const previewMode = ref(false)
  const zoom = ref(100)
  const dragOverIndex = ref<number>(-1) // 拖拽悬停位置

  // Getters
  const selectedComponent = computed(() => {
    if (!selectedId.value) return null
    return findComponent(components.value, selectedId.value)
  })

  const findComponent = (list: CanvasComponent[], id: string): CanvasComponent | null => {
    for (const comp of list) {
      if (comp.id === id) return comp
      if (comp.children) {
        const found = findComponent(comp.children, id)
        if (found) return found
      }
    }
    return null
  }

  // Actions
  const addComponent = (type: string, parentId?: string, insertIndex?: number) => {
    const config = COMPONENT_CONFIGS[type]
    if (!config) return

    const newComponent: CanvasComponent = {
      id: generateId(),
      name: config.name,
      props: { ...config.defaultProps },
      styles: { ...config.styles },
      children: type === 'container' || type === 'grid' ? [] : undefined
    }

    if (parentId) {
      const parent = findComponent(components.value, parentId)
      if (parent && parent.children) {
        parent.children.push(newComponent)
      }
    } else {
      // 如果指定了插入位置，插入到对应位置；否则添加到末尾
      if (insertIndex !== undefined && insertIndex >= 0 && insertIndex <= components.value.length) {
        components.value.splice(insertIndex, 0, newComponent)
      } else {
        components.value.push(newComponent)
      }
    }

    selectedId.value = newComponent.id
    return newComponent
  }

  const removeComponent = (id: string) => {
    const removeFromList = (list: CanvasComponent[]): boolean => {
      const index = list.findIndex(c => c.id === id)
      if (index !== -1) {
        list.splice(index, 1)
        return true
      }
      for (const comp of list) {
        if (comp.children && removeFromList(comp.children)) {
          return true
        }
      }
      return false
    }
    removeFromList(components.value)
    if (selectedId.value === id) {
      selectedId.value = null
    }
  }

  const selectComponent = (id: string | null) => {
    selectedId.value = id
  }

  const updateComponentProps = (id: string, props: Record<string, any>) => {
    const comp = findComponent(components.value, id)
    if (comp) {
      comp.props = { ...comp.props, ...props }
    }
  }

  const updateComponentStyles = (id: string, styles: Record<string, any>) => {
    const comp = findComponent(components.value, id)
    if (comp) {
      comp.styles = { ...comp.styles, ...styles }
    }
  }

  const togglePreview = () => {
    previewMode.value = !previewMode.value
    if (previewMode.value) {
      selectedId.value = null
    }
  }

  const setZoom = (value: number) => {
    zoom.value = Math.max(50, Math.min(150, value))
  }

  const clearAll = () => {
    components.value = []
    selectedId.value = null
  }

  // 移动组件（用于拖拽排序）
  const moveComponent = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    // 调整目标索引：如果是从前面移动到后面，toIndex 需要减 1
    let adjustedToIndex = toIndex
    if (fromIndex < toIndex) {
      adjustedToIndex = toIndex - 1
    }
    const [removed] = components.value.splice(fromIndex, 1)
    components.value.splice(adjustedToIndex, 0, removed)
  }

  // 设置拖拽悬停索引
  const setDragOverIndex = (index: number) => {
    dragOverIndex.value = index
  }

  const exportConfig = () => {
    return JSON.stringify(components.value, null, 2)
  }

  return {
    components,
    selectedId,
    previewMode,
    zoom,
    dragOverIndex,
    selectedComponent,
    addComponent,
    removeComponent,
    selectComponent,
    updateComponentProps,
    updateComponentStyles,
    togglePreview,
    setZoom,
    clearAll,
    moveComponent,
    setDragOverIndex,
    exportConfig
  }
})
