<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NInput, NSelect, NInputNumber, NColorPicker, NSwitch, NButton, NEmpty, NDivider } from 'naive-ui'
import { useEditorStore } from '@/stores/editor'

const store = useEditorStore()

const selectedComp = computed(() => store.selectedComponent)

// 属性配置映射
const propConfigs: Record<string, Array<{ key: string; label: string; type: string; options?: any[] }>> = {
  '按钮': [
    { key: 'text', label: '按钮文字', type: 'text' },
    { key: 'type', label: '类型', type: 'select', options: [
      { label: '主要', value: 'primary' },
      { label: '默认', value: 'default' },
      { label: '成功', value: 'success' },
      { label: '警告', value: 'warning' },
      { label: '危险', value: 'danger' }
    ]}
  ],
  '输入框': [
    { key: 'label', label: '标签', type: 'text' },
    { key: 'placeholder', label: '占位符', type: 'text' }
  ],
  '文本': [
    { key: 'content', label: '文本内容', type: 'textarea' },
    { key: 'align', label: '对齐', type: 'select', options: [
      { label: '左对齐', value: 'left' },
      { label: '居中', value: 'center' },
      { label: '右对齐', value: 'right' }
    ]}
  ],
  '图片': [
    { key: 'src', label: '图片地址', type: 'text' },
    { key: 'alt', label: '替代文本', type: 'text' },
    { key: 'width', label: '宽度', type: 'text' }
  ],
  '卡片': [
    { key: 'title', label: '标题', type: 'text' },
    { key: 'content', label: '内容', type: 'textarea' }
  ],
  '容器': [
    { key: 'padding', label: '内边距', type: 'number' }
  ],
  // 图表组件属性配置
  '折线图': [
    { key: 'title', label: '图表标题', type: 'text' },
    { key: 'xData', label: 'X轴数据(逗号分隔)', type: 'textarea' },
    { key: 'yData', label: 'Y轴数据(逗号分隔)', type: 'textarea' },
    { key: 'smooth', label: '平滑曲线', type: 'switch' }
  ],
  '柱状图': [
    { key: 'title', label: '图表标题', type: 'text' },
    { key: 'xData', label: 'X轴数据(逗号分隔)', type: 'textarea' },
    { key: 'yData', label: 'Y轴数据(逗号分隔)', type: 'textarea' }
  ],
  '饼图': [
    { key: 'title', label: '图表标题', type: 'text' }
  ],
  '散点图': [
    { key: 'title', label: '图表标题', type: 'text' }
  ],
  '仪表盘': [
    { key: 'title', label: '图表标题', type: 'text' },
    { key: 'value', label: '当前值', type: 'number' },
    { key: 'max', label: '最大值', type: 'number' },
    { key: 'unit', label: '单位', type: 'text' }
  ]
}

const currentProps = computed(() => propConfigs[selectedComp.value?.name || ''] || [])

// 更新属性
const updateProp = (key: string, value: any) => {
  if (selectedComp.value) {
    store.updateComponentProps(selectedComp.value.id, { [key]: value })
  }
}

// 样式配置
const styleFields = [
  { key: 'backgroundColor', label: '背景色' },
  { key: 'color', label: '文字颜色' },
  { key: 'fontSize', label: '字号' },
  { key: 'padding', label: '内边距' },
  { key: 'margin', label: '外边距' },
  { key: 'borderRadius', label: '圆角' }
]

const updateStyle = (key: string, value: any) => {
  if (selectedComp.value) {
    store.updateComponentStyles(selectedComp.value.id, { [key]: value })
  }
}
</script>

<template>
  <div class="property-panel">
    <div class="panel-header">
      <h3>属性面板</h3>
    </div>

    <div v-if="!selectedComp" class="empty-state">
      <NEmpty description="请选择组件" size="small" />
    </div>

    <div v-else class="panel-content">
      <!-- 组件信息 -->
      <div class="section">
        <div class="section-title">
          <span class="comp-icon">{{ selectedComp.name }}</span>
          <span class="comp-id">#{{ selectedComp.id.slice(-6) }}</span>
        </div>
      </div>

      <NDivider />

      <!-- 组件属性 -->
      <div class="section">
        <h4 class="section-title">属性配置</h4>
        <div class="prop-list">
          <div v-for="field in currentProps" :key="field.key" class="prop-item">
            <label>{{ field.label }}</label>
            <NSelect
              v-if="field.type === 'select'"
              :value="selectedComp.props[field.key]"
              :options="field.options"
              size="small"
              @update:value="(val) => updateProp(field.key, val)"
            />
            <NInput
              v-else-if="field.type === 'text'"
              :value="selectedComp.props[field.key]"
              size="small"
              @update:value="(val) => updateProp(field.key, val)"
            />
            <NInput
              v-else-if="field.type === 'textarea'"
              type="textarea"
              :value="selectedComp.props[field.key]"
              size="small"
              :rows="3"
              @update:value="(val) => updateProp(field.key, val)"
            />
            <NInputNumber
              v-else-if="field.type === 'number'"
              :value="selectedComp.props[field.key]"
              size="small"
              @update:value="(val) => updateProp(field.key, val)"
            />
            <NSwitch
              v-else-if="field.type === 'switch'"
              :value="selectedComp.props[field.key]"
              @update:value="(val) => updateProp(field.key, val)"
            />
          </div>
        </div>
      </div>

      <NDivider />

      <!-- 样式配置 -->
      <div class="section">
        <h4 class="section-title">样式配置</h4>
        <div class="prop-list">
          <div v-for="field in styleFields" :key="field.key" class="prop-item">
            <label>{{ field.label }}</label>
            <NInput
              :value="selectedComp.styles[field.key]"
              size="small"
              placeholder="如: 16px"
              @update:value="(val) => updateStyle(field.key, val)"
            />
          </div>
        </div>
      </div>

      <NDivider />

      <!-- 操作按钮 -->
      <div class="section">
        <NButton type="error" block @click="store.removeComponent(selectedComp.id)">
          删除组件
        </NButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.property-panel {
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
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.section {
  margin-bottom: 8px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.comp-icon {
  font-size: 14px;
}

.comp-id {
  font-size: 10px;
  color: #666;
  font-family: monospace;
}

.prop-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.prop-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.prop-item label {
  font-size: 11px;
  color: var(--text-secondary);
}
</style>
