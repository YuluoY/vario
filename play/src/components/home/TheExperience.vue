<script setup lang="ts">
import { shallowRef, watch } from 'vue'
import { useLoop } from '@tresjs/core'
import { Stars } from '@tresjs/cientos'
// @ts-ignore
import { SRGBColorSpace, NoToneMapping } from 'three'
import gsap from 'gsap'

// Defines the scroll progress passed from the parent
const props = defineProps({
  progress: {
    type: Number,
    default: 0
  }
})

// Refs for 3D objects to animate
const coreRef = shallowRef<any>(null)
const pillarsGroupRef = shallowRef<any>(null)
const tunnelRef = shallowRef<any>(null)

// Individual pillars
const pillar1Ref = shallowRef<any>(null) 
const pillar2Ref = shallowRef<any>(null) 
const pillar3Ref = shallowRef<any>(null)

const { onBeforeRender } = useLoop()

// Animation Logic
// We watch the 'progress' prop (0 to 1 across the whole page) 
// and map it to specific time ranges in our GSAP timeline visualizer in head
watch(() => props.progress, (val) => {
  // --- PHASE 1: EXPLOSION (0.0 - 0.25) ---
  // Core scales down and disappears
  if (coreRef.value) {
    const p1 = Math.min(val * 4, 1) // 0 -> 1 quickly
    // Core transforms
    coreRef.value.scale.set(1 + p1 * 2, 1 + p1 * 2, 1 + p1 * 2)
    coreRef.value.rotation.y = val * 10
    
    // Fade out effect needs material access, simplified here by moving it away
    if (val > 0.2) coreRef.value.visible = false
    else coreRef.value.visible = true
  }

  // --- PHASE 2: PILLARS ASSEMBLY (0.25 - 0.6) ---
  // Pillars fly in from random positions to form valid structure
  if (pillarsGroupRef.value) {
    const start = 0.15
    const end = 0.5
    // Normalize progress for this section (0 to 1)
    let p2 = (val - start) / (end - start)
    p2 = Math.max(0, Math.min(1, p2))
    
    pillarsGroupRef.value.visible = val > 0.1
    
    if (pillar1Ref.value && pillar2Ref.value && pillar3Ref.value) {
       // Pillar 1 (Schema): Left
       gsap.to(pillar1Ref.value.position, {
         x: -3 * p2, y: 0, z: 0,
         overwrite: true, duration: 0.1
       })
       // Pillar 2 (Core): Center (Up)
       gsap.to(pillar2Ref.value.position, {
         x: 0, y: 2 * p2, z: -2 * p2,
         overwrite: true, duration: 0.1
       })
       // Pillar 3 (Vue): Right
       gsap.to(pillar3Ref.value.position, {
         x: 3 * p2, y: 0, z: 0,
         overwrite: true, duration: 0.1
       })
       
       pillarsGroupRef.value.rotation.y = val * 0.5
    }
  }

  // --- PHASE 3: WARP SPEED (0.6 - 1.0) ---
  if (tunnelRef.value) {
    const start = 0.6
    
    if (val > start) {
       tunnelRef.value.visible = true
       // Hide others
       if (pillarsGroupRef.value) pillarsGroupRef.value.visible = false
       
       // Tunnel camera effect simulation
       tunnelRef.value.position.z = (val - start) * 50
    } else {
       tunnelRef.value.visible = false
    }
  }
})

// Rotation loops
onBeforeRender(({ elapsed }) => {
  // Idle animations
  if (coreRef.value && coreRef.value.visible) {
    coreRef.value.rotation.x = elapsed * 0.2
    coreRef.value.rotation.y = elapsed * 0.3
  }
  
  if (pillarsGroupRef.value && pillarsGroupRef.value.visible) {
    if(pillar1Ref.value) pillar1Ref.value.rotation.x = elapsed
    if(pillar2Ref.value) pillar2Ref.value.rotation.y = elapsed
    if(pillar3Ref.value) pillar3Ref.value.rotation.z = elapsed
  }
})

// Tunnel geometry generation
const tunnelPoints = []
for(let i=0; i<100; i++) {
  const theta = Math.random() * Math.PI * 2
  const r = 5 + Math.random() * 5
  const x = r * Math.cos(theta)
  const y = r * Math.sin(theta)
  const z = -i * 2
  tunnelPoints.push(x, y, z)
}
</script>

<template>
  <TresCanvas
    alpha
    shadows
    :gl="{
      outputColorSpace: SRGBColorSpace,
      toneMapping: NoToneMapping,
    }"
  >
    <TresPerspectiveCamera :position="[0, 0, 10]" :fov="45" :look-at="[0, 0, 0]" />
    
    <!-- Background Stars (Always present) -->
    <Stars :radius="100" :depth="50" :count="5000" :size="0.5" :color="'#888888'" />
    <TresAmbientLight :intensity="1" />
    <TresDirectionalLight :position="[5, 5, 5]" :intensity="3" color="#ffffff" />
    <TresPointLight :position="[-5, -5, 5]" :intensity="5" color="#7c3aed" />

    <!-- 1. THE SINGULARITY (Core) -->
    <TresMesh ref="coreRef">
      <TresIcosahedronGeometry :args="[2, 2]" />
      <TresMeshStandardMaterial 
         color="#7c3aed" 
         wireframe 
         :emissive="0x4c1d95"
         :emissive-intensity="1"
      />
    </TresMesh>

    <!-- 2. THE PILLARS (Schema, Core, Vue) -->
    <TresGroup ref="pillarsGroupRef" :visible="false">
      <!-- Schema Object -->
      <TresMesh ref="pillar1Ref">
         <TresOctahedronGeometry :args="[1.5, 0]" />
         <TresMeshStandardMaterial color="#3b82f6" wireframe :emissive="0x1d4ed8" :emissive-intensity="2" />
      </TresMesh>
      
      <!-- Core Object -->
      <TresMesh ref="pillar2Ref">
         <TresTorusKnotGeometry :args="[1, 0.3, 100, 16]" />
         <TresMeshStandardMaterial color="#10b981" wireframe :emissive="0x047857" :emissive-intensity="2" />
      </TresMesh>
      
      <!-- Vue Object -->
      <TresMesh ref="pillar3Ref">
         <TresBoxGeometry :args="[2, 2, 2]" />
         <TresMeshStandardMaterial color="#f59e0b" wireframe :emissive="0xb45309" :emissive-intensity="2" />
      </TresMesh>
    </TresGroup>

    <!-- 3. THE TUNNEL (Performance) -->
    <TresGroup ref="tunnelRef" :visible="false">
       <!-- Simplified warp lines using thin boxes -->
       <TresMesh v-for="i in 20" :key="i" :position="[Math.cos(i)*8, Math.sin(i)*8, -i*5]" :rotation-z="i">
          <TresBoxGeometry :args="[0.1, 0.1, 10]" />
          <TresMeshBasicMaterial color="#ffffff" transparent :opacity="0.5" />
       </TresMesh>
    </TresGroup>

  </TresCanvas>
</template>
