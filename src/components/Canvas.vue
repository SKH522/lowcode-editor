<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { NEmpty, NButton } from 'naive-ui'
import { useEditorStore } from '@/stores/editor'
import { useDrag } from '@/composables/useDrag'
import ComponentRenderer from './ComponentRenderer.vue'
import { GRID_CONFIG, COMPONENT_CONFIGS } from '@/types/editor'
import type { GridPosition } from '@/types/editor'

const store = useEditorStore()
const { handleDragStart, handleDragEnd, handleDrop, isDragging, dragData } = useDrag()

const canvasInnerRef = ref<HTMLElement | null>(null)
const isEmpty = computed(() => store.components.length === 0)

// 网格尺寸配置
const COLS = GRID_CONFIG.COLS
const ROW_HEIGHT = GRID_CONFIG.ROW_HEIGHT
const GAP = GRID_CONFIG.GAP

// 计算画布总行数（根据内容动态扩展）
const totalRows = computed(() => {
  if (isEmpty.value) return 10
  let maxRow = 0
  for (const comp of store.components) {
    if (comp.gridPosition) {
      const bottom = comp.gridPosition.y + comp.gridPosition.height
      if (bottom > maxRow) maxRow = bottom
    }
  }
  return Math.max(maxRow + 4, 10)  // 至少10行，留点余量
})

// 生成列和行的网格线样式
const gridStyle = computed(() => ({
  '--cols': COLS,
  '--rows': totalRows.value,
  '--row-height': `${ROW_HEIGHT}px`,
  '--gap': `${GAP}px`
}))

// 画布样式
const canvasStyle = computed(() => ({
  '--cols': COLS,
  '--rows': totalRows.value,
  '--row-height': `${ROW_HEIGHT}px`,
  '--gap': `${GAP}px`
}))

// 计算组件的网格位置样式
// 使用 x+1 / x+width+1 语法确保组件边缘对齐到格子边界线，而不是格子中心
const getComponentStyle = (comp: any) => {
  if (!comp.gridPosition) return {}
  const { x, y, width, height } = comp.gridPosition
  return {
    gridColumn: `${x + 1} / ${x + width + 1}`,
    gridRow: `${y + 1} / ${y + height + 1}`
  }
}

// 从鼠标位置计算网格坐标
const getGridPositionFromMouse = (e: MouseEvent, componentWidth: number, componentHeight: number): GridPosition | null => {
  if (!canvasInnerRef.value) return null

  const rect = canvasInnerRef.value.getBoundingClientRect()
  const scrollLeft = canvasInnerRef.value.scrollLeft
  const scrollTop = canvasInnerRef.value.scrollTop

  const x = Math.floor((e.clientX - rect.left + scrollLeft) / (rect.width / COLS))
  const y = Math.floor((e.clientY - rect.top + scrollTop) / ROW_HEIGHT)

  // 边界检查
  const maxX = COLS - componentWidth
  const clampedX = Math.max(0, Math.min(x, maxX))
  const clampedY = Math.max(0, y)

  return {
    x: clampedX,
    y: clampedY,
    width: componentWidth,
    height: componentHeight
  }
}

// 拖拽悬停位置样式
const getDragOverStyle = () => {
  if (!store.dragOverPosition) return {}
  const { x, y, width, height } = store.dragOverPosition
  return {
    gridColumn: `${x + 1} / ${x + width + 1}`,
    gridRow: `${y + 1} / ${y + height + 1}`
  }
}

// 画布拖拽处理
const onCanvasDragOver = (e: DragEvent) => {
  e.preventDefault()
  if (!isDragging.value) return

  // 从拖拽数据获取组件尺寸
  const type = dragData.value?.type
  if (!type) return

  const config = COMPONENT_CONFIGS[type]
  if (!config?.gridSize) return

  const { width, height } = config.gridSize
  const position = getGridPositionFromMouse(e, width, height)

  if (position) {
    store.setDragOverPosition(position)
  }
}

// 从面板拖入放下
const onDrop = (e: DragEvent) => {
  handleDrop(e, (type) => {
    if (store.dragOverPosition) {
      // 碰撞检测：检查放置位置是否被占用
      if (!store.checkCollision(store.dragOverPosition)) {
        store.addComponent(type, undefined, store.dragOverPosition)
      } else {
        // 碰撞了，不放置
        console.warn('该位置已被占用')
      }
    } else {
      // 如果没有悬停位置，放在最后
      store.addComponent(type)
    }
    store.setDragOverPosition(null)
    store.setDraggingFromPanel(false)
  })
}

// 拖拽到画布边缘
const onCanvasDragLeave = (e: DragEvent) => {
  // 只有真正离开画布时才清除
  if (!canvasInnerRef.value?.contains(e.relatedTarget as Node)) {
    store.setDragOverPosition(null)
  }
}

// 生成网格列和行的索引
const gridIndices = computed(() => ({
  cols: Array.from({ length: COLS }, (_, i) => i),
  rows: Array.from({ length: totalRows.value }, (_, i) => i)
}))
</script>

<template>
  <div class="canvas-container">
    <div
      ref="canvasInnerRef"
      class="canvas-wrapper"
      :class="{ 'preview-mode': store.previewMode, 'is-dragging': isDragging }"
      :style="canvasStyle"
      @dragover="onCanvasDragOver"
      @drop="onDrop"
      @dragleave="onCanvasDragLeave"
    >
      <!-- 网格背景 - 使用 Grid 布局与 components-grid 完全对齐 -->
      <div class="grid-background" :style="gridStyle">
        <!-- 网格单元格 - 使用 Grid 布局 -->
        <div class="grid-cells">
          <div
            v-for="row in gridIndices.rows"
            :key="'row-' + row"
            class="grid-row"
          >
            <div
              v-for="col in gridIndices.cols"
              :key="'cell-' + row + '-' + col"
              class="grid-cell"
            />
          </div>
        </div>
      </div>

      <!-- 空状态提示 -->
      <div v-if="isEmpty && !store.previewMode" class="empty-state">
        <NEmpty description="拖拽组件到网格开始编辑">
          <template #extra>
            <NButton size="small" type="primary" @click="store.addComponent('container')">
              添加容器
            </NButton>
          </template>
        </NEmpty>
      </div>

      <!-- 组件网格容器 -->
      <div class="components-grid">
        <ComponentRenderer
          v-for="comp in store.components"
          :key="comp.id"
          :component="comp"
          :style="getComponentStyle(comp)"
          :grid-position="comp.gridPosition"
        />
      </div>

      <!-- 拖拽悬停指示器 -->
      <div
        v-if="isDragging && store.dragOverPosition"
        class="drag-over-indicator"
        :style="getDragOverStyle()"
      >
        <span class="indicator-label">
          {{ store.dragOverPosition.width }} × {{ store.dragOverPosition.height }}
        </span>
      </div>

      <!-- 拖拽到空画布的指示器 -->
      <div
        v-if="isDragging && isEmpty"
        class="empty-drop-indicator"
      >
        释放到网格上
      </div>
    </div>

    <!-- 缩放提示 -->
    <div v-if="store.zoom !== 100" class="zoom-hint">
      缩放: {{ store.zoom }}%
    </div>
  </div>
</template>

<style scoped>
.canvas-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #2d2d3a;
  overflow: hidden;
  position: relative;
}

.canvas-wrapper {
  flex: 1;
  overflow: auto;
  padding: 12px;
  transform-origin: top center;
  transition: transform 0.2s ease;
  position: relative;
  background: #1e1e2a;
}

/* 网格背景 - 使用 Grid 布局与 components-grid 完全对齐 */
.grid-background {
  position: absolute;
  inset: 12px;
  display: grid;
  grid-template-rows: repeat(var(--rows), var(--row-height));
  gap: var(--gap);
  pointer-events: none;
  z-index: 0;
}

.grid-cells {
  display: contents;
}

.grid-row {
  display: grid;
  grid-template-columns: repeat(var(--cols), 1fr);
  gap: var(--gap);
  height: var(--row-height);
}

.grid-cell {
  outline: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 2px;
  transition: background 0.15s;
}

.grid-cell:hover {
  background: rgba(255, 255, 255, 0.03);
}

/* 组件网格容器 - 使用固定行数与背景网格完全对齐 */
.components-grid {
  position: absolute;
  inset: 12px;
  display: grid;
  grid-template-columns: repeat(var(--cols), 1fr);
  grid-template-rows: repeat(var(--rows), var(--row-height));
  gap: var(--gap);
  z-index: 1;
}

/* 空状态 */
.empty-state {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  z-index: 10;
}

/* 预览模式 */
.preview-mode .grid-background {
  display: none;
}

.preview-mode .canvas-wrapper {
  background: #1a1a24;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.preview-mode .components-grid {
  position: relative;
  inset: auto;
  padding: 16px;
  background: #252532;
  border-radius: 6px;
  min-height: 100%;
}

/* 拖拽状态 */
.is-dragging {
  background: #252532;
}

.is-dragging .grid-cell {
  background: rgba(233, 69, 96, 0.08);
  border-color: rgba(233, 69, 96, 0.2);
}

/* 拖拽悬停指示器 */
.drag-over-indicator {
  position: absolute;
  background: rgba(233, 69, 96, 0.2);
  border: 2px dashed #e94560;
  border-radius: 8px;
  z-index: 50;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: indicatorPulse 0.5s ease-in-out infinite;
}

.indicator-label {
  background: #e94560;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

@keyframes indicatorPulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(0.98);
  }
}

/* 空画布拖拽提示 */
.empty-drop-indicator {
  position: absolute;
  inset: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(233, 69, 96, 0.1);
  border: 2px dashed #e94560;
  border-radius: 8px;
  color: #e94560;
  font-size: 16px;
  font-weight: 500;
  z-index: 100;
  pointer-events: none;
  animation: borderPulse 1s ease-in-out infinite;
}

@keyframes borderPulse {
  0%, 100% {
    border-color: #e94560;
    background: rgba(233, 69, 96, 0.1);
  }
  50% {
    border-color: #ff6b8a;
    background: rgba(233, 69, 96, 0.15);
  }
}

/* 缩放提示 */
.zoom-hint {
  position: absolute;
  bottom: 16px;
  right: 16px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
}

/* 响应式 */
@media (max-width: 768px) {
  .canvas-wrapper {
    padding: 8px;
  }
  .grid-background,
  .components-grid {
    inset: 8px;
  }
  .empty-drop-indicator {
    inset: 8px;
  }
}
</style>
