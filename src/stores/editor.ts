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
  // 推送方向由用户拖拽方向决定，被推的组件紧贴在移动组件边缘
  const tryMoveWithPush = (
    movingId: string,
    targetPos: GridPosition
  ): { success: boolean; pushedIds: string[] } => {
    const COLS = GRID_CONFIG.COLS
    const movingComp = findComponent(components.value, movingId)

    if (!movingComp || !movingComp.gridPosition) {
      return { success: false, pushedIds: [] }
    }

    const origPos = movingComp.gridPosition
    const dx = targetPos.x - origPos.x
    const dy = targetPos.y - origPos.y

    // 确定主要推动方向
    const isHorizontal = Math.abs(dx) >= Math.abs(dy)

    // 收集需要推送的组件
    const pushes = new Map<string, GridPosition>()
    const pushedIds: string[] = []

    // 模拟位置：移动组件的目标位置 + 其他组件的当前位置
    const simPositions = new Map<string, GridPosition>()
    simPositions.set(movingId, { ...targetPos })
    for (const comp of components.value) {
      if (comp.id !== movingId && comp.gridPosition) {
        simPositions.set(comp.id, { ...comp.gridPosition })
      }
    }

    // 检查某位置是否与某组件碰撞
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

    // 收集所有与目标位置碰撞的组件
    const colliders: Array<{ id: string; pos: GridPosition; movedPos: GridPosition }> = []

    // 检查目标位置是否碰撞
    let colliderId = checkCollisionAt(targetPos, movingId)
    while (colliderId) {
      const colliderPos = simPositions.get(colliderId)!
      let newPos: GridPosition

      if (isHorizontal) {
        // 水平推动：被推组件紧贴在移动组件右边
        newPos = {
          x: targetPos.x + targetPos.width,
          y: targetPos.y,
          width: colliderPos.width,
          height: colliderPos.height
        }

        // 边界检查
        if (newPos.x < 0 || newPos.x + newPos.width > COLS) {
          return { success: false, pushedIds: [] }
        }
      } else {
        // 垂直推动：被推组件紧贴在移动组件下方
        newPos = {
          x: targetPos.x,
          y: targetPos.y + targetPos.height,
          width: colliderPos.width,
          height: colliderPos.height
        }

        // 边界检查
        if (newPos.y < 0 || newPos.x < 0 || newPos.x + newPos.width > COLS) {
          return { success: false, pushedIds: [] }
        }
      }

      // 检查被推后是否与其他组件碰撞（形成连锁）
      const nextColliderId = checkCollisionAt(newPos, colliderId)
      if (nextColliderId) {
        // 连锁碰撞，无法推送
        return { success: false, pushedIds: [] }
      }

      colliders.push({ id: colliderId, pos: colliderPos, movedPos: newPos })
      simPositions.set(colliderId, newPos)
      pushedIds.push(colliderId)

      // 继续检查目标位置是否还有碰撞
      colliderId = checkCollisionAt(targetPos, movingId)
    }

    // 执行移动
    for (const { id, movedPos } of colliders) {
      moveComponentTo(id, movedPos)
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
