import { describe, it, expect, beforeEach } from 'vitest'

import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import App from '../App.vue'
import routes from '../router/index'

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('mounts renders properly', async () => {
    const router = createRouter({
      history: createWebHistory(),
      routes: routes.options.routes,
    })
    router.push('/')
    await router.isReady()

    const wrapper = mount(App, {
      global: {
        plugins: [router],
      },
    })
    expect(wrapper.exists()).toBe(true)
  })
})
