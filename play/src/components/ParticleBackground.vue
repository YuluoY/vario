<template>
  <div class="particle-background" :class="`speed-${speed}`">
    <!-- 网格背景 -->
    <div v-if="showGrid" class="particle-grid" aria-hidden="true"></div>

    <!-- 光晕效果 -->
    <div v-if="showGlow" class="particle-glow" aria-hidden="true"></div>

    <!-- 噪声纹理 -->
    <div v-if="showNoise" class="particle-noise" aria-hidden="true"></div>

    <!-- 浮动粒子 -->
    <div v-if="showParticles" class="particle-dots" aria-hidden="true">
      <div
        v-for="i in particleCount"
        :key="i"
        class="particle-dot"
        :style="getParticleStyle(i)"
      />
    </div>

    <!-- 渐变遮罩 -->
    <div class="particle-gradient-overlay" aria-hidden="true"></div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  // 视差速度: 0.1-1.0
  speed?: number
  // 是否显示网格
  showGrid?: boolean
  // 是否显示光晕
  showGlow?: boolean
  // 是否显示噪声
  showNoise?: boolean
  // 是否显示浮动粒子
  showParticles?: boolean
  // 粒子数量
  particleCount?: number
}

withDefaults(defineProps<Props>(), {
  speed: 0.2,
  showGrid: true,
  showGlow: true,
  showNoise: true,
  showParticles: true,
  particleCount: 30
})

// 生成粒子随机样式
const getParticleStyle = (index: number) => {
  // 使用伪随机确保每次渲染一致
  const seed = index * 997 // 质数确保分布均匀
  const random = (offset: number) => {
    const x = Math.sin(seed + offset) * 10000
    return x - Math.floor(x)
  }

  const size = 2 + random(1) * 4 // 2-6px
  const left = random(2) * 100 // 0-100%
  const opacity = 0.3 + random(3) * 0.5 // 0.3-0.8
  const duration = 15 + random(4) * 25 // 15-40s
  const delay = random(5) * -40 // -40-0s (负延迟让动画已开始)
  const drift = -50 + random(6) * 100 // -50 to 50px horizontal drift

  return {
    width: `${size}px`,
    height: `${size}px`,
    left: `${left}%`,
    opacity,
    '--opacity': opacity,
    '--drift': `${drift}px`,
    animationDuration: `${duration}s`,
    animationDelay: `${delay}s`
  }
}
</script>

<style scoped lang="scss">
.particle-background {
  position: fixed;
  inset: -10vh -10vw;
  z-index: 0;
  pointer-events: none;
  will-change: transform;
  overflow: hidden;
}

// 网格背景
.particle-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
  background-size: 80px 80px;
  opacity: 0.5;

  // 透视效果
  transform: perspective(500px) rotateX(60deg);
  transform-origin: center top;
}

// 光晕效果 - 蓝色系
.particle-glow {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(
      ellipse 80vw 60vh at 50% 20%,
      rgba(37, 99, 235, 0.25) 0%,
      transparent 60%
    ),
    radial-gradient(
      ellipse 60vw 40vh at 80% 60%,
      rgba(56, 189, 248, 0.15) 0%,
      transparent 50%
    );
  filter: blur(40px);
  animation: glowPulse 8s ease-in-out infinite;
}

// 噪声纹理
.particle-noise {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  opacity: 0.04;
  mix-blend-mode: soft-light;
}

// 浮动粒子
.particle-dots {
  position: absolute;
  inset: 0;
}

.particle-dot {
  position: absolute;
  background: radial-gradient(circle, rgba(59, 130, 246, 0.8) 0%, transparent 70%);
  border-radius: 50%;
  animation: particleFloat linear infinite;
  box-shadow: 0 0 6px rgba(59, 130, 246, 0.5);
}

// 额外的闪烁粒子
.particle-twinkle {
  position: absolute;
  width: 2px;
  height: 2px;
  background: rgba(147, 197, 253, 0.6);
  border-radius: 50%;
  animation: twinkle 3s ease-in-out infinite;
}

// 流动的光点
.particle-stream {
  position: absolute;
  width: 100px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.4), transparent);
  animation: streamFloat 20s linear infinite;
}

// 渐变遮罩
.particle-gradient-overlay {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at center, transparent 0%, rgba(0, 0, 0, 0.4) 100%);
  pointer-events: none;
}

// Animations
@keyframes glowPulse {
  0%, 100% {
    opacity: 0.8;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.05);
  }
}

@keyframes particleFloat {
  0% {
    transform: translateY(100vh) translateX(0) scale(0);
    opacity: 0;
  }
  10% {
    opacity: var(--opacity, 0.6);
  }
  90% {
    opacity: var(--opacity, 0.6);
  }
  100% {
    transform: translateY(-10vh) translateX(var(--drift, 50px)) scale(1);
    opacity: 0;
  }
}

@keyframes twinkle {
  0%, 100% {
    opacity: 0.2;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.5);
  }
}

@keyframes streamFloat {
  0% {
    transform: translateX(-100vw) rotate(15deg);
    opacity: 0;
  }
  10% {
    opacity: 0.6;
  }
  90% {
    opacity: 0.6;
  }
  100% {
    transform: translateX(100vw) rotate(15deg);
    opacity: 0;
  }
}
</style>
