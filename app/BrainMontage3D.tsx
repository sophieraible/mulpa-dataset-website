'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

type BrainChannel = {
  id: string;
  type: 'long' | 'short';
  source: string;
  detector: string;
};

type BrainOptode = {
  id: string;
  type: 'source' | 'detector';
  mni: number[];
};

type BrainMontage3DProps = {
  channels: BrainChannel[];
  optodes: BrainOptode[];
  shortDetectorIds: Set<string>;
  showSources: boolean;
  showDetectors: boolean;
  activeChannelId: string;
  assetBasePath: string;
  onSelect: (channelId: string) => void;
};

type ViewerRefs = {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  montage: THREE.Group;
  scene: THREE.Scene;
};

const CAMERA_POSITION = new THREE.Vector3(0, 34, 360);
const CAMERA_TARGET = new THREE.Vector3(0, 15, 0);
const HEAD_CENTER = new THREE.Vector3(0, 12, 0);
const RING_AXIS = new THREE.Vector3(0, 0, 1);

function mniToThree(mni: number[]) {
  return new THREE.Vector3(mni[0], mni[2], mni[1]);
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => material.dispose());
  });
}

function geometryFromSurface(buffer: ArrayBuffer, label: string) {
  const header = new DataView(buffer, 0, 16);
  const magic = String.fromCharCode(...new Uint8Array(buffer, 0, 4));
  const version = header.getUint32(4, true);
  const vertexCount = header.getUint32(8, true);
  const triangleCount = header.getUint32(12, true);
  if (magic !== 'MUL3' || version !== 1) throw new Error(`Unsupported ${label} surface`);

  const positionsOffset = 16;
  const normalsOffset = positionsOffset + vertexCount * 3 * 4;
  const indicesOffset = normalsOffset + vertexCount * 3 * 4;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buffer, positionsOffset, vertexCount * 3), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(buffer, normalsOffset, vertexCount * 3), 3));
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(buffer, indicesOffset, triangleCount * 3), 1));
  geometry.computeBoundingSphere();
  return geometry;
}

export default function BrainMontage3D({
  channels,
  optodes,
  shortDetectorIds,
  showSources,
  showDetectors,
  activeChannelId,
  assetBasePath,
  onSelect,
}: BrainMontage3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<ViewerRefs | null>(null);
  const selectRef = useRef(onSelect);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [hoveredChannelId, setHoveredChannelId] = useState<string | null>(null);

  useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f6f8f5');

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000);
    camera.position.copy(CAMERA_POSITION);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    renderer.domElement.style.touchAction = 'none';
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 175;
    controls.maxDistance = 650;
    controls.target.copy(CAMERA_TARGET);

    scene.add(new THREE.HemisphereLight('#ffffff', '#5a6570', 2.2));
    const keyLight = new THREE.DirectionalLight('#fff7e8', 2.8);
    keyLight.position.set(-90, 150, 170);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight('#bcefff', 1.6);
    rimLight.position.set(130, 40, -100);
    scene.add(rimLight);

    const montage = new THREE.Group();
    scene.add(montage);
    viewerRef.current = { camera, controls, montage, scene };

    const abortController = new AbortController();
    const loadSurface = (filename: string) => fetch(`${assetBasePath}/${filename}`, { signal: abortController.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`${filename} request failed (${response.status})`);
        return response.arrayBuffer();
      });

    Promise.all([loadSurface('brain-surface.bin'), loadSurface('scalp-surface.bin')])
      .then(([brainBuffer, scalpBuffer]) => {
        if (abortController.signal.aborted) return;
        const brain = new THREE.Mesh(
          geometryFromSurface(brainBuffer, 'brain'),
          new THREE.MeshStandardMaterial({
            color: '#d8d1c8',
            roughness: 0.86,
            metalness: 0.02,
            side: THREE.DoubleSide,
            shadowSide: THREE.DoubleSide,
          }),
        );
        brain.name = 'ICBM152 brain surface';
        brain.renderOrder = 0;
        scene.add(brain);

        const scalp = new THREE.Mesh(
          geometryFromSurface(scalpBuffer, 'scalp'),
          new THREE.MeshPhysicalMaterial({
            color: '#9fcfc9',
            transparent: true,
            opacity: 0.18,
            roughness: 0.72,
            metalness: 0,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
        );
        scalp.name = 'ICBM152 scalp surface';
        scalp.renderOrder = 1;
        scene.add(scalp);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error(error);
        setStatus('error');
      });

    let resizeFrame = 0;
    let lastWidth = 0;
    let lastHeight = 0;
    const resize = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        const width = Math.max(Math.round(host.clientWidth), 1);
        const height = Math.max(Math.round(host.clientHeight), 1);
        if (width === lastWidth && height === lastHeight) return;
        lastWidth = width;
        lastHeight = height;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      });
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const hitChannel = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(montage.children, false).find((hit) => hit.object.userData.channelId);
    };
    let pointedChannelId: string | null = null;
    const handlePointerMove = (event: PointerEvent) => {
      const hit = hitChannel(event);
      const nextChannelId = hit ? String(hit.object.userData.channelId) : null;
      renderer.domElement.style.cursor = nextChannelId ? 'pointer' : 'grab';
      if (nextChannelId !== pointedChannelId) {
        pointedChannelId = nextChannelId;
        setHoveredChannelId(nextChannelId);
      }
    };
    const handlePointerLeave = () => {
      pointedChannelId = null;
      renderer.domElement.style.cursor = 'grab';
      setHoveredChannelId(null);
    };
    const handleClick = (event: PointerEvent) => {
      const hit = hitChannel(event);
      if (hit) selectRef.current(String(hit.object.userData.channelId));
    };
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerleave', handlePointerLeave);
    renderer.domElement.addEventListener('click', handleClick);

    let animationFrame = 0;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      abortController.abort();
      cancelAnimationFrame(animationFrame);
      cancelAnimationFrame(resizeFrame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerleave', handlePointerLeave);
      renderer.domElement.removeEventListener('click', handleClick);
      controls.dispose();
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
      viewerRef.current = null;
    };
  }, [assetBasePath]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    disposeObject(viewer.montage);
    viewer.montage.clear();

    const optodeById = new Map(optodes.map((optode) => [optode.id, optode]));
    for (const channel of channels) {
      const source = optodeById.get(channel.source);
      const detector = optodeById.get(channel.detector);
      if (!source || !detector) continue;

      const start = mniToThree(source.mni);
      const end = mniToThree(detector.mni);
      const selected = channel.id === activeChannelId;
      const hovered = channel.id === hoveredChannelId;

      if (channel.type === 'short') {
        if (!showDetectors) continue;
        const ringNormal = start.clone().sub(HEAD_CENTER).normalize();
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(4.25, selected ? 1.45 : hovered ? 1.25 : 0.74, 8, 28),
          new THREE.MeshStandardMaterial({
            color: selected ? '#d7ef30' : hovered ? '#ffbd24' : '#2f85bd',
            emissive: selected ? '#8ca300' : hovered ? '#9b5700' : '#000000',
            emissiveIntensity: selected ? 0.7 : hovered ? 0.6 : 0,
            roughness: 0.28,
          }),
        );
        ring.position.copy(start);
        ring.quaternion.setFromUnitVectors(RING_AXIS, ringNormal);
        ring.userData.channelId = channel.id;
        ring.renderOrder = selected ? 5 : hovered ? 4 : 3;
        viewer.montage.add(ring);

        const hitRing = new THREE.Mesh(
          new THREE.TorusGeometry(4.25, 1.8, 6, 20),
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
        );
        hitRing.position.copy(start);
        hitRing.quaternion.copy(ring.quaternion);
        hitRing.userData.channelId = channel.id;
        viewer.montage.add(hitRing);
        continue;
      }

      const curve = new THREE.LineCurve3(start, end);
      const geometry = new THREE.TubeGeometry(curve, 10, selected ? 1.45 : hovered ? 1.25 : 0.74, 6, false);
      const material = new THREE.MeshStandardMaterial({
        color: selected ? '#d7ef30' : hovered ? '#ffbd24' : '#0087a8',
        emissive: selected ? '#8ca300' : hovered ? '#9b5700' : '#000000',
        emissiveIntensity: selected ? 0.7 : hovered ? 0.6 : 0,
        roughness: 0.35,
      });
      const tube = new THREE.Mesh(geometry, material);
      tube.userData.channelId = channel.id;
      tube.renderOrder = selected ? 5 : hovered ? 4 : 2;
      viewer.montage.add(tube);

      const hitTube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 6, 2.8, 5, false),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
      );
      hitTube.userData.channelId = channel.id;
      viewer.montage.add(hitTube);
    }

    const geometry = new THREE.SphereGeometry(2.55, 14, 10);
    const sourceMaterial = new THREE.MeshStandardMaterial({ color: '#ef2b2d', roughness: 0.28 });
    const detectorMaterial = new THREE.MeshStandardMaterial({ color: '#2f85bd', roughness: 0.28 });
    for (const optode of optodes) {
      if (shortDetectorIds.has(optode.id)) continue;
      if (optode.type === 'source' && !showSources) continue;
      if (optode.type === 'detector' && !showDetectors) continue;
      const marker = new THREE.Mesh(geometry, optode.type === 'source' ? sourceMaterial : detectorMaterial);
      marker.position.copy(mniToThree(optode.mni));
      marker.renderOrder = 5;
      viewer.montage.add(marker);
    }
  }, [activeChannelId, channels, hoveredChannelId, optodes, shortDetectorIds, showDetectors, showSources, status]);

  const resetView = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.camera.position.copy(CAMERA_POSITION);
    viewer.controls.target.copy(CAMERA_TARGET);
    viewer.controls.update();
  };

  return (
    <div className="brain-viewer" role="img" aria-label="Interactive 3D ICBM152 brain with the MULPA optode montage">
      <div className="brain-canvas" ref={hostRef} />
      <div className="brain-viewer-guide">
        <span><i className="mouse-icon" aria-hidden="true" /> Drag to rotate · scroll to zoom · hover and click a channel</span>
        <button type="button" onClick={resetView}>Reset view</button>
      </div>
      <div className={`brain-load-state ${status}`} aria-live="polite">
        {status === 'loading' && 'Loading ICBM152 surface…'}
        {status === 'error' && 'The brain surface could not be loaded.'}
      </div>
    </div>
  );
}
