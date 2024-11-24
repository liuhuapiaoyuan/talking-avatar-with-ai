import React, { memo, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
 
function _CustomEnvironment() {
  const { gl, scene } = useThree();

  useEffect(() => {
    const loader = new RGBELoader();
    const pmremGenerator = new THREE.PMREMGenerator(gl);

    loader.load(
      'https://cdn.kedao.ggss.club/ai-avatar/venice_sunset_1k.hdr',
      (texture) => {
        const envMap = pmremGenerator.fromCubemap(texture).texture;
        scene.background = envMap;
        scene.environment = envMap;

        // 清理
        texture.dispose();
        pmremGenerator.dispose();
      },
      undefined,
      (err) => console.error('An error happened.', err)
    );

    // 清理函数
    return () => {
      if (pmremGenerator) pmremGenerator.dispose();
    };
  }, [gl, scene]);

  return null;
}

export const CustomEnvironment = memo(_CustomEnvironment);