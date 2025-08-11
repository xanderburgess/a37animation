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
    const [exportSize, setExportSize] = useState(2); // 2x by default
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
        { path: '/assets/forge.glb', name: 'Forge' },
        { path: '/assets/earth.glb', name: 'Globe' },
        { path: '/assets/cubes.glb', name: 'Cubes' },
        { path: '/assets/mesh.glb', name: 'Mesh' },
        { path: '/assets/diamonds.glb', name: 'Diamonds' },
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
            position: 'relative'
        }}>
            <style>{`
                .square-slider-container {
                    position: relative;
                    width: 100%;
                    height: 8px;
                    background: #333;
                    border-radius: 4px;
                }
                .square-slider {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 100%;
                    height: 8px;
                    background: transparent;
                    outline: none;
                    cursor: pointer;
                    border-radius: 4px;
                    position: absolute;
                    top: 0;
                    left: 0;
                }
                .square-slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 14px;
                    height: 14px;
                    background: white;
                    border-radius: 2px;
                    cursor: pointer;
                    border: none;
                    margin-top: -3px;
                }
                .square-slider::-moz-range-thumb {
                    width: 14px;
                    height: 14px;
                    background: white;
                    border-radius: 2px;
                    cursor: pointer;
                    border: none;
                    margin-top: -3px;
                }
                .model-button {
                    background: #1F1F1F;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    padding: 10px 12px;
                    font-family: 'IBM Plex Mono', monospace;
                    font-size: 12px;
                    cursor: pointer;
                    outline: none;
                    width: 100%;
                    text-align: center;
                    transition: all 0.2s ease;
                    height: 36px;
                    box-sizing: border-box;
                }
                .model-button:hover {
                    background: #555;
                }
                .model-button.active {
                    background: #454545;
                    color: white;
                }
                .light-button {
                    background: #1F1F1F;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    padding: 10px 12px;
                    font-family: 'IBM Plex Mono', monospace;
                    font-size: 12px;
                    cursor: pointer;
                    outline: none;
                    width: 100%;
                    text-align: center;
                    transition: all 0.2s ease;
                    height: 36px;
                    box-sizing: border-box;
                }
                .light-button:hover {
                    background: #555;
                }
                .light-button.active {
                    background: #454545;
                    color: white;
                }
                .export-button {
                    background: white;
                    color: black;
                    border: none;
                    border-radius: 4px;
                    padding: 10px 6px 10px 12px;
                    font-family: 'IBM Plex Mono', monospace;
                    font-size: 12px;
                    cursor: pointer;
                    outline: none;
                    width: 100%;
                    text-align: center;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    height: 36px;
                    box-sizing: border-box;
                }
                .export-button:hover {
                    background: #f0f0f0;
                }
                .size-button {
                    background: #333;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    padding: 8px 12px;
                    font-family: 'IBM Plex Mono', monospace;
                    font-size: 12px;
                    cursor: pointer;
                    outline: none;
                    width: 100%;
                    text-align: center;
                    transition: all 0.2s ease;
                }
                .size-button:hover {
                    background: #555;
                }
                .size-button.active {
                    background: white;
                    color: black;
                }
                .transparent-button {
                    background: #333;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    padding: 8px 12px;
                    font-family: 'IBM Plex Mono', monospace;
                    font-size: 12px;
                    cursor: pointer;
                    outline: none;
                    width: 100%;
                    text-align: center;
                    transition: all 0.2s ease;
                }
                .transparent-button:hover {
                    background: #555;
                }
                .transparent-button.active {
                    background: white;
                    color: black;
                }
            `}</style>
            
            {/* Full-screen ASCII Container */}
            <div id="ascii-container" ref={containerRef} style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 0
            }}></div>
            
            {/* Left Column - Logo and Model Settings */}
            <div style={{
                position: 'absolute',
                top: '20px',
                left: '20px',
                width: '250px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                zIndex: 10
            }}>
                {/* Logo Box */}
                <div style={{
                    background: 'black',
                    borderRadius: '8px',
                    padding: '16px',
                    color: 'white',
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontSize: '14px',
                    width: '218px'
                }}>
                    <img 
                        src="/a37-Logo_a37_White.svg" 
                        alt="a37" 
                        style={{ 
                            height: '20px', 
                            width: 'auto',
                            alignSelf: 'flex-start'
                        }} 
                    />
                    <div style={{ color: '#999', fontSize: '12px', marginTop: '4px' }}>
                        Asset Generator
                    </div>
                </div>
                
                {/* Model Settings Box */}
                <div style={{
                    background: 'black',
                    borderRadius: '8px',
                    padding: '16px',
                    color: 'white',
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontSize: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    width: '218px'
                }}>
                    <div style={{ color: '#999', fontSize: '12px' }}>
                        Model Settings
                    </div>
                    
                    {/* Divider line */}
                    <div style={{
                        width: 'calc(100% + 32px)',
                        height: '1px',
                        background: '#333',
                        margin: '0 -16px'
                    }}></div>
                    
                    <div>
                        <label style={{ display: 'block', marginBottom: '12px', color: '#999', fontSize: '12px' }}>
                            Model
                        </label>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '8px'
                        }}>
                            {availableModels.map((model) => (
                                <button
                                    key={model.path}
                                    onClick={() => setSelectedModel(model.path)}
                                    className={`model-button ${selectedModel === model.path ? 'active' : ''}`}
                                >
                                    {model.name}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <div>
                        <label style={{ display: 'block', marginBottom: '12px', color: '#999', fontSize: '12px' }}>
                            Zoom
                            <span style={{ float: 'right', color: '#fff' }}>{zoom}</span>
                        </label>
                        <div className="square-slider-container">
                            <input 
                                type="range" 
                                min="-100" 
                                max="150" 
                                value={zoom}
                                onChange={(e) => setZoom(Number(e.target.value))}
                                className="square-slider"
                            />
                        </div>
                    </div>
                    
                    <div>
                        <label style={{ display: 'block', marginBottom: '12px', color: '#999', fontSize: '12px' }}>
                            Rotation Speed
                            <span style={{ float: 'right', color: '#fff' }}>{rotationSpeed.toFixed(3)}</span>
                        </label>
                        <div className="square-slider-container">
                            <input 
                                type="range" 
                                min="0.005" 
                                max="0.03" 
                                step="0.001"
                                value={rotationSpeed}
                                onChange={(e) => setRotationSpeed(Number(e.target.value))}
                                className="square-slider"
                            />
                        </div>
                    </div>
                    
                    <div>
                        <label style={{ display: 'block', marginBottom: '12px', color: '#999', fontSize: '12px' }}>
                            Lights
                        </label>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            gap: '8px'
                        }}>
                            {lightStates.map((state, index) => (
                                <button
                                    key={index}
                                    onClick={() => toggleLight(index)}
                                    className={`light-button ${state ? 'active' : ''}`}
                                >
                                    {String(index + 1).padStart(2, '0')}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Export Settings Box - Right side, same width as model settings */}
            <div style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                width: '250px',
                background: 'black',
                borderRadius: '8px',
                padding: '16px',
                color: 'white',
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                zIndex: 10,
                width: '218px'
            }}>
                <div style={{ color: '#999', fontSize: '12px' }}>
                    Export Settings
                </div>
                
                {/* Divider line */}
                <div style={{
                    width: 'calc(100% + 32px)',
                    height: '1px',
                    background: '#333',
                    margin: '0 -16px'
                }}></div>
                
                <div>
                    <label style={{ display: 'block', marginBottom: '12px', color: '#999', fontSize: '12px' }}>
                        Size
                    </label>
                    <div style={{ position: 'relative' }}>
                        <select
                            value={exportSize}
                            onChange={(e) => setExportSize(Number(e.target.value))}
                            style={{
                                width: '100%',
                                background: '#333',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '10px 12px',
                                paddingRight: '40px',
                                fontFamily: 'IBM Plex Mono, monospace',
                                fontSize: '12px',
                                cursor: 'pointer',
                                outline: 'none',
                                WebkitAppearance: 'none',
                                MozAppearance: 'none',
                                appearance: 'none',
                                height: '36px',
                                boxSizing: 'border-box'
                            }}
                        >
                            <option value={0.5}>0.5x (1200px)</option>
                            <option value={1}>1x (2400px)</option>
                            <option value={2}>2x (4800px)</option>
                            <option value={3}>3x (7200px)</option>
                            <option value={4}>4x (9600px)</option>
                            <option value={8}>8x (19200px)</option>
                        </select>
                        <div style={{
                            position: 'absolute',
                            right: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            pointerEvents: 'none',
                            color: 'white',
                            fontSize: '12px'
                        }}>
                            ▼
                        </div>
                    </div>
                </div>
                
                <div>
                    <label style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        cursor: 'pointer',
                        color: '#999',
                        fontSize: '12px'
                    }}>
                        <input 
                            type="checkbox"
                            checked={transparentBackground}
                            onChange={(e) => setTransparentBackground(e.target.checked)}
                            style={{
                                width: '14px',
                                height: '14px',
                                accentColor: 'white'
                            }}
                        />
                        Transparent Background
                    </label>
                </div>
                
                <button 
                    onClick={handleExportImage}
                    className="export-button"
                >
                    <span>Export</span>
                    <span style={{ 
                        background: '#333', 
                        color: 'white', 
                        padding: '6px 10px', 
                        borderRadius: '4px',
                        fontSize: '10px'
                    }}>E</span>
                </button>
                
                <div style={{ 
                    color: '#666', 
                    fontSize: '10px',
                    textAlign: 'center'
                }}>
                    Press E on your keyboard to export
                </div>
            </div>
            
            {/* Copyright text - Bottom right of viewport */}
            <div style={{
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                color: '#999999',
                fontSize: '12px',
                fontFamily: 'IBM Plex Mono, monospace',
                zIndex: 10
            }}>
                © 2025 a37 Inc.
            </div>
        </div>
    );
};

export default ThreeScene;