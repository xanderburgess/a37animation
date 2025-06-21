import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import AsciiRenderer from './asciirenderer.js';

const ThreeScene = () => {
    const containerRef = useRef(null);
    
    const FIXED_COLS = 150;
    const FIXED_ROWS = 150;
    const FIXED_ASPECT_RATIO = FIXED_COLS / FIXED_ROWS;

    useEffect(() => {
        if (!containerRef.current) return;

        const asciiRenderer = new AsciiRenderer(containerRef.current.id, FIXED_COLS, FIXED_ROWS);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(50, FIXED_ASPECT_RATIO, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ alpha: true });
        renderer.setClearColor(0x000000, 0);
        
        const setRendererSize = () => {
            const width = window.innerWidth;
            const height = window.innerWidth / FIXED_ASPECT_RATIO;
            
            if (height > window.innerHeight) {
                const newWidth = window.innerHeight * FIXED_ASPECT_RATIO;
                renderer.setSize(newWidth, window.innerHeight);
            } else {
                renderer.setSize(width, height);
            }
        };
        
        setRendererSize();
        renderer.domElement.style.display = 'none';
        document.body.appendChild(renderer.domElement);

        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.3;

        const loader = new GLTFLoader();
        let model;
        let rafId;
        let lastFrameTime = 0;
        const targetFPS = 16;
        let currentRotationSpeed = 0.003;
        let targetRotationSpeed = 0.003;

        // Mouse tracking for axis tilt
        let mouseX = 0;
        let mouseY = 0;
        let targetTiltX = 0;
        let targetTiltZ = 0;
        let currentTiltX = 0;
        let currentTiltZ = 0;
        const maxTilt = 0.12; // Increased for more noticeable all-directional tilting
        const tiltSmoothness = 0.06; // Slightly slower for smoother feel
        
        // Pivot group for proper center rotation
        let pivotGroup;

        function loadModel(path) {
            loader.load(path, (gltf) => {
                if (model) {
                    if (pivotGroup) scene.remove(pivotGroup);
                }
                
                model = gltf.scene;
        
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const scale = 78 / maxDim;
                
                model.scale.setScalar(scale);
                model.position.sub(center.multiplyScalar(scale));
                
                // Create a pivot group that will handle all rotations
                pivotGroup = new THREE.Group();
                pivotGroup.add(model);
                
                // Position the entire pivot group (moved higher to center properly)
                pivotGroup.position.set(-.5, 0, -10);
                pivotGroup.rotation.x = 0.275; // Base rotation
                
                // Store base rotation for reference
                pivotGroup.userData.baseRotationX = 0.275;
        
                model.traverse((child) => {
                    if (child.isMesh) {
                        child.material.metalness = 0.3;
                        child.material.roughness = 0.7;
                        child.material.color.setRGB(1, 1, 1);
                        child.material.needsUpdate = true;
                    }
                });
        
                scene.add(pivotGroup);
            });
        }

        const lights = [
            // Blue light
            {
                color: 0xffffff,
                intensity: 50,
                pos: [0, 0, 40],
                distance: 48,
                decay: 1.0,
            },
            // Blue light
            {
                color: 0xffffff,
                intensity: 60,
                pos: [-20, 15, 13],
                distance: 48,
                decay: 1.0,
            },
            // Pink light
            {
                color: 0xffffff,
                intensity: 40,
                pos: [10, -10, 10],
                distance: 35,
                decay: 1.0
            },
            // Orange/warm light
            {
                color: 0xffffff,
                intensity: 20,
                pos: [1, 65, 20],
                distance: 130,
                decay: 0.6
            }
        ];

        lights.forEach(light => {
            const pointLight = new THREE.PointLight(
                light.color,
                light.intensity,
                light.distance,
                light.decay
            );
            pointLight.position.set(...light.pos);
            scene.add(pointLight);
        });
        
        const offscreenCanvas = document.createElement('canvas');
        const offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
        offscreenCanvas.width = FIXED_COLS;
        offscreenCanvas.height = FIXED_ROWS;

        const worker = new Worker('/asciiworker.js');
        worker.onmessage = (event) => {
            asciiRenderer.render(event.data.pixels);
        };

        function render(timestamp) {
            if (timestamp - lastFrameTime < 1000 / targetFPS) {
                rafId = requestAnimationFrame(render);
                return;
            }
            lastFrameTime = timestamp;

            if (pivotGroup) {
                // Smooth rotation speed for Y-axis spinning
                currentRotationSpeed = currentRotationSpeed + (targetRotationSpeed - currentRotationSpeed) * 0.05;
                pivotGroup.rotation.y += currentRotationSpeed;
                
                // Smooth mouse-following tilts
                currentTiltX += (targetTiltX - currentTiltX) * tiltSmoothness;
                currentTiltZ += (targetTiltZ - currentTiltZ) * tiltSmoothness;
                
                // Apply base rotation plus subtle mouse tilts
                pivotGroup.rotation.x = pivotGroup.userData.baseRotationX + currentTiltX;
                pivotGroup.rotation.z = currentTiltZ;
            }

            renderer.render(scene, camera);

            offscreenCtx.imageSmoothingEnabled = false;
            offscreenCtx.fillStyle = 'black';
            offscreenCtx.fillRect(0, 0, FIXED_COLS, FIXED_ROWS);
            
            offscreenCtx.drawImage(renderer.domElement, 
                0, 0, renderer.domElement.width, renderer.domElement.height,
                0, 0, FIXED_COLS, FIXED_ROWS
            );
            
            const imageData = offscreenCtx.getImageData(0, 0, FIXED_COLS, FIXED_ROWS);
            worker.postMessage({ 
                pixels: imageData.data, 
                width: FIXED_COLS, 
                height: FIXED_ROWS 
            });
            
            rafId = requestAnimationFrame(render);
        }

        const handleMouseMove = (e) => {
            // Calculate normalized mouse position (-1 to 1)
            mouseX = (e.clientX / window.innerWidth) * 2 - 1;
            mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
            
            // Calculate tilts for all directions based on mouse position
            targetTiltX = mouseY * maxTilt; // Up/down mouse controls X-axis tilt (forward/back)
            targetTiltZ = -mouseX * maxTilt; // Left/right mouse controls Z-axis tilt (side to side) - inverted for natural feel
            
            // Keep rotation speed based on horizontal mouse position for spinning
            const windowCenterX = window.innerWidth / 2;
            targetRotationSpeed = 0.005 * (e.clientX > windowCenterX ? 1 : -1);
        };

        const handleResize = () => {
            camera.aspect = FIXED_ASPECT_RATIO;
            camera.updateProjectionMatrix();
            setRendererSize();
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('resize', handleResize);

        camera.position.set(0, 0, 90);
        loadModel('/assets/small3.glb');
        render();

        // Cleanup
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('resize', handleResize);
            worker.terminate();
            cancelAnimationFrame(rafId);
            renderer.dispose();
        };
    }, []);

    return <div id="ascii-container" ref={containerRef}></div>;
};

export default ThreeScene;
