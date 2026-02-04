import { ref, onMounted, onUnmounted, type Ref } from 'vue'

export interface ParallaxOptions {
  speed?: number
  direction?: 'vertical' | 'horizontal'
  reverse?: boolean
  clamp?: boolean
}

export interface ParallaxLayer {
  element: HTMLElement
  speed: number
  direction: 'vertical' | 'horizontal'
  reverse: boolean
  clamp: boolean
}

/**
 * 视差滚动效果 Composable
 * 用于创建多层视差滚动效果
 *
 * @example
 * const { registerLayer, unregisterLayer, updateParallax } = useParallax()
 *
 * // 注册视差层
 * onMounted(() => {
 *   const bgLayer = document.querySelector('.bg-layer')
 *   if (bgLayer) registerLayer(bgLayer as HTMLElement, { speed: 0.2 })
 * })
 */
export function useParallax() {
  const layers = ref<ParallaxLayer[]>([])
  const isActive = ref(false)
  let rafId: number | null = null

  /**
   * 注册视差层
   */
  const registerLayer = (
    element: HTMLElement,
    options: ParallaxOptions = {}
  ) => {
    const layer: ParallaxLayer = {
      element,
      speed: options.speed ?? 1,
      direction: options.direction ?? 'vertical',
      reverse: options.reverse ?? false,
      clamp: options.clamp ?? false
    }
    layers.value.push(layer)
    return layer
  }

  /**
   * 注销视差层
   */
  const unregisterLayer = (element: HTMLElement) => {
    const index = layers.value.findIndex(l => l.element === element)
    if (index > -1) {
      layers.value.splice(index, 1)
    }
  }

  /**
   * 更新视差位置
   */
  const updateParallax = () => {
    const viewportHeight = window.innerHeight

    layers.value.forEach(layer => {
      const { element, speed, direction, reverse, clamp } = layer

      // 计算元素在视口中的位置
      const rect = element.getBoundingClientRect()
      const elementCenter = rect.top + rect.height / 2
      const viewportCenter = viewportHeight / 2

      // 计算偏移量
      let offset = (elementCenter - viewportCenter) * (speed - 1)

      // 反向偏移
      if (reverse) {
        offset = -offset
      }

      // 限制偏移范围
      if (clamp) {
        const maxOffset = viewportHeight * 0.5
        offset = Math.max(-maxOffset, Math.min(maxOffset, offset))
      }

      // 应用变换
      if (direction === 'horizontal') {
        element.style.transform = `translate3d(${offset}px, 0, 0)`
      } else {
        element.style.transform = `translate3d(0, ${offset}px, 0)`
      }
    })
  }

  /**
   * RAF 循环
   */
  const tick = () => {
    if (!isActive.value) return
    updateParallax()
    rafId = requestAnimationFrame(tick)
  }

  /**
   * 开始视差效果
   */
  const start = () => {
    if (isActive.value) return
    isActive.value = true
    tick()
  }

  /**
   * 停止视差效果
   */
  const stop = () => {
    isActive.value = false
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  /**
   * 销毁所有资源
   */
  const destroy = () => {
    stop()
    layers.value = []
  }

  onMounted(() => {
    // 可选：自动开始
    // start()
  })

  onUnmounted(() => {
    destroy()
  })

  return {
    layers,
    isActive,
    registerLayer,
    unregisterLayer,
    updateParallax,
    start,
    stop,
    destroy
  }
}

/**
 * 简化的视差 hook，用于单个元素
 *
 * @example
 * const elementRef = ref<HTMLElement>()
 * useElementParallax(elementRef, { speed: 0.5 })
 */
export function useElementParallax(
  elementRef: Ref<HTMLElement | undefined>,
  options: ParallaxOptions = {}
) {
  const { registerLayer, unregisterLayer } = useParallax()

  onMounted(() => {
    if (elementRef.value) {
      registerLayer(elementRef.value, options)
    }
  })

  onUnmounted(() => {
    if (elementRef.value) {
      unregisterLayer(elementRef.value)
    }
  })
}

/**
 * 滚动进度 hook
 * 返回当前滚动进度 (0-1)
 */
export function useScrollProgress() {
  const progress = ref(0)

  const updateProgress = () => {
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
    progress.value = scrollHeight > 0 ? window.scrollY / scrollHeight : 0
  }

  onMounted(() => {
    window.addEventListener('scroll', updateProgress, { passive: true })
    updateProgress()
  })

  onUnmounted(() => {
    window.removeEventListener('scroll', updateProgress)
  })

  return progress
}

/**
 * 元素可见性检测 hook
 *
 * @example
 * const elementRef = ref<HTMLElement>()
 * const { isVisible, intersectionRatio } = useElementVisibility(elementRef, { threshold: 0.5 })
 */
export function useElementVisibility(
  elementRef: Ref<HTMLElement | undefined>,
  options: IntersectionObserverInit = {}
) {
  const isVisible = ref(false)
  const intersectionRatio = ref(0)
  let observer: IntersectionObserver | null = null

  onMounted(() => {
    if (!elementRef.value) return

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          isVisible.value = entry.isIntersecting
          intersectionRatio.value = entry.intersectionRatio
        })
      },
      {
        threshold: [0, 0.25, 0.5, 0.75, 1],
        ...options
      }
    )

    observer.observe(elementRef.value)
  })

  onUnmounted(() => {
    if (observer && elementRef.value) {
      observer.unobserve(elementRef.value)
      observer.disconnect()
    }
  })

  return { isVisible, intersectionRatio }
}

export default useParallax
