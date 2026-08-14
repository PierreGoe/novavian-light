import { createApp } from 'vue'

import App from './App.vue'
import router from './router'
import { vClickable } from './directives/clickable'

const app = createApp(App)

app.use(router)
app.directive('clickable', vClickable)

app.mount('#app')
