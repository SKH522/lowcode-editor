<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, h } from 'vue'
import { NButton, NInput, NCard } from 'naive-ui'
import * as echarts from 'echarts'
import { useEditorStore } from '@/stores/editor'
import type { CanvasComponent, GridPosition } from '@/types/editor'
import { GRID_CONFIG } from '@/types/editor'

const props = defineProps<{
  component: CanvasComponent
  gridPosition?: GridPosition
}>()

const store = useEditorStore()
const chartRef = ref<HTMLDivElement | null>(null)
let chartInstance: echarts.ECharts | null = null

const isSelected = computed(() => store.selectedId === props.component.id)

// 拖拽状态
const isDraggingSelf = ref(false)
const isPushing = ref(false)  // 是否在推开其他组件
const dragStartPos = ref({ x: 0, y: 0 })
const componentStartPos = ref<GridPosition | null>(null)

// Resize 状态
const isResizing = ref(false)
const resizeDirection = ref<'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null>(null)
const resizeStartPos = ref({ x: 0, y: 0 })
const resizeStartSize = ref({ width: 0, height: 0, x: 0, y: 0 })

// 边缘检测状态
const resizeEdge = ref<'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null>(null)
const EDGE_THRESHOLD = 8  // 边缘检测阈值（像素）

// 处理点击
const handleClick = (e: MouseEvent) => {
  e.stopPropagation()
  store.selectComponent(props.component.id)
}

// 组件样式
const styleObj = computed(() => ({
  ...props.component.styles
}))

// 网格位置信息
const positionInfo = computed(() => {
  if (!props.gridPosition) return null
  const { x, y, width, height } = props.gridPosition
  return {
    gridArea: `${y + 1} / ${x + 1} / span ${height} / span ${width}`,
    label: `(${x + 1}, ${y + 1}) ${width}×${height}`
  }
})

// 开始拖拽移动
const onDragStart = (e: MouseEvent) => {
  if (store.previewMode) return
  e.stopPropagation()

  // 如果在边缘，启动 resize 而不是拖拽
  if (resizeEdge.value && isSelected.value) {
    onEdgeResizeStart(e)
    return
  }

  isDraggingSelf.value = true
  dragStartPos.value = { x: e.clientX, y: e.clientY }
  componentStartPos.value = props.gridPosition ? { ...props.gridPosition } : null

  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
}

  // 拖拽移动中
const onDragMove = (e: MouseEvent) => {
  if (!isDraggingSelf.value || !componentStartPos.value) return

  const COLS = GRID_CONFIG.COLS
  const ROW_HEIGHT = GRID_CONFIG.ROW_HEIGHT

  // 计算鼠标偏移量对应的网格偏移
  const canvasEl = document.querySelector('.components-grid')
  if (!canvasEl) return

  const rect = canvasEl.getBoundingClientRect()
  const cellWidth = rect.width / COLS

  const deltaX = e.clientX - dragStartPos.value.x
  const deltaY = e.clientY - dragStartPos.value.y

  const gridDeltaX = Math.round(deltaX / cellWidth)
  const gridDeltaY = Math.round(deltaY / ROW_HEIGHT)

  // 计算新位置
  let newX = componentStartPos.value.x + gridDeltaX
  let newY = componentStartPos.value.y + gridDeltaY

  // 边界检查
  newX = Math.max(0, Math.min(newX, COLS - componentStartPos.value.width))
  newY = Math.max(0, newY)

  const newPosition = {
    x: newX,
    y: newY,
    width: componentStartPos.value.width,
    height: componentStartPos.value.height
  }

  // 先检查是否有碰撞，有则尝试推开
  const hasCollision = store.checkCollision(newPosition, props.component.id)

  if (hasCollision) {
    // 尝试推开其他组件
    const result = store.tryMoveWithPush(props.component.id, newPosition)
    isPushing.value = result.pushedIds.length > 0

    // 即使推送成功，拖拽组件本身的位置也由 tryMoveWithPush 处理
    if (!result.success) {
      // 推送失败，不移动
      isPushing.value = false
    }
  } else {
    // 无碰撞，直接移动
    isPushing.value = false
    store.updateComponentPosition(props.component.id, { x: newX, y: newY })
  }
}

// 拖拽结束
const onDragEnd = () => {
  isDraggingSelf.value = false
  isPushing.value = false
  componentStartPos.value = null
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
}

// ============ Resize 处理 ============

const onResizeStart = (e: MouseEvent, direction: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw') => {
  if (store.previewMode || !props.gridPosition) return
  e.stopPropagation()
  e.preventDefault()

  isResizing.value = true
  resizeDirection.value = direction
  resizeStartPos.value = { x: e.clientX, y: e.clientY }
  resizeStartSize.value = {
    width: props.gridPosition.width,
    height: props.gridPosition.height,
    x: props.gridPosition.x,
    y: props.gridPosition.y
  }

  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', onResizeEnd)
}

// 开始边缘拖拽 resize
const onEdgeResizeStart = (e: MouseEvent) => {
  if (!resizeEdge.value) return
  onResizeStart(e, resizeEdge.value)
}

const onResizeMove = (e: MouseEvent) => {
  if (!isResizing.value || !props.gridPosition || !resizeDirection.value) return

  const COLS = GRID_CONFIG.COLS
  const ROW_HEIGHT = GRID_CONFIG.ROW_HEIGHT

  const canvasEl = document.querySelector('.components-grid')
  if (!canvasEl) return

  const rect = canvasEl.getBoundingClientRect()
  const cellWidth = rect.width / COLS

  const deltaX = e.clientX - resizeStartPos.value.x
  const deltaY = e.clientY - resizeStartPos.value.y

  const gridDeltaX = Math.round(deltaX / cellWidth)
  const gridDeltaY = Math.round(deltaY / ROW_HEIGHT)

  const start = resizeStartSize.value
  let newX = start.x
  let newY = start.y
  let newWidth = start.width
  let newHeight = start.height

  const dir = resizeDirection.value

  // 根据方向调整尺寸
  if (dir.includes('e')) {
    // 右边：增加宽度
    newWidth = Math.max(1, start.width + gridDeltaX)
  }
  if (dir.includes('w')) {
    // 左边：减少宽度，移动 x
    const widthChange = Math.min(gridDeltaX, start.width - 1)
    newWidth = start.width - widthChange
    newX = start.x + widthChange
  }
  if (dir.includes('s')) {
    // 下边：增加高度
    newHeight = Math.max(1, start.height + gridDeltaY)
  }
  if (dir.includes('n')) {
    // 上边：减少高度，移动 y
    const heightChange = Math.min(gridDeltaY, start.height - 1)
    newHeight = start.height - heightChange
    newY = start.y + heightChange
  }

  // 边界检查
  newX = Math.max(0, newX)
  newY = Math.max(0, newY)
  newWidth = Math.min(newWidth, COLS - newX)
  newHeight = Math.max(1, newHeight)

  // 检查碰撞
  const newPos = { x: newX, y: newY, width: newWidth, height: newHeight }
  if (!store.checkCollision(newPos, props.component.id)) {
    store.updateComponentPosition(props.component.id, { x: newX, y: newY, width: newWidth, height: newHeight })

    // 图表组件 resize 时同步缩放图表
    if (chartInstance && ['折线图', '柱状图', '饼图', '散点图', '仪表盘'].includes(props.component.name)) {
      requestAnimationFrame(() => {
        chartInstance?.resize()
      })
    }
  }
}

const onResizeEnd = () => {
  isResizing.value = false
  resizeDirection.value = null
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
}

// 边缘检测
const onMouseMove = (e: MouseEvent) => {
  if (store.previewMode || !isSelected.value || isResizing.value) return

  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const w = rect.width
  const h = rect.height

  let edge: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null = null

  // 检测角落
  if (x < EDGE_THRESHOLD && y < EDGE_THRESHOLD) edge = 'nw'
  else if (x > w - EDGE_THRESHOLD && y < EDGE_THRESHOLD) edge = 'ne'
  else if (x < EDGE_THRESHOLD && y > h - EDGE_THRESHOLD) edge = 'sw'
  else if (x > w - EDGE_THRESHOLD && y > h - EDGE_THRESHOLD) edge = 'se'
  // 检测边缘
  else if (y < EDGE_THRESHOLD) edge = 'n'
  else if (y > h - EDGE_THRESHOLD) edge = 's'
  else if (x < EDGE_THRESHOLD) edge = 'w'
  else if (x > w - EDGE_THRESHOLD) edge = 'e'

  resizeEdge.value = edge
}

const onMouseLeave = () => {
  if (!isResizing.value) {
    resizeEdge.value = null
  }
}

// 初始化图表
const initChart = () => {
  if (!chartRef.value) return

  if (chartInstance) {
    chartInstance.dispose()
  }

  chartInstance = echarts.init(chartRef.value)
  updateChart()
}

// 更新图表配置
const updateChart = () => {
  if (!chartInstance) return

  const { name, props: p } = props.component
  let option: echarts.EChartsOption = {}

  // 图表网格配置 - 让内容贴边
  const gridConfig = { top: 20, left: 20, right: 20, bottom: 20, containLabel: true }

  switch (name) {
    case '折线图':
      option = {
        title: { text: p.title, left: 'center', textStyle: { fontSize: 14 } },
        tooltip: { trigger: 'axis' },
        grid: gridConfig,
        xAxis: { type: 'category', data: p.xData },
        yAxis: { type: 'value' },
        series: [{
          data: p.yData,
          type: 'line',
          smooth: p.smooth,
          areaStyle: { opacity: 0.2 }
        }]
      }
      break

    case '柱状图':
      option = {
        title: { text: p.title, left: 'center', textStyle: { fontSize: 14 } },
        tooltip: { trigger: 'axis' },
        grid: gridConfig,
        xAxis: { type: 'category', data: p.xData },
        yAxis: { type: 'value' },
        series: [{
          data: p.yData,
          type: 'bar',
          itemStyle: { color: '#e94560' }
        }]
      }
      break

    case '饼图':
      option = {
        title: { text: p.title, left: 'center', textStyle: { fontSize: 14 } },
        tooltip: { trigger: 'item' },
        series: [{
          type: 'pie',
          radius: '60%',
          center: ['50%', '50%'],
          data: p.data,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }]
      }
      break

    case '散点图':
      option = {
        title: { text: p.title, left: 'center', textStyle: { fontSize: 14 } },
        tooltip: { trigger: 'item' },
        grid: gridConfig,
        xAxis: { type: 'value', scale: true },
        yAxis: { type: 'value', scale: true },
        series: [{
          data: p.data,
          type: 'scatter',
          symbolSize: 12,
          itemStyle: { color: '#e94560' }
        }]
      }
      break

    case '仪表盘':
      option = {
        title: { text: p.title, left: 'center', textStyle: { fontSize: 14 } },
        series: [{
          type: 'gauge',
          startAngle: 180,
          endAngle: 0,
          center: ['50%', '60%'],
          radius: '90%',
          min: 0,
          max: p.max || 100,
          splitNumber: 8,
          axisLine: {
            lineStyle: {
              width: 6,
              color: [
                [0.3, '#67c23a'],
                [0.7, '#e6a23c'],
                [1, '#f56c6c']
              ]
            }
          },
          pointer: { icon: 'circle', length: '60%', width: 6 },
          axisTick: { length: 6 },
          splitLine: { length: 10 },
          axisLabel: { show: false },
          detail: {
            formatter: `{value}${p.unit || ''}`,
            fontSize: 24,
            offsetCenter: [0, 0]
          },
          data: [{ value: p.value }]
        }]
      }
      break
  }

  chartInstance.setOption(option)
}

// 监听组件属性变化
watch(
  () => props.component.props,
  () => {
    if (chartInstance) {
      updateChart()
    }
  },
  { deep: true }
)

// 监听预览模式变化
watch(
  () => store.previewMode,
  () => {
    if (chartInstance) {
      if (store.previewMode) {
        chartInstance.resize()
      }
    }
  }
)

onMounted(() => {
  initChart()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (chartInstance) {
    chartInstance.dispose()
  }
})

const handleResize = () => {
  chartInstance?.resize()
}

// 渲染组件内容
const renderContent = () => {
  switch (props.component.name) {
    case '按钮':
      return h(NButton, props.component.props, () => props.component.props.text)
    case '输入框':
      return h('div', { class: 'input-wrapper' }, [
        props.component.props.label && h('label', { class: 'input-label' }, props.component.props.label),
        h('div', { class: 'input-inner' }, [
          h(NInput, {
            ...props.component.props,
            onClick: (e: MouseEvent) => e.stopPropagation()
          })
        ])
      ])
    case '文本':
      return h('div', {
        style: { textAlign: props.component.props.align },
        class: 'text-content'
      }, props.component.props.content)
    case '图片':
      return h('img', {
        src: props.component.props.src,
        alt: props.component.props.alt,
        style: {
          display: 'block',
          maxWidth: '100%',
          height: 'auto'
        }
      })
    case '卡片':
      return h('div', { class: 'card-wrapper' }, [
        h(NCard, { title: props.component.props.title }, {
          default: () => props.component.props.content
        })
      ])
    // ECharts 图表组件
    case '折线图':
    case '柱状图':
    case '饼图':
    case '散点图':
    case '仪表盘':
      return h('div', {
        ref: chartRef,
        class: 'echarts-container'
      })
    default:
      return null
  }
}
</script>

<template>
  <div
    class="renderer-wrapper"
    :class="{
      selected: isSelected,
      'is-dragging': isDraggingSelf,
      'is-resizing': isResizing,
      'has-grid': !!gridPosition,
      'is-pushing': isPushing,
      'resize-n': resizeEdge === 'n',
      'resize-s': resizeEdge === 's',
      'resize-e': resizeEdge === 'e',
      'resize-w': resizeEdge === 'w',
      'resize-nw': resizeEdge === 'nw',
      'resize-ne': resizeEdge === 'ne',
      'resize-sw': resizeEdge === 'sw',
      'resize-se': resizeEdge === 'se'
    }"
    :style="styleObj"
    @click="handleClick"
    @mousedown="onDragStart"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
  >
    <!-- 四角 L 形线条 -->
    <template v-if="isSelected && !store.previewMode && gridPosition">
      <div class="corner-line corner-tl"></div>
      <div class="corner-line corner-tr"></div>
      <div class="corner-line corner-bl"></div>
      <div class="corner-line corner-br"></div>
    </template>

    <!-- 删除按钮 -->
    <button
      v-if="isSelected && !store.previewMode"
      class="delete-btn"
      @click.stop="store.removeComponent(component.id)"
    >
      ✕
    </button>

    <!-- 拖拽手柄提示 -->
    <div v-if="!store.previewMode && gridPosition" class="drag-handle">
      <span class="handle-icon">⋮⋮</span>
      <span class="position-label">{{ gridPosition.x + 1 }}, {{ gridPosition.y + 1 }}</span>
    </div>

    <!-- 拖拽时显示尺寸 -->
    <div v-if="isDraggingSelf && gridPosition" class="dragging-indicator">
      {{ gridPosition.width }} × {{ gridPosition.height }}
    </div>

    <!-- 渲染内容 -->
    <component :is="renderContent" />

    <!-- 子组件插槽 -->
    <div v-if="component.children?.length" class="children-container">
      <ComponentRenderer
        v-for="child in component.children"
        :key="child.id"
        :component="child"
      />
    </div>
  </div>
</template>

<style scoped>
.renderer-wrapper {
  /* 不设置 padding，让组件边框完全贴合网格单元格 */
  transition: all 0.15s ease;
  position: relative;
  cursor: grab;
  overflow: visible;  /* 允许边框元素超出 */
  display: flex;
  align-items: stretch;
}

.renderer-wrapper:hover {
  outline: 1px dashed #ccc;
}

.renderer-wrapper.selected {
  outline: 2px dashed var(--accent);
  outline-offset: 2px;
}

.renderer-wrapper.is-dragging {
  opacity: 0.8;
  cursor: grabbing;
  outline: 2px dashed #e94560 !important;
  z-index: 100;
}

.renderer-wrapper.is-resizing {
  cursor: default;
  user-select: none;
}

/* 推开状态 - 橙色边框提示 */
.renderer-wrapper.is-pushing {
  outline: 2px dashed #ff9500 !important;
  background: rgba(255, 149, 0, 0.1);
}

/* 内容区加 padding，但图表容器例外 */
.renderer-wrapper > *:not(.selection-border):not(.delete-btn):not(.drag-handle):not(.dragging-indicator):not(.echarts-container) {
  flex: 1;
  padding: 8px;
}

/* 图表容器填满整个空间 */
.renderer-wrapper > .echarts-container {
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;  /* 重要：允许flex item收缩 */
}

/* 选中边框 - 叠加在组件上层 */
.selection-border {
  position: absolute;
  inset: 0;
  border: 2px solid var(--accent);
  pointer-events: none;
  z-index: 2;
}

/* 删除按钮 */
.delete-btn {
  position: absolute;
  top: -12px;
  right: -12px;
  width: 22px;
  height: 22px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  line-height: 1;
  z-index: 30;
  transition: transform 0.15s;
}

.delete-btn:hover {
  transform: scale(1.1);
}

/* 边缘 resize 光标 */
.renderer-wrapper.resize-nw,
.renderer-wrapper.resize-ne,
.renderer-wrapper.resize-sw,
.renderer-wrapper.resize-se {
  cursor: nwse-resize;
}

.renderer-wrapper.resize-n,
.renderer-wrapper.resize-s {
  cursor: ns-resize;
}

.renderer-wrapper.resize-e,
.renderer-wrapper.resize-w {
  cursor: ew-resize;
}

/* 四角 L 形线条 */
.corner-line {
  position: absolute;
  width: 12px;
  height: 12px;
  pointer-events: none;
  z-index: 3;
}

.corner-tl {
  top: -1px;
  left: -1px;
  border-top: 2px solid var(--accent);
  border-left: 2px solid var(--accent);
}

.corner-tr {
  top: -1px;
  right: -1px;
  border-top: 2px solid var(--accent);
  border-right: 2px solid var(--accent);
}

.corner-bl {
  bottom: -1px;
  left: -1px;
  border-bottom: 2px solid var(--accent);
  border-left: 2px solid var(--accent);
}

.corner-br {
  bottom: -1px;
  right: -1px;
  border-bottom: 2px solid var(--accent);
  border-right: 2px solid var(--accent);
}

/* 拖拽手柄 */
.drag-handle {
  position: absolute;
  top: 50%;
  left: -24px;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  color: #999;
  font-size: 10px;
  opacity: 0;
  transition: opacity 0.15s;
  pointer-events: none;
  z-index: 5;
}

.renderer-wrapper:hover .drag-handle {
  opacity: 1;
}

.handle-icon {
  font-size: 14px;
  letter-spacing: -2px;
}

.position-label {
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  white-space: nowrap;
}

/* 拖拽指示器 */
.dragging-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #e94560;
  color: white;
  padding: 6px 14px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  z-index: 101;
  pointer-events: none;
  box-shadow: 0 4px 16px rgba(233, 69, 96, 0.5);
}

/* 子组件容器 */
.children-container {
  display: contents;
}

/* 输入框 */
.input-wrapper {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
  width: 100%;
  overflow: hidden;
}

.input-inner {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.input-inner :deep(.n-input) {
  width: 100%;
  min-width: 0;
}

.input-inner :deep(.n-input-wrapper) {
  width: 100%;
  min-width: 0;
}

.input-label {
  font-size: 12px;
  color: #666;
  flex-shrink: 0;
}

/* 文本内容 */
.text-content {
  word-break: break-word;
  flex: 1;
  min-width: 0;
  width: 100%;
  overflow: hidden;
}

/* 卡片容器 */
.card-wrapper {
  flex: 1;
  min-width: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.card-wrapper :deep(.n-card) {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.card-wrapper :deep(.n-card__content) {
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.card-wrapper :deep(.n-card__content-inner) {
  overflow: hidden;
  word-break: break-word;
}

/* 图表容器 */
.echarts-container {
  width: 100%;
  height: 100%;
  min-height: 120px;
}
</style>
