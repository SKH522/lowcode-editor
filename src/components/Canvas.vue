<script setup lang="ts">
import { computed } from 'vue'
import { NEmpty, NButton } from 'naive-ui'
import { useEditorStore } from '@/stores/editor'
import { useDrag } from '@/composables/useDrag'
import ComponentRenderer from './ComponentRenderer.vue'

const store = useEditorStore()
const { handleDragOver, handleDrop } = useDrag()

const isEmpty = computed(() => store.components.length === 0)

const onDrop = (e: DragEvent) => {
  handleDrop(e, (type) => {
    store.addComponent(type)
  })
}
</script>

<template>
  <div class="canvas-container">
    <div
      class="canvas-wrapper"
      :class="{ 'preview-mode': store.previewMode }"
      :style="{ transform: `scale(${store.zoom / 100})` }"
      @dragover="handleDragOver"
      @drop="onDrop"
    >
      <div class="canvas-inner">
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

        <!-- 渲染组件 -->
        <ComponentRenderer
          v-for="comp in store.components"
          :key="comp.id"
          :component="comp"
        />
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
    padding: 12px;
  }
  .canvas-inner {
    min-height: 400px;
  }
}
</style>
