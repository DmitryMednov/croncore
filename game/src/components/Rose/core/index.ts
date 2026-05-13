import * as THREE from 'three'
import { useState } from 'react'
import { useEffect } from 'react'
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { TextureLoader } from 'three'
import { VATMeta } from './config'

/**
 * Setup VAT geometry: generate UV1 coordinates and convert coordinate system
 * - Generates UV1 coordinates matching Unity's VAT texture layout
 * - Converts positions from Unity's left-handed to Three.js right-handed coordinate system
 */
export function setupVATGeometry(geometry: THREE.BufferGeometry, meta: VATMeta): void {
  const count = geometry.getAttribute('position').count
  const positionAttr = geometry.getAttribute('position')
  
  const uv1Array = new Float32Array(count * 2)
  const positionArray = new Float32Array(count * 3)
  const padding = meta.padding ?? 2 // Space between columns (default: 2)
  const adjustedFramesCount = meta.frameCount + padding
  
  for(let i = 0; i < count; i++) {
    // Calculate UV1 coordinates based on vertex index (matching Unity's getCoord logic)
    const columnIndex = Math.floor(i / meta.textureHeight)
    const verticalIndex = i % meta.textureHeight
    
    const uIdx = columnIndex * adjustedFramesCount
    const vIdx = verticalIndex
    
    const u = (uIdx + 0.5) / meta.textureWidth
    const v = (vIdx + 0.5) / meta.textureHeight
    
    uv1Array[2 * i + 0] = u
    uv1Array[2 * i + 1] = v

    // Convert coordinate system: Unity (left-handed) -> Three.js (right-handed)
    // Flip X axis to convert from left-handed to right-handed
    positionArray[3 * i + 0] = positionAttr.getX(i) * -1
    positionArray[3 * i + 1] = positionAttr.getY(i)
    positionArray[3 * i + 2] = positionAttr.getZ(i)
  }
  
  geometry.setAttribute('uv1', new THREE.BufferAttribute(uv1Array, 2))
  geometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3))
}

export function calculateVATFrame(
  frameRatio: number | undefined,
  currentTime: number,
  metaData: VATMeta,
  speed: number
): number {
  if (frameRatio !== undefined) {
    return Math.max(0, Math.min(1, frameRatio))
  }
  // Calculate time position from elapsed time
  const fps = metaData.fps || 24
  const duration = metaData.frameCount / fps
  const timePosition = ((currentTime * speed) % duration) / duration
  return Math.max(0, Math.min(1, timePosition))
}

/**
 * Extract geometry from a THREE.Group/Scene
 */
export function extractGeometryFromScene(scene: THREE.Group): THREE.BufferGeometry | null {
  let geometry: THREE.BufferGeometry | null = null
  
  scene.traverse((object: any) => {
    if (object.isMesh && object.geometry && !geometry) {
      geometry = object.geometry.clone()
    }
  })
  
  return geometry
}

// Helper function to get the appropriate loader for file extension
function getLoaderForExtension(url: string) {
  const ext = url.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'exr':
      return EXRLoader
    case 'png':
    case 'jpg':
    case 'jpeg':
    default:
      return TextureLoader
  }
}

// Helper function to configure EXR loader
function configureEXRLoader(loader: any) {
  if (loader.constructor.name === 'EXRLoader') {
    loader.setDataType(THREE.FloatType)
  }
}

// Helper function to resolve relative paths from meta JSON
function resolvePath(metaUrl: string, relativePath: string): string {
  if (relativePath.startsWith('/') || relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath
  }
  // Extract base directory from metaUrl
  const metaDir = metaUrl.substring(0, metaUrl.lastIndexOf('/') + 1)
  return metaDir + relativePath
}
export interface VATData {
  scene: THREE.Group | null
  posTex: THREE.Texture | null
  nrmTex: THREE.Texture | null
  meta: VATMeta | null
  isLoaded: boolean
}

// Global Cache (Hidden from your component)
const promiseCache = new Map<string, Promise<VATData>>()
const resultCache = new Map<string, VATData>()

// --- The Loader Logic ---
export const preloadVATAssets = (metaUrl: string): Promise<VATData> => {
  // Return cached result immediately if ready
  if (resultCache.has(metaUrl)) return Promise.resolve(resultCache.get(metaUrl)!)
  // Return existing promise if already downloading
  if (promiseCache.has(metaUrl)) return promiseCache.get(metaUrl)!

  const promise = (async () => {
    try {
      const loader = new THREE.FileLoader()
      const metaStr = await loader.loadAsync(metaUrl)
      const meta = JSON.parse(metaStr as string) as VATMeta

      // Path resolver
      const resolve = (p: string) => {
         if (p.startsWith('/') || p.startsWith('http')) return p
         const dir = metaUrl.substring(0, metaUrl.lastIndexOf('/') + 1)
         return dir + p
      }

      // Helper Loaders
      const loadMesh = async (path: string) => {
          const ext = path.split('.').pop()?.toLowerCase()
          if (ext === 'fbx') {
             const l = new FBXLoader();
             return await l.loadAsync(path);
          } else {
             const l = new GLTFLoader(); 
             const g = await l.loadAsync(path); 
             return g.scene 
          }
      }
      
      const loadTex = async (path: string) => {
          const isEXR = path.toLowerCase().endsWith('exr')
          const l = isEXR ? new EXRLoader().setDataType(THREE.FloatType) : new THREE.TextureLoader()
          return await l.loadAsync(path)
      }

      // Parallel Download
      const [scene, posTex, nrmTex] = await Promise.all([
        meta.glb ? loadMesh(resolve(meta.glb)) : null,
        meta.textures?.position ? loadTex(resolve(meta.textures.position)) : null,
        meta.textures?.normal ? loadTex(resolve(meta.textures.normal)) : null
      ])

      const data: VATData = { scene, posTex, nrmTex, meta, isLoaded: true }
      resultCache.set(metaUrl, data)
      return data

    } catch (e) {
      console.error("VAT Load Failed", e)
      return { scene: null, posTex: null, nrmTex: null, meta: null, isLoaded: false }
    }
  })()

  promiseCache.set(metaUrl, promise)
  return promise
}

// --- The Hook (Matches your previous setting exactly) ---
export function useVATPreloader(metaUrl: string) {
  // 1. Check cache immediately so if data is ready, we return it instantly (no flash)
  const [data, setData] = useState<VATData>(() => {
    if (resultCache.has(metaUrl)) return resultCache.get(metaUrl)!
    return { scene: null, posTex: null, nrmTex: null, meta: null, isLoaded: false }
  })

  useEffect(() => {
    if (data.isLoaded) return // Already done

    let active = true
    
    // 2. Start/Connect to global download
    preloadVATAssets(metaUrl).then((loadedData) => {
      if (active) setData(loadedData)
    })

    return () => { active = false }
  }, [metaUrl, data.isLoaded])

  return data
}