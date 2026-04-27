<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import { NEmpty, NButton } from 'naive-ui'
import { useEditorStore } from '@/stores/editor'
import { useDrag } from '@/composables/useDrag'
import ComponentRenderer from './ComponentRenderer.vue'

const store = useEditorStore()
const { handleDragStart, handleDragEnd, handleDrop, isDragging, dragData } = useDrag()

const isEmpty = computed(() => store.components.length === 0)
const canvasInnerRef = ref<HTMLElement | null>(null)
const componentRefs = ref<HTMLElement[]>([])

// 设置组件引用
const setComponentRef = (el: any, index: number) => {
  if (el) {
    componentRefs.value[index] = el.$el || el
  }
}

// 计算拖拽悬停位置 - 基于鼠标精确位置
const updateDragOverIndex = (e: DragEvent) => {
  if (!isDragging.value || !canvasInnerRef.value) return

  const canvasRect = canvasInnerRef.value.getBoundingClientRect()
  const mouseY = e.clientY - canvasRect.top + canvasInnerRef.value.scrollTop

  // 遍历组件找到正确的插入位置
  let insertIndex = 0

  for (let i = 0; i < store.components.length; i++) {
    const el = componentRefs.value[i]
    if (!el) {
      insertIndex = i + 1
      continue
    }

    const rect = el.getBoundingClientRect()
    const compTop = rect.top - canvasRect.top + canvasInnerRef.value.scrollTop
    const compMiddle = compTop + rect.height / 2

    if (mouseY < compMiddle) {
      // 鼠标在这个组件的上半部分
      insertIndex = i
      break
    } else {
      // 鼠标在这个组件的下半部分，继续下一个
      insertIndex = i + 1
    }
  }

  store.setDragOverIndex(insertIndex)
}

const onCanvasDragOver = (e: DragEvent) => {
  e.preventDefault()
  updateDragOverIndex(e)
}

const onDrop = (e: DragEvent) => {
  handleDrop(e, (type, name, sourceIndex) => {
    if (sourceIndex !== undefined) {
      // 画布内拖拽排序
      const toIndex = store.dragOverIndex >= 0 ? store.dragOverIndex : store.components.length
      store.moveComponent(sourceIndex, toIndex)
    } else {
      // 从面板拖入新组件
      const insertIndex = store.dragOverIndex >= 0 ? store.dragOverIndex : store.components.length
      store.addComponent(type, undefined, insertIndex)
    }
    store.setDragOverIndex(-1)
  })
}

// 组件自身拖拽开始
const onComponentDragStart = (e: DragEvent, index: number) => {
  handleDragStart(e, store.components[index].name, store.components[index].name, index)
}

// 组件拖拽结束
const onComponentDragEnd = () => {
  handleDragEnd()
  store.setDragOverIndex(-1)
}

// 判断是否应该显示某个位置的插入指示器
const shouldShowIndicator = (position: 'before' | 'after', index: number) => {
  if (!isDragging.value) return false

  const currentIndex = store.dragOverIndex
  const sourceIndex = dragData.value?.sourceIndex

  if (position === 'before') {
    // 在某个组件之前显示指示器
    // 情况1: 插入位置是 0，且当前遍历到 index 0
    // 情况2: 插入位置是 index，且不是源组件自身
    if (currentIndex === 0 && index === 0) return true
    if (currentIndex === index && currentIndex !== sourceIndex) return true
    // 情况3: 插入位置在 index-1 之后，即在 index 之前
    if (currentIndex === index && sourceIndex !== undefined && sourceIndex < index) return true
  }

  if (position === 'after') {
    // 在某个组件之后显示指示器
    // 情况1: 插入位置是最后一个 (components.length)
    if (currentIndex === store.components.length && index === store.components.length - 1) return true
    // 情况2: 插入位置是 index+1
    if (currentIndex === index + 1) return true
  }

  return false
}

// 判断组件是否被选中（作为拖拽源）
const isDraggingSource = (index: number) => {
  return dragData.value?.sourceIndex === index
}
</script>

<template>
  <div class="canvas-container">
    <div
      class="canvas-wrapper"
      :class="{ 'preview-mode': store.previewMode, 'is-dragging': isDragging }"
      :style="{ transform: `scale(${store.zoom / 100})` }"
      @dragover="onCanvasDragOver"
      @drop="onDrop"
    >
      <div ref="canvasInnerRef" class="canvas-inner">
        <!-- 空状态提示 -->
        <div v-if="isEmpty && !store.previewMode" class="empty-state">
          <NEmpty description="拖拽组件到此处开始编辑">
            <template #extra>
              <NButton size="small" type="primary" @click="store.addComponent('container')">
                添加容器
              </NButton>
            </template>
          </NEmpty>
        </div>

        <!-- 拖拽到空画布的指示器 -->
        <div
          v-if="isDragging && isEmpty"
          class="empty-drop-indicator"
        >
          释放在此处
        </div>

        <!-- 渲染组件列表 -->
        <template v-for="(comp, index) in store.components" :key="comp.id">
          <!-- 组件上方的插入指示器 -->
          <div
            v-if="isDragging && store.dragOverIndex === index"
            class="insert-indicator"
          ></div>

          <ComponentRenderer
            :ref="(el) => setComponentRef(el, index)"
            :component="comp"
            :index="index"
            :class="{ 'is-dragging-source': isDraggingSource(index) }"
            :draggable="!store.previewMode"
            @dragstart="(e: DragEvent) => onComponentDragStart(e, index)"
            @dragend="onComponentDragEnd"
          />

          <!-- 如果是最后一个组件，且拖拽到末尾 -->
          <div
            v-if="isDragging && index === store.components.length - 1 && store.dragOverIndex === store.components.length"
            class="insert-indicator"
          ></div>
        </template>

        <!-- 当 dragOverIndex 为 0 但列表为空时不显示，放在空状态处理了 -->

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
  display: flex;
  justify-content: center;
  padding: 24px;
  transform-origin: top center;
  transition: transform 0.2s ease;
}

.canvas-inner {
  width: 100%;
  max-width: 800px;
  min-height: 600px;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  position: relative;
  overflow: hidden;
}

.empty-state {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.preview-mode .canvas-inner {
  max-width: none;
  border-radius: 0;
  box-shadow: none;
}

.is-dragging {
  background: #3d3d4a;
}

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

/* 拖拽指示器样式 */
.insert-indicator {
  height: 4px;
  background: linear-gradient(90deg, #e94560, #ff6b8a);
  border-radius: 2px;
  margin: 4px 8px;
  animation: insertPulse 0.5s ease-in-out infinite;
  box-shadow: 0 0 12px rgba(233, 69, 96, 0.6);
  position: relative;
  z-index: 100;
}

@keyframes insertPulse {
  0%, 100% {
    opacity: 1;
    transform: scaleX(1);
  }
  50% {
    opacity: 0.7;
    transform: scaleX(0.98);
  }
}

.empty-drop-indicator {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(233, 69, 96, 0.1);
  border: 2px dashed #e94560;
  border-radius: 8px;
  color: #e94560;
  font-size: 16px;
  font-weight: 500;
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

/* 被拖拽的源组件样式 */
.is-dragging-source {
  opacity: 0.4;
  outline: 2px dashed #e94560 !important;
}

/* 响应式 */
@media (max-width: 768px) {
  .canvas-wrapper {
    padding: 12px;
  }
  .canvas-inner {
    min-height: 400px;
  }
}
</style>
