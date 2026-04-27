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
const isResizing = ref(false)
const dragStartPos = ref({ x: 0, y: 0 })
const componentStartPos = ref<GridPosition | null>(null)

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

  // 更新位置
  store.updateComponentPosition(props.component.id, { x: newX, y: newY })
}

// 拖拽结束
const onDragEnd = () => {
  isDraggingSelf.value = false
  componentStartPos.value = null
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
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

  switch (name) {
    case '折线图':
      option = {
        title: { text: p.title, left: 'center', textStyle: { fontSize: 14 } },
        tooltip: { trigger: 'axis' },
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
          center: ['50%', '75%'],
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
        h(NInput, {
          ...props.component.props,
          onClick: (e: MouseEvent) => e.stopPropagation()
        })
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
        width: props.component.props.width,
        style: { display: 'block' }
      })
    case '卡片':
      return h(NCard, { title: props.component.props.title }, {
        default: () => props.component.props.content
      })
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
      'has-grid': !!gridPosition
    }"
    :style="styleObj"
    @click="handleClick"
    @mousedown="onDragStart"
  >
    <!-- 选中高亮边框 -->
    <div v-if="isSelected" class="selection-border"></div>

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
  outline: 2px solid var(--accent);
}

.renderer-wrapper.is-dragging {
  opacity: 0.8;
  cursor: grabbing;
  outline: 2px dashed #e94560 !important;
  z-index: 100;
}

/* 内容区加 padding */
.renderer-wrapper > *:not(.selection-border):not(.delete-btn):not(.drag-handle):not(.dragging-indicator) {
  flex: 1;
  padding: 8px;
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
  top: -10px;
  right: -10px;
  width: 24px;
  height: 24px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  line-height: 1;
  z-index: 10;
  transition: transform 0.15s;
}

.delete-btn:hover {
  transform: scale(1.1);
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
}

.input-label {
  font-size: 12px;
  color: #666;
}

/* 文本内容 */
.text-content {
  word-break: break-word;
}

/* 图表容器 */
.echarts-container {
  width: 100%;
  height: 100%;
  min-height: 120px;
}
</style>
