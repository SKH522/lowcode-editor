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
  // 返回 { success, pushedIds } - success 表示是否成功（即使推开了组件也算成功）
  const tryMoveWithPush = (
    movingId: string,
    targetPos: GridPosition
  ): { success: boolean; pushedIds: string[] } => {
    const COLS = GRID_CONFIG.COLS

    // 记录所有组件当前占据的区域（排除正在移动的组件）
    const occupiedById = new Map<string, GridPosition>()
    for (const comp of components.value) {
      if (comp.id !== movingId && comp.gridPosition) {
        occupiedById.set(comp.id, { ...comp.gridPosition })
      }
    }

    // 检查某位置是否与任何已占用区域重叠（排除指定ID）
    const collidesWithOccupied = (pos: GridPosition, excludeId?: string): string | null => {
      for (const [id, occ] of occupiedById) {
        if (excludeId && id === excludeId) continue

        const noOverlap =
          pos.x + pos.width <= occ.x ||
          pos.x >= occ.x + occ.width ||
          pos.y + pos.height <= occ.y ||
          pos.y >= occ.y + occ.height

        if (!noOverlap) {
          return id  // 返回碰撞到的组件ID
        }
      }
      return null
    }

    // 待处理的队列: [组件ID, 期望位置]
    const queue: Array<{ id: string; pos: GridPosition }> = []
    // 记录最终移动映射
    const moves = new Map<string, GridPosition>()

    // 从移动中的组件开始
    const movingComp = findComponent(components.value, movingId)
    if (!movingComp || !movingComp.gridPosition) {
      return { success: false, pushedIds: [] }
    }
    queue.push({ id: movingId, pos: { ...targetPos } })

    // 推送失败时的标记
    let pushFailed = false

    while (queue.length > 0 && !pushFailed) {
      const { id, pos } = queue.shift()!

      // 跳过已经在 moves 中且位置不变的组件
      const existingMove = moves.get(id)
      if (existingMove && existingMove.x === pos.x && existingMove.y === pos.y) {
        continue
      }

      // 边界检查
      if (pos.x < 0 || pos.y < 0 || pos.x + pos.width > COLS || pos.y + pos.height > 999) {
        pushFailed = true
        break
      }

      // 检查位置是否冲突
      const colliderId = collidesWithOccupied(pos, existingMove ? undefined : id)

      if (!colliderId) {
        // 无冲突，记录移动
        moves.set(id, pos)
      } else {
        // 有冲突，计算推送后的新位置
        const collider = occupiedById.get(colliderId)!
        let newPos: GridPosition

        // 优先往右推
        const pushedRight: GridPosition = {
          x: pos.x + collider.width,
          y: pos.y,
          width: collider.width,
          height: collider.height
        }

        // 如果右边超出网格，则往下推（回到该行最左）
        if (pushedRight.x + collider.width > COLS) {
          newPos = {
            x: 0,
            y: pos.y + pos.height,
            width: collider.width,
            height: collider.height
          }
        } else {
          newPos = pushedRight
        }

        // 更新碰撞组件的记录位置
        occupiedById.set(colliderId, newPos)

        // 把碰撞到的组件加入队列（使用它原来的期望位置还是新位置？）
        // 用新位置，这样它自己的冲突也能被检测到
        queue.push({ id: colliderId, pos: newPos })

        // 重新处理当前组件（因为碰撞组件已经移走了）
        // 但要确保不形成无限循环：检查 moves 中是否有记录且位置变了
        const currentInMoves = moves.get(id)
        if (!currentInMoves || currentInMoves.x !== pos.x || currentInMoves.y !== pos.y) {
          queue.push({ id, pos })
        }
      }
    }

    if (pushFailed || moves.size === 0) {
      return { success: false, pushedIds: [] }
    }

    // 批量执行移动
    for (const [id, pos] of moves) {
      moveComponentTo(id, pos)
    }

    // 返回被推开的组件ID（排除移动者自身）
    const pushedIds = Array.from(moves.keys()).filter(id => id !== movingId)
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
