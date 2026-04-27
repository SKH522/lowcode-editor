import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { CanvasComponent, EditorState, GridPosition } from '@/types/editor'
import { COMPONENT_CONFIGS, GRID_CONFIG } from '@/types/editor'

// 生成唯一 ID
const generateId = () => `comp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

export const useEditorStore = defineStore('editor', () => {
  // State
  const components = ref<CanvasComponent[]>([])
  const selectedId = ref<string | null>(null)
  const previewMode = ref(false)
  const zoom = ref(100)
  // 网格拖拽相关状态
  const dragOverPosition = ref<GridPosition | null>(null)  // 拖拽悬停的网格位置
  const isDraggingFromPanel = ref(false)  // 是否从面板拖入

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
  const addComponent = (type: string, parentId?: string, gridPosition?: GridPosition) => {
    const config = COMPONENT_CONFIGS[type]
    if (!config) return

    const newComponent: CanvasComponent = {
      id: generateId(),
      name: config.name,
      props: { ...config.defaultProps },
      styles: { ...config.styles },
      children: type === 'container' || type === 'grid' ? [] : undefined,
      // 使用传入的网格位置或默认网格尺寸
      gridPosition: gridPosition || {
        x: 0,
        y: getMaxGridY(),
        width: config.gridSize?.width || 4,
        height: config.gridSize?.height || 2
      }
    }

    if (parentId) {
      const parent = findComponent(components.value, parentId)
      if (parent && parent.children) {
        parent.children.push(newComponent)
      }
    } else {
      components.value.push(newComponent)
    }

    selectedId.value = newComponent.id
    return newComponent
  }

  // 获取当前最大 Y 值，用于新组件的默认 Y 位置
  const getMaxGridY = (): number => {
    if (components.value.length === 0) return 0
    let maxY = 0
    for (const comp of components.value) {
      if (comp.gridPosition) {
        const bottom = comp.gridPosition.y + comp.gridPosition.height
        if (bottom > maxY) maxY = bottom
      }
    }
    return maxY
  }

  // 碰撞检测：检查给定位置是否与现有组件重叠
  // excludeId - 拖拽中的组件自身 ID，应该排除它自己的当前位置
  const checkCollision = (gridPosition: GridPosition, excludeId?: string): boolean => {
    const { x, y, width, height } = gridPosition

    for (const comp of components.value) {
      // 排除自己
      if (excludeId && comp.id === excludeId) continue

      if (comp.gridPosition) {
        const compX = comp.gridPosition.x
        const compY = comp.gridPosition.y
        const compW = comp.gridPosition.width
        const compH = comp.gridPosition.height

        // 检测两个矩形是否重叠
        // 不重叠的条件：完全在左边 | 完全在右边 | 完全在上边 | 完全在下边
        const noOverlap =
          x + width <= compX ||      // A 在 B 左边
          x >= compX + compW ||      // A 在 B 右边
          y + height <= compY ||    // A 在 B 上边
          y >= compY + compH        // A 在 B 下边

        // 如果不是完全不重叠，则说明有碰撞
        if (!noOverlap) {
          return true
        }
      }
    }
    return false
  }

  // 尝试将组件移动到目标位置，如果遇到碰撞则推开其他组件
  // 推开方向由拖拽组件的移动方向决定，只沿一个方向推开
  const tryMoveWithPush = (
    movingId: string,
    targetPos: GridPosition
  ): { success: boolean; pushedIds: string[] } => {
    const COLS = GRID_CONFIG.COLS
    const movingComp = findComponent(components.value, movingId)

    if (!movingComp || !movingComp.gridPosition) {
      return { success: false, pushedIds: [] }
    }

    // 计算移动方向
    const origPos = movingComp.gridPosition
    const dx = targetPos.x - origPos.x
    const dy = targetPos.y - origPos.y

    // 确定主要推动方向：水平为主还是垂直为主
    const isHorizontal = Math.abs(dx) >= Math.abs(dy)

    // 收集所有需要推送的组件及其推送位置
    const pushes = new Map<string, GridPosition>()  // id -> 推送后的位置
    const pushedIds: string[] = []

    // 复制一份当前组件位置用于模拟
    const simPositions = new Map<string, GridPosition>()
    simPositions.set(movingId, { ...targetPos })

    // 先把其他组件的位置记录下来
    for (const comp of components.value) {
      if (comp.id !== movingId && comp.gridPosition) {
        simPositions.set(comp.id, { ...comp.gridPosition })
      }
    }

    // 检查目标位置是否碰撞
    const checkCollisionAt = (pos: GridPosition, excludeId?: string) => {
      for (const [id, otherPos] of simPositions) {
        if (excludeId && id === excludeId) continue

        const noOverlap =
          pos.x + pos.width <= otherPos.x ||
          pos.x >= otherPos.x + otherPos.width ||
          pos.y + pos.height <= otherPos.y ||
          pos.y >= otherPos.y + otherPos.height

        if (!noOverlap) {
          return id
        }
      }
      return null
    }

    // 如果目标位置有碰撞，计算推送
    let colliderId = checkCollisionAt(targetPos, movingId)

    while (colliderId) {
      const colliderPos = simPositions.get(colliderId)!
      let newPos: GridPosition

      if (isHorizontal) {
        // 水平推动：往右推
        newPos = {
          x: colliderPos.x + targetPos.width,
          y: colliderPos.y,
          width: colliderPos.width,
          height: colliderPos.height
        }
      } else {
        // 垂直推动：往下推
        newPos = {
          x: colliderPos.x,
          y: colliderPos.y + targetPos.height,
          width: colliderPos.width,
          height: colliderPos.height
        }
      }

      // 检查推送后是否超出边界
      if (newPos.x < 0 || newPos.y < 0 || newPos.x + newPos.width > COLS) {
        // 撞到边界，无法推送
        return { success: false, pushedIds: [] }
      }

      // 检查推送后的位置是否与其他组件碰撞
      const nextColliderId = checkCollisionAt(newPos, colliderId)

      // 如果会撞到另一个组件（不是正在移动的组件），则无法推送
      if (nextColliderId && nextColliderId !== movingId) {
        return { success: false, pushedIds: [] }
      }

      // 记录推送
      pushes.set(colliderId, newPos)
      simPositions.set(colliderId, newPos)
      pushedIds.push(colliderId)

      // 继续检查目标位置是否还有碰撞（可能被推开的组件又撞回原位）
      colliderId = checkCollisionAt(targetPos, movingId)
    }

    // 执行移动
    for (const [id, pos] of pushes) {
      moveComponentTo(id, pos)
    }
    moveComponentTo(movingId, targetPos)

    return { success: true, pushedIds }
  }

  // 移动组件到指定网格位置
  const moveComponentTo = (id: string, gridPosition: GridPosition) => {
    const comp = findComponent(components.value, id)
    if (comp) {
      comp.gridPosition = { ...gridPosition }
    }
  }

  // 更新组件网格位置
  const updateComponentPosition = (id: string, updates: Partial<GridPosition>) => {
    const comp = findComponent(components.value, id)
    if (comp && comp.gridPosition) {
      comp.gridPosition = { ...comp.gridPosition, ...updates }
    }
  }

  // 清除组件网格位置
  const clearComponentPosition = (id: string) => {
    const comp = findComponent(components.value, id)
    if (comp) {
      comp.gridPosition = undefined
    }
  }

  // 设置拖拽悬停位置
  const setDragOverPosition = (position: GridPosition | null) => {
    dragOverPosition.value = position
  }

  // 设置是否从面板拖入
  const setDraggingFromPanel = (value: boolean) => {
    isDraggingFromPanel.value = value
  }

  // 清空画布
  const clearAll = () => {
    components.value = []
    selectedId.value = null
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

  const exportConfig = () => {
    return JSON.stringify(components.value, null, 2)
  }

  return {
    components,
    selectedId,
    previewMode,
    zoom,
    dragOverPosition,
    isDraggingFromPanel,
    selectedComponent,
    addComponent,
    removeComponent,
    selectComponent,
    updateComponentProps,
    updateComponentStyles,
    togglePreview,
    setZoom,
    clearAll,
    moveComponentTo,
    updateComponentPosition,
    clearComponentPosition,
    setDragOverPosition,
    setDraggingFromPanel,
    getMaxGridY,
    checkCollision,
    tryMoveWithPush,
    exportConfig
  }
})
