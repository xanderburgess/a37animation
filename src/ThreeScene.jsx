import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import AsciiRenderer from './asciirenderer.js';

const ThreeScene = () => {
    const containerRef = useRef(null);
    const [zoom, setZoom] = useState(110);
    const [rotationSpeed, setRotationSpeed] = useState(0.015);
    const [lightStates, setLightStates] = useState([true, true, true, true]);
    const [selectedModel, setSelectedModel] = useState('/assets/earth.glb');
    const [exportSize, setExportSize] = useState(2); // 1x by default
    const [transparentBackground, setTransparentBackground] = useState(false);
    const asciiRendererRef = useRef(null);
    const cameraRef = useRef(null);
    const lightsRef = useRef([]);
    const rotationSpeedRef = useRef(rotationSpeed);
    const sceneRef = useRef(null);
    const rendererRef = useRef(null);
    const pivotGroupRef = useRef(null);
    const exportSizeRef = useRef(exportSize);
    const transparentBackgroundRef = useRef(transparentBackground);
    
    // Available models from your assets folder
    const availableModels = [
        { path: '/assets/city.glb', name: 'City' },
        { path: '/assets/cubes.glb', name: 'Cubes' },
        { path: '/assets/diamonds.glb', name: 'Diamonds' },
        { path: '/assets/earth.glb', name: 'Earth' },
        { path: '/assets/forge.glb', name: 'Forge' },
        { path: '/assets/mesh.glb', name: 'Mesh' },
        { path: '/assets/prisms.glb', name: 'Prisms' },
        { path: '/assets/rotations.glb', name: 'Rotations' },
        { path: '/assets/swirls.glb', name: 'Swirls' },
        { path: '/assets/triangles.glb', name: 'Triangles' },
    ];
    
    // Update the refs when states change
    useEffect(() => {
        rotationSpeedRef.current = rotationSpeed;
    }, [rotationSpeed]);
    
    useEffect(() => {
        exportSizeRef.current = exportSize;
    }, [exportSize]);
    
    useEffect(() => {
        transparentBackgroundRef.current = transparentBackground;
    }, [transparentBackground]);
    
    const FIXED_COLS = 267;
    const FIXED_ROWS = 150;
    const FIXED_ASPECT_RATIO = FIXED_COLS / FIXED_ROWS;

    const handleExportImage = () => {
        // Create a NEW ASCII renderer at the export resolution for crisp rendering
        const currentExportSize = exportSizeRef.current;
        const exportCols = FIXED_COLS;
        const exportRows = FIXED_ROWS;
        
        // Create a temporary container
        const tempContainer = document.createElement('div');
        tempContainer.id = 'temp-ascii-export';
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        document.body.appendChild(tempContainer);
        
        // Import AsciiRenderer dynamically to create a high-res version
        import('./asciirenderer.js').then((module) => {
            const AsciiRenderer = module.default;
            const exportRenderer = new AsciiRenderer(tempContainer.id, exportCols, exportRows);
            
            // Calculate exact dimensions
            const targetWidth = 2400 * currentExportSize;
            const spacingFactor = exportRenderer.spacingFactor || 1.2;
            const rowSpacingFactor = exportRenderer.rowSpacingFactor || 1.2;
            
            // Calculate the exact character width needed (as float)
            const exactCharWidth = targetWidth / (exportCols * spacingFactor);
            const charWidth = Math.floor(exactCharWidth);
            const charHeight = charWidth;
            
            // Calculate what the actual width would be with integer char sizes
            const actualWidthWithIntChar = exportCols * charWidth * spacingFactor;
            
            // Force exact target dimensions
            const finalWidth = targetWidth;
            const finalHeight = Math.round(targetWidth / FIXED_ASPECT_RATIO);
            
            // Update the export renderer's properties
            const dpr = 1;
            exportRenderer.charWidth = charWidth;
            exportRenderer.charHeight = charHeight;
            
            // Set canvas to exact target size
            exportRenderer.canvas.width = finalWidth;
            exportRenderer.canvas.height = finalHeight;
            exportRenderer.canvas.style.width = `${finalWidth}px`;
            exportRenderer.canvas.style.height = `${finalHeight}px`;
            
            // Calculate scaling to fit exact dimensions
            const scaleX = finalWidth / actualWidthWithIntChar;
            const scaleY = finalHeight / (exportRows * charHeight * rowSpacingFactor);
            
            exportRenderer.ctx.scale(scaleX, scaleY);
            exportRenderer.ctx.font = `${charHeight}px "IBM Plex Mono"`;
            exportRenderer.ctx.textBaseline = 'top';
            
            // Copy mouse trail data to export renderer
            if (asciiRendererRef.current.mouseTrail) {
                exportRenderer.mouseTrail = [...asciiRendererRef.current.mouseTrail];
                exportRenderer.mouseX = asciiRendererRef.current.mouseX;
                exportRenderer.mouseY = asciiRendererRef.current.mouseY;
                exportRenderer.mouseMoving = asciiRendererRef.current.mouseMoving;
            }
            
            // Create high-res offscreen canvas for Three.js rendering
            const highResCanvas = document.createElement('canvas');
            const highResCtx = highResCanvas.getContext('2d', { willReadFrequently: true });
            highResCanvas.width = exportCols;
            highResCanvas.height = exportRows;
            
            // Render the current Three.js scene at the export resolution
            rendererRef.current.render(sceneRef.current, cameraRef.current);
            
            highResCtx.imageSmoothingEnabled = false;
            highResCtx.fillStyle = 'black';
            highResCtx.fillRect(0, 0, exportCols, exportRows);
            highResCtx.drawImage(rendererRef.current.domElement, 
                0, 0, rendererRef.current.domElement.width, rendererRef.current.domElement.height,
                0, 0, exportCols, exportRows
            );
            
            const imageData = highResCtx.getImageData(0, 0, exportCols, exportRows);
            
            // Render using the high-res ASCII renderer
            exportRenderer.render(imageData.data);
            
            // Now export the high-res ASCII canvas
            const exportCanvas = document.createElement('canvas');
            const exportCtx = exportCanvas.getContext('2d');
            
            exportCanvas.width = finalWidth;
            exportCanvas.height = finalHeight;
            
            // Clear for transparency
            exportCtx.clearRect(0, 0, finalWidth, finalHeight);
            
            if (transparentBackgroundRef.current) {
                // Copy and make white transparent
                exportCtx.drawImage(exportRenderer.canvas, 0, 0);
                const imageData = exportCtx.getImageData(0, 0, finalWidth, finalHeight);
                const data = imageData.data;
                
                for (let i = 0; i < data.length; i += 4) {
                    if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) {
                        data[i + 3] = 0;
                    }
                }
                
                exportCtx.putImageData(imageData, 0, 0);
            } else {
                // White background
                exportCtx.fillStyle = 'white';
                exportCtx.fillRect(0, 0, finalWidth, finalHeight);
                exportCtx.drawImage(exportRenderer.canvas, 0, 0);
            }
            
            // Export as PNG
            exportCanvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `a37_${currentExportSize}x.png`;
                a.click();
                URL.revokeObjectURL(url);
                
                // Cleanup
                document.body.removeChild(tempContainer);
            }, 'image/png');
        });
    };

    const toggleLight = (index) => {
        const newStates = [...lightStates];
        newStates[index] = !newStates[index];
        setLightStates(newStates);
        
        if (lightsRef.current[index]) {
            lightsRef.current[index].visible = newStates[index];
        }
    };

    useEffect(() => {
        if (!containerRef.current) return;

        const asciiRenderer = new AsciiRenderer(containerRef.current.id, FIXED_COLS, FIXED_ROWS);
        asciiRendererRef.current = asciiRenderer;

        // Keyboard shortcut handler
        const handleKeyPress = (e) => {
            if (e.key.toLowerCase() === 'e') {
                handleExportImage();
            }
        };
        window.addEventListener('keydown', handleKeyPress);

        const scene = new THREE.Scene();
        sceneRef.current = scene;
        const camera = new THREE.PerspectiveCamera(50, FIXED_ASPECT_RATIO, 0.1, 1000);
        cameraRef.current = camera;
        const renderer = new THREE.WebGLRenderer({ alpha: true });
        rendererRef.current = renderer;
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

        // Mouse tracking for axis tilt
        let mouseX = 0;
        let mouseY = 0;
        let targetTiltX = 0;
        let targetTiltZ = 0;
        let currentTiltX = 0;
        let currentTiltZ = 0;
        let currentRotationSpeed = 0.003;
        let targetRotationSpeed = 0.003;
        const maxTilt = 0.16; // Increased for more noticeable all-directional tilting
        const tiltSmoothness = 0.06; // Slightly slower for smoother feel
        
        // Pivot group for proper center rotation
        let pivotGroup;

        function loadModel(path) {
            loader.load(path, (gltf) => {
                if (model) {
                    if (pivotGroupRef.current) scene.remove(pivotGroupRef.current);
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
                pivotGroupRef.current = pivotGroup;
                
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

        lightsRef.current = [];
        lights.forEach((light, index) => {
            const pointLight = new THREE.PointLight(
                light.color,
                light.intensity,
                light.distance,
                light.decay
            );
            pointLight.position.set(...light.pos);
            pointLight.visible = lightStates[index];
            scene.add(pointLight);
            lightsRef.current.push(pointLight);
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

            if (pivotGroupRef.current) {
                // Smooth rotation speed for Y-axis spinning
                currentRotationSpeed = currentRotationSpeed + (targetRotationSpeed - currentRotationSpeed) * 0.05;
                pivotGroupRef.current.rotation.y += currentRotationSpeed;
                
                // Smooth mouse-following tilts
                currentTiltX += (targetTiltX - currentTiltX) * tiltSmoothness;
                currentTiltZ += (targetTiltZ - currentTiltZ) * tiltSmoothness;
                
                // Apply base rotation plus subtle mouse tilts
                pivotGroupRef.current.rotation.x = pivotGroupRef.current.userData.baseRotationX + currentTiltX;
                pivotGroupRef.current.rotation.z = currentTiltZ;
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
            targetRotationSpeed = rotationSpeedRef.current * (e.clientX > windowCenterX ? 1 : -1);
        };

        const handleResize = () => {
            camera.aspect = FIXED_ASPECT_RATIO;
            camera.updateProjectionMatrix();
            setRendererSize();
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('resize', handleResize);

        camera.position.set(0, 0, zoom);
        // Don't load model here - let the other useEffect handle it
        render();

        // Cleanup
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('keydown', handleKeyPress);
            worker.terminate();
            cancelAnimationFrame(rafId);
            renderer.dispose();
        };
    }, []); // Remove selectedModel from dependencies

    // Update model when selection changes
    useEffect(() => {
        if (sceneRef.current && rendererRef.current && asciiRendererRef.current) {
            const loader = new GLTFLoader();
            loader.load(selectedModel, (gltf) => {
                // Remove old model
                if (pivotGroupRef.current) {
                    sceneRef.current.remove(pivotGroupRef.current);
                }
                
                const model = gltf.scene;
                
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const scale = 78 / maxDim;
                
                model.scale.setScalar(scale);
                model.position.sub(center.multiplyScalar(scale));
                
                // Create a pivot group that will handle all rotations
                const pivotGroup = new THREE.Group();
                pivotGroup.add(model);
                pivotGroupRef.current = pivotGroup;
                
                // Position the entire pivot group
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
                
                sceneRef.current.add(pivotGroup);
            });
        }
    }, [selectedModel]);
    
    // Update camera position when zoom changes
    useEffect(() => {
        if (cameraRef.current) {
            cameraRef.current.position.set(0, 0, zoom);
        }
    }, [zoom]);

    // Update light visibility when states change
    useEffect(() => {
        lightsRef.current.forEach((light, index) => {
            if (light) {
                light.visible = lightStates[index];
            }
        });
    }, [lightStates]);

    return (
        <div style={{
            width: '100vw',
            height: '100vh',
            padding: '20px',
            boxSizing: 'border-box',
            background: 'white',
            display: 'flex',
            gap: '20px',
            alignItems: 'stretch'
        }}>
            <style>{`
                .custom-slider {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 100%;
                    height: 6px;
                    background: #333;
                    outline: none;
                    cursor: pointer;
                    border-radius: 3px;
                }
                .custom-slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 20px;
                    height: 20px;
                    background: #666;
                    border-radius: 10px;
                    cursor: pointer;
                }
                .custom-slider::-moz-range-thumb {
                    width: 20px;
                    height: 20px;
                    background: #666;
                    border-radius: 10px;
                    cursor: pointer;
                    border: none;
                }
                .custom-select {
                    background: #333;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    padding: 8px 12px;
                    font-family: 'IBM Plex Mono', monospace;
                    font-size: 14px;
                    cursor: pointer;
                    outline: none;
                    width: 100%;
                }
                .custom-select option {
                    background: #222;
                    color: white;
                }
            `}</style>
            <div style={{
                flex: '0 0 250px',
                background: 'black',
                borderRadius: '8px',
                padding: '20px',
                color: 'white',
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: '14px',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <img 
                    src="/a37-Logo_a37_White.svg" 
                    alt="a37" 
                    style={{ 
                        height: '20px', 
                        width: 'auto',
                        marginBottom: '20px',
                        alignSelf: 'flex-start'
                    }} 
                />
                
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', color: '#999' }}>
                        Model
                    </label>
                    <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="custom-select"
                    >
                        {availableModels.map((model) => (
                            <option key={model.path} value={model.path}>
                                {model.name}
                            </option>
                        ))}
                    </select>
                </div>
                
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', color: '#999' }}>
                        Zoom: {zoom}
                    </label>
                    <input 
                        type="range" 
                        min="-100" 
                        max="150" 
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="custom-slider"
                    />
                </div>
                
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', color: '#999' }}>
                        Rotation Speed: {rotationSpeed.toFixed(3)}
                    </label>
                    <input 
                        type="range" 
                        min="0.005" 
                        max="0.03" 
                        step="0.001"
                        value={rotationSpeed}
                        onChange={(e) => setRotationSpeed(Number(e.target.value))}
                        className="custom-slider"
                    />
                </div>
                
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '10px', color: '#999' }}>
                        Lights:
                    </label>
                    {lightStates.map((state, index) => (
                        <div key={index} style={{ marginBottom: '5px' }}>
                            <label style={{ cursor: 'pointer', color: '#ccc' }}>
                                <input 
                                    type="checkbox" 
                                    checked={state}
                                    onChange={() => toggleLight(index)}
                                    style={{ 
                                        marginRight: '8px',
                                        filter: 'grayscale(100%)',
                                        opacity: '0.8'
                                    }}
                                />
                                Light {index + 1}
                            </label>
                        </div>
                    ))}
                </div>
                
                <div style={{ marginTop: 'auto' }}>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', color: '#999' }}>
                            Export Size
                        </label>
                        <select
                            value={exportSize}
                            onChange={(e) => setExportSize(Number(e.target.value))}
                            className="custom-select"
                        >
                            <option value={1}>1x (2400px)</option>
                            <option value={2}>2x (4800px)</option>
                            <option value={4}>4x (9600px)</option>
                            <option value={8}>8x (19200px)</option>
                        </select>
                    </div>
                    
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ cursor: 'pointer', color: '#ccc', display: 'flex', alignItems: 'center' }}>
                            <input 
                                type="checkbox" 
                                checked={transparentBackground}
                                onChange={(e) => setTransparentBackground(e.target.checked)}
                                style={{ 
                                    marginRight: '8px',
                                    filter: 'grayscale(100%)',
                                    opacity: '0.8'
                                }}
                            />
                            Transparent Background
                        </label>
                    </div>
                    
                    <button 
                        onClick={handleExportImage}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: 'white',
                            color: 'black',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: '500'
                        }}
                    >
                        <span>Export [E]</span>
                    </button>
                </div>
            </div>
            
            <div style={{
                flex: '1',
                background: 'white',
                border: '1px solid #D9D9D9',
                borderRadius: '8px',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
            }}>
                <div id="ascii-container" ref={containerRef} style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)'
                }}></div>
                <div style={{
                    position: 'absolute',
                    bottom: '10px',
                    right: '15px',
                    color: '#999999',
                    fontSize: '12px',
                    fontFamily: 'IBM Plex Mono, monospace'
                }}>
                    © 2025 a37 Inc.
                </div>
            </div>
        </div>
    );
};

export default ThreeScene;