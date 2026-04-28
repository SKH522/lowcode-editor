import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { CanvasComponent, EditorState, GridPosition, EventBinding } from '@/types/editor'
import { COMPONENT_CONFIGS, GRID_CONFIG } from '@/types/editor'
import { useEventBus } from '@/composables/useEventBus'

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

  // 事件绑定
  const eventBindings = ref<EventBinding[]>([])
  const { emitAction, onAction } = useEventBus()

  // 初始化 action 监听
  const initActionListener = () => {
    onAction(({ targetId, action, params, eventData }) => {
      executeAction(targetId, action, params, eventData)
    })
  }

  // 解析参数中的占位符 {{event.xxx}} 为实际事件数据
  const resolveParams = (params: any, eventData: any): any => {
    if (!params) return params
    if (typeof params === 'string') {
      // 处理字符串参数中的 {{event.xxx}} 占位符
      const match = params.match(/^\{\{event\.(\w+)\}\}$/)
      if (match && eventData) {
        return eventData[match[1]]
      }
      return params
    }
    if (Array.isArray(params)) {
      return params.map(p => resolveParams(p, eventData))
    }
    if (typeof params === 'object') {
      const resolved: any = {}
      for (const key in params) {
        resolved[key] = resolveParams(params[key], eventData)
      }
      return resolved
    }
    return params
  }

  // 执行组件 action
  const executeAction = (targetId: string, action: string, params?: any, eventData?: any) => {
    const comp = findComponent(components.value, targetId)
    if (!comp) return

    // 解析参数中的占位符
    const resolvedParams = resolveParams(params, eventData)

    switch (action) {
      case 'show':
        updateComponentStyles(targetId, { ...comp.styles, display: 'block' })
        break
      case 'hide':
        updateComponentStyles(targetId, { ...comp.styles, display: 'none' })
        break
      case 'clear':
        updateComponentProps(targetId, { value: '' })
        break
      case 'focus':
        // 聚焦逻辑通过事件触发
        break
      case 'setValue':
        updateComponentProps(targetId, { value: resolvedParams?.value })
        break
      case 'setText':
        updateComponentProps(targetId, { content: resolvedParams?.content })
        break
      case 'setTitle':
        updateComponentProps(targetId, { title: resolvedParams?.title })
        break
      case 'setContent':
        updateComponentProps(targetId, { content: resolvedParams?.content })
        break
      case 'setSrc':
        updateComponentProps(targetId, { src: resolvedParams?.src })
        break
      case 'setData':
        if (resolvedParams?.xData) {
          const xData = parseData(resolvedParams.xData)
          updateComponentProps(targetId, { xData })
        }
        if (resolvedParams?.yData) {
          const yData = parseData(resolvedParams.yData)
          updateComponentProps(targetId, { yData })
        }
        if (resolvedParams?.data) {
          try {
            const data = JSON.parse(resolvedParams.data)
            updateComponentProps(targetId, { data })
          } catch (e) {
            console.error('Failed to parse data:', e)
          }
        }
        break
    }
  }

  // 解析逗号分隔的数据
  const parseData = (str: string): any[] => {
    if (!str) return []
    return str.split(',').map(s => s.trim())
  }

  // 触发事件绑定
  const triggerBindings = (sourceId: string, eventName: string, eventData?: any) => {
    const bindings = eventBindings.value.filter(b => b.sourceId === sourceId && b.sourceEvent === eventName)
    for (const binding of bindings) {
      // 传递 eventData 用于动态参数替换
      emitAction(binding.targetId, binding.targetAction, binding.targetParams, eventData)
    }
  }

  // 添加事件绑定
  const addBinding = (binding: Omit<EventBinding, 'id'>) => {
    const newBinding: EventBinding = {
      ...binding,
      id: `binding_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    }
    eventBindings.value.push(newBinding)
    return newBinding.id
  }

  // 移除事件绑定
  const removeBinding = (bindingId: string) => {
    const index = eventBindings.value.findIndex(b => b.id === bindingId)
    if (index !== -1) {
      eventBindings.value.splice(index, 1)
    }
  }

  // 获取组件的绑定列表
  const getComponentBindings = (componentId: string) => {
    return eventBindings.value.filter(b => b.sourceId === componentId)
  }

  // 获取可以作为事件源的组件列表（排除自己）
  const getAvailableSources = (excludeId?: string) => {
    return components.value.filter(c => {
      const config = COMPONENT_CONFIGS[c.type]
      if (!config?.events?.length) return false
      if (excludeId && c.id === excludeId) return false
      return true
    })
  }

  // 获取可以作为目标组件的列表
  const getAvailableTargets = (excludeId?: string) => {
    return components.value.filter(c => {
      const config = COMPONENT_CONFIGS[c.type]
      if (!config?.actions?.length) return false
      if (excludeId && c.id === excludeId) return false
      return true
    })
  }

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

    // 统计同类型组件数量，用于生成默认 label
    const sameTypeCount = components.value.filter(c => c.type === type).length + 1

    const newComponent: CanvasComponent = {
      id: generateId(),
      type,  // 存储英文类型 key
      name: config.name,
      label: `${config.name}${sameTypeCount}`,  // 默认 label 如"文本1"、"按钮2"
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
  // 推送方向与拖拽方向一致，被推组件紧贴在移动组件的移动方向一侧
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

    // 确定主要推动方向（根据 dx/dy 的符号）
    const isHorizontal = Math.abs(dx) >= Math.abs(dy)

    // 收集需要推送的组件
    const pushedIds: string[] = []
    const colliders: Array<{ id: string; movedPos: GridPosition }> = []

    // 模拟位置
    const simPositions = new Map<string, GridPosition>()
    simPositions.set(movingId, { ...targetPos })
    for (const comp of components.value) {
      if (comp.id !== movingId && comp.gridPosition) {
        simPositions.set(comp.id, { ...comp.gridPosition })
      }
    }

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
    let colliderId = checkCollisionAt(targetPos, movingId)
    while (colliderId) {
      const colliderPos = simPositions.get(colliderId)!
      let newPos: GridPosition

      if (isHorizontal) {
        // 水平推动：保持被推组件原来的 y 坐标不变，只调整 x
        if (dx > 0) {
          // 从左往右 → 被推组件放到移动组件右边
          newPos = {
            x: targetPos.x + targetPos.width,
            y: colliderPos.y,  // 保持原来的 y
            width: colliderPos.width,
            height: colliderPos.height
          }
        } else {
          // 从右往左 → 被推组件放到移动组件左边
          newPos = {
            x: targetPos.x - colliderPos.width,
            y: colliderPos.y,  // 保持原来的 y
            width: colliderPos.width,
            height: colliderPos.height
          }
        }

        // 边界检查
        if (newPos.x < 0 || newPos.x + newPos.width > COLS) {
          return { success: false, pushedIds: [] }
        }
      } else {
        // 垂直推动：保持被推组件原来的 x 坐标不变，只调整 y
        if (dy > 0) {
          // 从上往下 → 被推组件放到移动组件下方
          newPos = {
            x: colliderPos.x,  // 保持原来的 x
            y: targetPos.y + targetPos.height,
            width: colliderPos.width,
            height: colliderPos.height
          }
        } else {
          // 从下往上 → 被推组件放到移动组件上方
          newPos = {
            x: colliderPos.x,  // 保持原来的 x
            y: targetPos.y - colliderPos.height,
            width: colliderPos.width,
            height: colliderPos.height
          }
        }

        // 边界检查
        if (newPos.y < 0 || newPos.x < 0 || newPos.x + newPos.width > COLS) {
          return { success: false, pushedIds: [] }
        }
      }

      // 检查推送后是否与其他组件碰撞
      const nextColliderId = checkCollisionAt(newPos, colliderId)
      if (nextColliderId) {
        return { success: false, pushedIds: [] }
      }

      colliders.push({ id: colliderId, movedPos: newPos })
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

  // 更新组件标识
  const updateComponentLabel = (id: string, label: string) => {
    const comp = findComponent(components.value, id)
    if (comp) {
      comp.label = label
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
    return JSON.stringify({
      components: components.value,
      bindings: eventBindings.value
    }, null, 2)
  }

  // 初始化
  initActionListener()

  return {
    components,
    selectedId,
    previewMode,
    zoom,
    dragOverPosition,
    isDraggingFromPanel,
    selectedComponent,
    eventBindings,
    addComponent,
    removeComponent,
    selectComponent,
    updateComponentProps,
    updateComponentStyles,
    updateComponentLabel,
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
    exportConfig,
    triggerBindings,
    addBinding,
    removeBinding,
    getComponentBindings,
    getAvailableSources,
    getAvailableTargets
  }
})
