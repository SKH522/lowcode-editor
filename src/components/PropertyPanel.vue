<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NInput, NSelect, NInputNumber, NColorPicker, NSwitch, NButton, NEmpty, NDivider, NModal, NCard } from 'naive-ui'
import { useEditorStore } from '@/stores/editor'
import { COMPONENT_CONFIGS } from '@/types/editor'

const store = useEditorStore()

const selectedComp = computed(() => store.selectedComponent)

// 事件绑定弹窗
const showBindingModal = ref(false)
const bindingForm = ref({
  sourceEvent: '',
  targetId: '',
  targetAction: '',
  targetParams: {} as Record<string, any>
})

// 获取当前组件支持的事件
const availableEvents = computed(() => {
  if (!selectedComp.value) return []
  const config = COMPONENT_CONFIGS[selectedComp.value.type]
  return config?.events || []
})

// 获取当前组件的绑定列表
const componentBindings = computed(() => {
  if (!selectedComp.value) return []
  return store.getComponentBindings(selectedComp.value.id)
})

// 获取可选的事件源组件
const availableSources = computed(() => {
  if (!selectedComp.value) return []
  return store.getAvailableSources(selectedComp.value.id)
})

// 获取可选的目标组件及其 actions
const availableTargets = computed(() => {
  if (!selectedComp.value) return []
  return store.getAvailableTargets(selectedComp.value.id)
})

// 获取目标组件支持的动作
const targetActions = computed(() => {
  if (!bindingForm.value.targetId) return []
  const comp = store.components.find(c => c.id === bindingForm.value.targetId)
  if (!comp) return []
  const config = COMPONENT_CONFIGS[comp.type]
  return config?.actions || []
})

// 获取当前事件可用的数据字段
const eventDataFields = computed(() => {
  if (!bindingForm.value.sourceEvent) return []
  const eventName = bindingForm.value.sourceEvent
  // input/change 事件有 value 字段
  if (eventName === 'input' || eventName === 'change') {
    return [{ key: 'value', label: '输入值', example: '{{event.value}}' }]
  }
  return []
})

// 打开添加绑定弹窗
const openBindingModal = () => {
  bindingForm.value = {
    sourceEvent: availableEvents.value[0] || '',
    targetId: '',
    targetAction: '',
    targetParams: {}
  }
  showBindingModal.value = true
}

// 添加绑定
const addBinding = () => {
  if (!selectedComp.value || !bindingForm.value.sourceEvent || !bindingForm.value.targetId || !bindingForm.value.targetAction) {
    return
  }
  store.addBinding({
    sourceId: selectedComp.value.id,
    sourceEvent: bindingForm.value.sourceEvent,
    targetId: bindingForm.value.targetId,
    targetAction: bindingForm.value.targetAction,
    targetParams: bindingForm.value.targetParams
  })
  showBindingModal.value = false
}

// 移除绑定
const removeBinding = (bindingId: string) => {
  store.removeBinding(bindingId)
}

// 获取组件的显示名称（优先使用 label）
const getDisplayName = (comp: any): string => {
  return comp.label || comp.name
}

// 获取组件的内容预览
const getContentPreview = (comp: any): string => {
  const { name, props, gridPosition } = comp
  const pos = gridPosition ? `(${gridPosition.x + 1},${gridPosition.y + 1})` : ''

  switch (name) {
    case '按钮':
      return `${pos} "${props.text || '按钮'}"`
    case '文本':
      return `${pos} "${(props.content || '文本').slice(0, 8)}"`
    case '输入框':
      return `${pos} [${props.label || '标签'}]`
    case '卡片':
      return `${pos} "${props.title || '卡片'}"`
    case '图片':
      return `${pos} 🖼️`
    case '容器':
      return `${pos} 📦`
    case '折线图':
    case '柱状图':
    case '饼图':
    case '散点图':
    case '仪表盘':
      return `${pos} ${props.title || name}`
    default:
      return `${pos} ${name}`
  }
}

// 获取目标组件名称（优先使用 label）
const getTargetName = (targetId: string) => {
  const comp = store.components.find(c => c.id === targetId)
  if (!comp) return targetId
  return `${getDisplayName(comp)} ${getContentPreview(comp)}`
}

// 获取目标组件的下拉选项
const getTargetOptions = () => {
  return store.components
    .filter(c => {
      const config = COMPONENT_CONFIGS[c.type]
      return config?.actions?.length && c.id !== selectedComp.value?.id
    })
    .map(c => ({
      label: `${getDisplayName(c)} ${getContentPreview(c)}`,
      value: c.id
    }))
}

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
        <div class="prop-item">
          <label>组件标识</label>
          <NInput
            :value="selectedComp.label"
            size="small"
            placeholder="给组件起个名字，方便选择"
            @update:value="(val) => store.updateComponentLabel(selectedComp.id, val)"
          />
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

      <!-- 事件绑定配置 -->
      <div class="section">
        <div class="section-title-row">
          <h4 class="section-title">事件绑定</h4>
          <NButton
            v-if="availableEvents.length > 0 && availableTargets.length > 0"
            size="tiny"
            type="primary"
            @click="openBindingModal"
          >
            添加绑定
          </NButton>
        </div>

        <!-- 已有绑定列表 -->
        <div v-if="componentBindings.length > 0" class="binding-list">
          <div v-for="binding in componentBindings" :key="binding.id" class="binding-item">
            <div class="binding-info">
              <span class="binding-event">{{ binding.sourceEvent }}</span>
              <span class="binding-arrow">→</span>
              <span class="binding-target">{{ getTargetName(binding.targetId) }}</span>
              <span class="binding-action">.{{ binding.targetAction }}</span>
            </div>
            <button class="binding-remove" @click="removeBinding(binding.id)">×</button>
          </div>
        </div>
        <div v-else class="binding-empty">
          <span v-if="availableEvents.length === 0">该组件无支持事件</span>
          <span v-else-if="availableTargets.length === 0">无可用目标组件</span>
          <span v-else>暂无绑定</span>
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

    <!-- 绑定弹窗 -->
    <NModal v-model:show="showBindingModal" preset="card" title="添加事件绑定" style="width: 400px">
      <div class="binding-form">
        <div class="form-item">
          <label>当组件触发</label>
          <NSelect
            v-model:value="bindingForm.sourceEvent"
            :options="availableEvents.map(e => ({ label: e, value: e }))"
            placeholder="选择事件"
          />
        </div>

        <div class="form-item">
          <label>则目标组件执行</label>
          <NSelect
            v-model:value="bindingForm.targetId"
            :options="getTargetOptions()"
            placeholder="选择目标组件"
          />
        </div>

        <div v-if="bindingForm.targetId" class="form-item">
          <label>动作</label>
          <NSelect
            v-model:value="bindingForm.targetAction"
            :options="targetActions.map(a => ({ label: a.label, value: a.name }))"
            placeholder="选择动作"
          />
        </div>

        <!-- 动作参数 -->
        <template v-if="bindingForm.targetAction && targetActions.length > 0">
          <!-- 事件数据提示 -->
          <div v-if="eventDataFields.length > 0" class="event-data-hint">
            <span class="hint-label">可用事件数据：</span>
            <code v-for="field in eventDataFields" :key="field.key">{{ field.example }}</code>
            <span class="hint-desc">- {{ eventDataFields.map(f => f.label).join('、') }}</span>
          </div>

          <div v-for="param in targetActions.find(a => a.name === bindingForm.targetAction)?.params || []" :key="param.name" class="form-item">
            <label>{{ param.label }}</label>
            <NInput
              v-if="param.type === 'string'"
              v-model:value="bindingForm.targetParams[param.name]"
              size="small"
              :placeholder="eventDataFields.length > 0 ? '{{event.value}}' : '请输入'"
            />
            <NInputNumber
              v-else-if="param.type === 'number'"
              v-model:value="bindingForm.targetParams[param.name]"
              size="small"
            />
          </div>
        </template>

        <div class="form-actions">
          <NButton @click="showBindingModal = false">取消</NButton>
          <NButton type="primary" @click="addBinding">添加</NButton>
        </div>
      </div>
    </NModal>
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

/* 事件绑定样式 */
.section-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-title-row .section-title {
  margin-bottom: 0;
}

.binding-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.binding-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  background: #f5f5f5;
  border-radius: 4px;
  font-size: 11px;
}

.binding-info {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.binding-event {
  color: #e94560;
  font-weight: 500;
}

.binding-arrow {
  color: #999;
}

.binding-target {
  color: #333;
}

.binding-action {
  color: #67c23a;
}

.binding-remove {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 16px;
  padding: 0 4px;
}

.binding-remove:hover {
  color: #e94560;
}

.binding-empty {
  color: #999;
  font-size: 12px;
  text-align: center;
  padding: 12px;
}

/* 绑定表单样式 */
.binding-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.event-data-hint {
  background: #f0f9eb;
  border: 1px solid #e1f3d8;
  border-radius: 4px;
  padding: 8px 12px;
  font-size: 11px;
  color: #606266;
}

.hint-label {
  font-weight: 500;
  margin-right: 4px;
}

.event-data-hint code {
  background: #e1f3d8;
  color: #67c23a;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: Consolas, monospace;
  font-size: 11px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-item label {
  font-size: 12px;
  color: #666;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

/* 修复按钮文字颜色 - 在暗色背景上显示清晰 */
:deep(.n-button) {
  color: #fff;
}
</style>
