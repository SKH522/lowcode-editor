<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, h } from 'vue'
import { NButton, NInput, NCard } from 'naive-ui'
import * as echarts from 'echarts'
import { useEditorStore } from '@/stores/editor'
import type { CanvasComponent } from '@/types/editor'

const props = defineProps<{
  component: CanvasComponent
  index?: number
}>()

const store = useEditorStore()
const chartRef = ref<HTMLDivElement | null>(null)
let chartInstance: echarts.ECharts | null = null

const isSelected = computed(() => store.selectedId === props.component.id)

const handleClick = (e: MouseEvent) => {
  e.stopPropagation()
  store.selectComponent(props.component.id)
}

const styleObj = computed(() => ({
  ...props.component.styles,
  position: 'relative' as const
}))

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
    :class="{ selected: isSelected, 'has-children': component.children?.length }"
    :style="styleObj"
    @click="handleClick"
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
    <div v-if="!store.previewMode" class="drag-handle">
      ⋮⋮
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
  padding: 8px;
  margin: 4px;
  transition: all 0.15s ease;
  position: relative;
}

.renderer-wrapper:hover {
  outline: 1px dashed #ccc;
}

.renderer-wrapper.selected {
  outline: 2px solid var(--accent);
}

.selection-border {
  position: absolute;
  inset: 0;
  border: 2px solid var(--accent);
  border-radius: 4px;
  pointer-events: none;
}

.delete-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 20px;
  height: 20px;
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
  z-index: 10;
  transition: transform 0.15s;
}

.delete-btn:hover {
  transform: scale(1.1);
}

.drag-handle {
  position: absolute;
  top: 50%;
  left: -20px;
  transform: translateY(-50%);
  color: #ccc;
  font-size: 12px;
  cursor: grab;
  opacity: 0;
  transition: opacity 0.15s;
}

.renderer-wrapper:hover .drag-handle {
  opacity: 1;
}

.drag-handle:active {
  cursor: grabbing;
}

.children-container {
  display: contents;
}

.input-wrapper {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.input-label {
  font-size: 12px;
  color: #666;
}

.text-content {
  word-break: break-word;
}

.echarts-container {
  width: 100%;
  height: 300px;
}
</style>
