<script setup lang="ts">
import { shallowRef } from 'vue'
import { useLoop } from '@tresjs/core'
import { OrbitControls, Stars } from '@tresjs/cientos'
// @ts-ignore
import { SRGBColorSpace, NoToneMapping } from 'three'

const yRotation = shallowRef(0)
const { onBeforeRender } = useLoop()

onBeforeRender(({ elapsed }) => {
  yRotation.value = elapsed * 0.2
})
</script>

<template>
  <TresCanvas
    shadows
    alpha
    :gl="{
      outputColorSpace: SRGBColorSpace,
      toneMapping: NoToneMapping,
    }"
  >
    <TresPerspectiveCamera :position="[0, 0, 8]" :fov="45" :look-at="[0, 0, 0]" />
    <OrbitControls :enable-zoom="false" :enable-pan="false" :auto-rotate="true" :auto-rotate-speed="0.5" />
    
    <Stars :radius="100" :depth="50" :count="5000" :size="0.5" :color="'#888888'" />
    
    <TresGroup :rotation-y="yRotation">
        <!-- Core Nucleus -->
        <TresMesh>
          <TresIcosahedronGeometry :args="[2, 4]" />
          <TresMeshStandardMaterial 
             color="#7c3aed" 
             wireframe 
             :emissive="0x5b21b6"
             :emissive-intensity="2"
          />
        </TresMesh>
        
        <!-- Inner Glow Shell -->
        <TresMesh>
             <TresIcosahedronGeometry :args="[1.8, 4]" />
             <TresMeshBasicMaterial color="#000000" />
        </TresMesh>

        <!-- Outer Rings -->
        <TresMesh>
          <TresTorusGeometry :args="[3.5, 0.02, 16, 100]" />
          <TresMeshBasicMaterial color="#4c1d95" />
        </TresMesh>
        
        <TresMesh :rotation-x="Math.PI / 2">
          <TresTorusGeometry :args="[4, 0.02, 16, 100]" />
          <TresMeshBasicMaterial color="#2563eb" />
        </TresMesh>
    </TresGroup>
    
    <TresAmbientLight :intensity="1" />
    <TresDirectionalLight :position="[5, 5, 5]" :intensity="3" color="#ffffff" />
    <TresPointLight :position="[-5, -5, -5]" :intensity="2" color="#db2777" />
  </TresCanvas>
</template>
