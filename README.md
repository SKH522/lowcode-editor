# 低代码平台编辑器

基于 Vue3 + TypeScript 的可视化低代码编辑器。

## 功能特性

- 组件面板：支持拖拽添加基础组件
- 可视化画布：实时预览编辑效果
- 属性面板：配置选中组件属性
- 响应式设计：适配不同屏幕尺寸
- 实时预览：即时查看页面效果

## 技术栈

- Vue 3.4+ (Composition API + `<script setup>`)
- TypeScript 5
- Vite 5
- Naive UI 2.x (UI 组件库)
- Pinia (状态管理)
- UnoCSS (原子化 CSS)

## 运行项目

```bash
npm install
npm run dev
```

## 项目结构

```
lowcode-editor/
├── src/
│   ├── components/     # 组件目录
│   │   ├── Canvas.vue       # 画布区域
│   │   ├── ComponentPanel.vue  # 组件面板
│   │   ├── PropertyPanel.vue   # 属性面板
│   │   ├── Preview.vue         # 预览模式
│   │   └── Toolbar.vue          # 工具栏
│   ├── composables/     # 组合式函数
│   │   └── useDrag.ts         # 拖拽逻辑
│   ├── stores/
│   │   └── editor.ts     # 编辑器状态
│   ├── types/
│   │   └── editor.ts     # 类型定义
│   ├── App.vue
│   ├── main.ts
│   └── style.css
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── uno.config.ts
```
