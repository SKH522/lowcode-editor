import mitt from 'mitt'

// 定义事件类型
export interface ComponentEvent {
  sourceId: string      // 触发事件的组件 ID
  eventName: string     // 事件名称
  eventData?: any       // 事件数据
}

export type EmitterEvents = {
  'component:event': ComponentEvent  // 组件触发事件
  'component:action': {             // 组件执行 action
    targetId: string
    action: string
    params?: any
    eventData?: any  // 源事件数据，用于动态参数替换
  }
}

const emitter = mitt<EmitterEvents>()

export const useEventBus = () => {
  // 触发组件事件
  const emitEvent = (sourceId: string, eventName: string, eventData?: any) => {
    emitter.emit('component:event', { sourceId, eventName, eventData })
  }

  // 监听组件事件
  const onEvent = (handler: (event: ComponentEvent) => void) => {
    emitter.on('component:event', handler)
    return () => emitter.off('component:event', handler)
  }

  // 触发组件 action
  const emitAction = (targetId: string, action: string, params?: any, eventData?: any) => {
    emitter.emit('component:action', { targetId, action, params, eventData })
  }

  // 监听组件 action
  const onAction = (handler: (data: { targetId: string; action: string; params?: any; eventData?: any }) => void) => {
    emitter.on('component:action', handler)
    return () => emitter.off('component:action', handler)
  }

  return {
    emitEvent,
    onEvent,
    emitAction,
    onAction
  }
}

export { emitter }
