<script setup lang="ts">
import { NCollapse, NCollapseItem, NCard } from 'naive-ui'
import { useDrag } from '@/composables/useDrag'
import { COMPONENT_LIST } from '@/types/editor'

const { handleDragStart, handleDragEnd } = useDrag()

const categories = [
  {
    title: '基础组件',
    components: COMPONENT_LIST.filter(c => ['text', 'button', 'input', 'image'].includes(c.type))
  },
  {
    title: '容器组件',
    components: COMPONENT_LIST.filter(c => ['container', 'card', 'grid'].includes(c.type))
  },
  {
    title: '图表组件',
    components: COMPONENT_LIST.filter(c => ['lineChart', 'barChart', 'pieChart', 'scatterChart', 'gaugeChart'].includes(c.type))
  }
]
</script>

<template>
  <div class="component-panel">
    <div class="panel-header">
      <h3>组件库</h3>
    </div>
    <div class="panel-content">
      <NCollapse default-expanded-names="all" :accordion="false">
        <NCollapseItem
          v-for="category in categories"
          :key="category.title"
          :title="category.title"
          :name="category.title"
        >
          <div class="component-grid">
            <div
              v-for="comp in category.components"
              :key="comp.name"
              class="component-item"
              draggable="true"
              @dragstart="(e) => handleDragStart(e, comp.type, comp.name)"
              @dragend="handleDragEnd"
            >
              <span class="component-icon">{{ comp.icon }}</span>
              <span class="component-name">{{ comp.name }}</span>
            </div>
          </div>
        </NCollapseItem>
      </NCollapse>
    </div>
  </div>
</template>

<style scoped>
.component-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.panel-header {
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

.panel-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.component-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  padding: 8px 0;
}

.component-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 8px;
  background: var(--bg-card);
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: grab;
  transition: all 0.2s ease;
}

.component-item:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(233, 69, 96, 0.2);
}

.component-item:active {
  cursor: grabbing;
  transform: scale(0.95);
}

.component-icon {
  font-size: 24px;
}

.component-name {
  font-size: 12px;
  color: var(--text-secondary);
}

/* 响应式 - 小屏幕下改为单列 */
@media (max-width: 768px) {
  .component-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
