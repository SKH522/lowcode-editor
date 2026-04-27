<script setup lang="ts">
import { NConfigProvider, NMessageProvider, darkTheme } from 'naive-ui'
import Toolbar from './components/Toolbar.vue'
import ComponentPanel from './components/ComponentPanel.vue'
import Canvas from './components/Canvas.vue'
import PropertyPanel from './components/PropertyPanel.vue'

const themeOverrides = {
  common: {
    primaryColor: '#e94560',
    primaryColorHover: '#ff6b8a',
    primaryColorPressed: '#c73e54',
    borderRadius: '6px'
  }
}
</script>

<template>
  <NConfigProvider :theme="darkTheme" :theme-overrides="themeOverrides">
    <NMessageProvider>
      <div class="app-container">
        <Toolbar />
        <div class="main-content">
          <aside class="left-panel">
            <ComponentPanel />
          </aside>
          <main class="center-panel">
            <Canvas />
          </main>
          <aside class="right-panel">
            <PropertyPanel />
          </aside>
        </div>
      </div>
    </NMessageProvider>
  </NConfigProvider>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background: var(--bg-dark);
}

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.left-panel {
  width: 240px;
  min-width: 200px;
  background: var(--bg-darker);
  border-right: 1px solid var(--border-color);
  overflow-y: auto;
}

.center-panel {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.right-panel {
  width: 280px;
  min-width: 240px;
  background: var(--bg-darker);
  border-left: 1px solid var(--border-color);
  overflow-y: auto;
}

/* 响应式布局 */
@media (max-width: 1024px) {
  .left-panel {
    width: 200px;
    min-width: 180px;
  }
  .right-panel {
    width: 240px;
    min-width: 200px;
  }
}

@media (max-width: 768px) {
  .main-content {
    flex-direction: column;
  }
  .left-panel,
  .right-panel {
    width: 100%;
    height: auto;
    max-height: 30vh;
    border-right: none;
    border-left: none;
  }
  .left-panel {
    border-bottom: 1px solid var(--border-color);
  }
  .right-panel {
    border-top: 1px solid var(--border-color);
  }
}
</style>
