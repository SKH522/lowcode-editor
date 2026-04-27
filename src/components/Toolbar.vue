<script setup lang="ts">
import { NButton, NButtonGroup, NTooltip, NSpace, NIcon } from 'naive-ui'
import { useEditorStore } from '@/stores/editor'

const store = useEditorStore()

const handleExport = () => {
  const config = store.exportConfig()
  const blob = new Blob([config], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `lowcode-config-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <header class="toolbar">
    <div class="toolbar-left">
      <div class="logo">
        <span class="logo-icon">🎨</span>
        <span class="logo-text">低代码编辑器</span>
      </div>
    </div>

    <div class="toolbar-center">
      <NButtonGroup size="small">
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton :type="store.previewMode ? 'primary' : 'default'" @click="store.togglePreview">
              {{ store.previewMode ? '编辑' : '预览' }}
            </NButton>
          </template>
          {{ store.previewMode ? '返回编辑模式' : '进入预览模式' }}
        </NTooltip>
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton @click="store.clearAll">清空</NButton>
          </template>
          清空画布
        </NTooltip>
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton @click="handleExport">导出</NButton>
          </template>
          导出配置 JSON
        </NTooltip>
      </NButtonGroup>
    </div>

    <div class="toolbar-right">
      <div class="zoom-control">
        <NButton size="tiny" @click="store.setZoom(store.zoom - 10)" :disabled="store.zoom <= 50">
          -
        </NButton>
        <span class="zoom-value">{{ store.zoom }}%</span>
        <NButton size="tiny" @click="store.setZoom(store.zoom + 10)" :disabled="store.zoom >= 150">
          +
        </NButton>
      </div>
    </div>
  </header>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 16px;
  background: var(--bg-darker);
  border-bottom: 1px solid var(--border-color);
  gap: 16px;
}

.toolbar-left {
  display: flex;
  align-items: center;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 16px;
}

.logo-icon {
  font-size: 20px;
}

.toolbar-center {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.zoom-control {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-card);
  padding: 4px 8px;
  border-radius: 6px;
}

.zoom-value {
  font-size: 12px;
  min-width: 40px;
  text-align: center;
}

/* 响应式 */
@media (max-width: 600px) {
  .logo-text {
    display: none;
  }
  .toolbar {
    padding: 0 8px;
  }
}
</style>
