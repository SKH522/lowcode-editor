// 编辑器组件类型定义

export interface ComponentSchema {
  id: string
  name: string
  icon: string
  props: Record<string, any>
  children?: ComponentSchema[]
}

export interface ComponentConfig {
  name: string
  icon: string
  defaultProps: Record<string, any>
  styles?: Record<string, string>
  gridSize?: { width: number; height: number }  // 网格尺寸
}

// 网格位置信息
export interface GridPosition {
  x: number        // 起始列 (0-11)
  y: number        // 起始行
  width: number    // 占据列数 (1-12)
  height: number   // 占据行数
}

// 画布组件类型定义
export interface CanvasComponent {
  id: string
  name: string
  props: Record<string, any>
  styles: Record<string, string>
  children?: CanvasComponent[]
  gridPosition?: GridPosition  // 网格位置
}

// 网格系统常量
export const GRID_CONFIG = {
  COLS: 12,           // 12列栅格
  ROW_HEIGHT: 40,     // 每行高度 40px
  GAP: 8,             // 组件间距
  MIN_HEIGHT: 2,      // 最小高度（行）
}

export interface EditorState {
  components: CanvasComponent[]
  selectedId: string | null
  previewMode: boolean
  zoom: number
}

// 可用组件配置（增加 gridSize 网格尺寸）
export const COMPONENT_CONFIGS: Record<string, ComponentConfig> = {
  container: {
    name: '容器',
    icon: '📦',
    defaultProps: { padding: 16 },
    styles: { backgroundColor: '#ffffff', minHeight: '200px', borderRadius: '8px' },
    gridSize: { width: 12, height: 6 }  // 默认占满整行，高度6行
  },
  button: {
    name: '按钮',
    icon: '🔘',
    defaultProps: { text: '按钮', type: 'primary' },
    styles: { padding: '8px 24px', fontSize: '14px' },
    gridSize: { width: 2, height: 1 }  // 2列1行
  },
  input: {
    name: '输入框',
    icon: '✏️',
    defaultProps: { placeholder: '请输入...', label: '标签' },
    styles: { padding: '8px 12px', fontSize: '14px' },
    gridSize: { width: 4, height: 1 }  // 4列1行
  },
  text: {
    name: '文本',
    icon: '📝',
    defaultProps: { content: '这是一段文本', align: 'left' },
    styles: { fontSize: '14px', color: '#333333' },
    gridSize: { width: 6, height: 1 }  // 6列1行
  },
  image: {
    name: '图片',
    icon: '🖼️',
    defaultProps: { src: 'https://picsum.photos/200', alt: '占位图', width: '200' },
    styles: { borderRadius: '4px' },
    gridSize: { width: 4, height: 3 }  // 4列3行
  },
  card: {
    name: '卡片',
    icon: '🃏',
    defaultProps: { title: '卡片标题', content: '卡片内容' },
    styles: { padding: '16px', backgroundColor: '#ffffff', borderRadius: '8px', boxShadow: '0 2px 12px rgba(0,0,0,0.1)' },
    gridSize: { width: 4, height: 3 }  // 4列3行
  },
  grid: {
    name: '栅格',
    icon: '🔲',
    defaultProps: { cols: 3, gap: 16 },
    styles: { display: 'grid' },
    gridSize: { width: 12, height: 4 }  // 12列4行
  },
  // ECharts 图表组件 - 不设置固定高度，让它填满网格
  lineChart: {
    name: '折线图',
    icon: '📈',
    defaultProps: {
      title: '折线图',
      xData: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
      yData: [820, 932, 901, 934, 1290, 1330, 1320],
      smooth: true
    },
    styles: { width: '100%' },
    gridSize: { width: 6, height: 4 }  // 6列4行
  },
  barChart: {
    name: '柱状图',
    icon: '📊',
    defaultProps: {
      title: '柱状图',
      xData: ['衬衫', '羊毛衫', '雪纺衫', '裤子', '高跟鞋', '袜子'],
      yData: [5, 20, 36, 10, 10, 20]
    },
    styles: { width: '100%' },
    gridSize: { width: 6, height: 4 }  // 6列4行
  },
  pieChart: {
    name: '饼图',
    icon: '🥧',
    defaultProps: {
      title: '饼图',
      data: [
        { name: '直接访问', value: 335 },
        { name: '邮件营销', value: 310 },
        { name: '联盟广告', value: 234 },
        { name: '视频广告', value: 135 },
        { name: '搜索引擎', value: 1548 }
      ]
    },
    styles: { width: '100%' },
    gridSize: { width: 4, height: 4 }  // 4列4行
  },
  scatterChart: {
    name: '散点图',
    icon: '⚬',
    defaultProps: {
      title: '散点图',
      data: [
        [10, 8.04], [8, 6.95], [13, 7.58], [9, 8.81], [11, 8.33],
        [14, 9.96], [6, 7.24], [4, 4.26], [12, 10.84], [7, 4.82],
        [5, 5.68]
      ]
    },
    styles: { width: '100%' },
    gridSize: { width: 5, height: 4 }  // 5列4行
  },
  gaugeChart: {
    name: '仪表盘',
    icon: '🎯',
    defaultProps: {
      title: '仪表盘',
      value: 75,
      max: 100,
      unit: '%'
    },
    styles: { width: '100%' },
    gridSize: { width: 3, height: 3 }  // 3列3行
  }
}

// 组件列表（用于面板展示）
export const COMPONENT_LIST = Object.entries(COMPONENT_CONFIGS).map(([key, config]) => ({
  type: key,
  ...config
}))
