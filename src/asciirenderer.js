class AsciiRenderer {
    constructor(containerId, cols = 180, rows = 90) {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.container = document.getElementById(containerId);
        this.container.appendChild(this.canvas);
        
        // Enhanced character set with block characters for darker areas
        this.CHAR_SET = [' ', '.', '3', '7', '□', '■', '7'];
        this.BRIGHTNESS_THRESHOLDS = [0, 0.04, 0.3, 0.5, 0.7, 0.85, 0.9];
        
        this.cols = cols;
        this.rows = rows;

        // Mouse tracking
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseMoving = false;
        this.mouseTimeout = null;
        this.hoverRadius = 10; // Larger radius for more visible effect
        
        // Mouse trail system
        this.mouseTrail = []; // Array to store recent mouse positions
        this.maxTrailLength = 20; // Longer trail for better stream effect
        this.trailDecayRate = 0.75; // Faster decay for more dynamic stream

        // Precalculate constants used in render loop
        this.contrast = 1.0;
        this.minBrightness = 0.1;
        this.minModelColor = 40;
        
        // Precalculate brightness coefficients
        this.rCoeff = 0.299;
        this.gCoeff = 0.587;
        this.bCoeff = 0.114;
        
        this.setupCanvas();
        this.setupMouseTracking();
        this.lastSetupTime = 0;
        this.resizeHandler = () => {
            const now = performance.now();
            if (now - this.lastSetupTime > 100) {
                this.setupCanvas();
                this.lastSetupTime = now;
            }
        };
        window.addEventListener('resize', this.resizeHandler);
    }
    
    setupCanvas() {
        this.canvas.style.backgroundColor = 'black';
        this.canvas.style.position = 'absolute';
        this.canvas.style.left = '50%';
        this.canvas.style.top = '50%';
        this.canvas.style.transform = 'translate(-50%, -50%)';
        
        const dpr = window.devicePixelRatio || 1;
        const charHeight = Math.floor(window.innerHeight / (this.rows * 1));
        const charWidth = Math.floor(charHeight * 1);
        
        this.spacingFactor = 1.2;
        this.rowSpacingFactor = 1.2;
        
        const newWidth = this.cols * (charWidth * this.spacingFactor) * dpr;
        const newHeight = this.rows * (charHeight * this.rowSpacingFactor) * dpr;
        
        if (this.canvas.width !== newWidth || this.canvas.height !== newHeight) {
            this.canvas.width = newWidth;
            this.canvas.height = newHeight;
            this.canvas.style.width = `${this.cols * (charWidth * this.spacingFactor)}px`;
            this.canvas.style.height = `${this.rows * (charHeight * this.rowSpacingFactor)}px`;
            
            this.ctx.scale(dpr, dpr);
            this.ctx.font = `${charHeight * 1}px "IBM Plex Mono"`;
            this.ctx.textBaseline = 'top';
        }
        
        this.charWidth = charWidth;
        this.charHeight = charHeight;
    }
    
    setupMouseTracking() {
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Convert to character coordinates
            const spaceX = this.charWidth * this.spacingFactor;
            const spaceY = this.charHeight * this.rowSpacingFactor;
            
            const newMouseX = Math.floor(x / spaceX);
            const newMouseY = Math.floor(y / spaceY);
            
            // Only add to trail if mouse position actually changed
            if (newMouseX !== this.mouseX || newMouseY !== this.mouseY) {
                // Add current position to trail
                this.mouseTrail.unshift({
                    x: newMouseX,
                    y: newMouseY,
                    timestamp: performance.now()
                });
                
                // Limit trail length
                if (this.mouseTrail.length > this.maxTrailLength) {
                    this.mouseTrail.pop();
                }
            }
            
            this.mouseX = newMouseX;
            this.mouseY = newMouseY;
            this.mouseMoving = true;
            
            // Clear previous timeout
            if (this.mouseTimeout) {
                clearTimeout(this.mouseTimeout);
            }
            
            // Set mouse as not moving after 100ms (much shorter for stream effect)
            this.mouseTimeout = setTimeout(() => {
                this.mouseMoving = false;
                // Don't clear trail immediately - let it fade naturally
            }, 100);
        });
        
        this.canvas.addEventListener('mouseleave', () => {
            this.mouseMoving = false;
            // Let trail fade naturally instead of clearing immediately
            if (this.mouseTimeout) {
                clearTimeout(this.mouseTimeout);
            }
        });
    }
    
    getCharacterForBrightness(brightness, x, y) {
        // Get the normal character first
        let normalChar;
        for (let i = this.BRIGHTNESS_THRESHOLDS.length - 1; i >= 0; i--) {
            if (brightness >= this.BRIGHTNESS_THRESHOLDS[i]) {
                normalChar = this.CHAR_SET[i];
                break;
            }
        }
        if (!normalChar) normalChar = this.CHAR_SET[0];
        
        // Only apply hover effect to non-space characters
        if (normalChar !== ' ') {
            const currentTime = performance.now();
            
            // Check trail positions (stream-focused approach)
            for (let i = 0; i < this.mouseTrail.length; i++) {
                const trailPoint = this.mouseTrail[i];
                const timeDelta = currentTime - trailPoint.timestamp;
                const ageEffect = Math.pow(this.trailDecayRate, i); // Start stronger, decay faster
                const timeEffect = Math.max(0, 1 - (timeDelta / 1500)); // Fade over 1.5 seconds
                
                const trailDx = x - trailPoint.x;
                const trailDy = y - trailPoint.y;
                const trailDistance = Math.sqrt(trailDx * trailDx + trailDy * trailDy);
                
                if (trailDistance <= this.hoverRadius) {
                    const normalizedTrailDistance = trailDistance / this.hoverRadius;
                    const spatialFalloff = 1 - (normalizedTrailDistance * normalizedTrailDistance);
                    
                    // Boost effect for recent trail points (creates stream-like behavior)
                    const streamBoost = i < 3 ? 1.5 : 1.0; // First 3 trail points get boosted
                    const combinedEffect = spatialFalloff * ageEffect * timeEffect * streamBoost;
                    const trailThreshold = combinedEffect * 0.6; // Higher base probability
                    
                    if (Math.random() < trailThreshold) {
                        return '■';
                    }
                }
            }
        }
        
        return normalChar;
    }
    
    adjustColor(color) {
        const normalized = color / 255;
        const brightened = normalized * (1 - this.minBrightness) + this.minBrightness;
        const contrasted = Math.min(1, Math.max(0, (brightened - 0.5) * this.contrast + 0.5));
        return Math.max(this.minModelColor, Math.round(contrasted * 255));
    }
    
    // Calculate lighter color for distant areas (depth perception)
    getLighterColorForDepth(colorR, colorG, colorB, char, x, y) {
        // Darken hover characters to make them stand out
        if (char === '/') {
            const darkenFactor = 0.4; // How much to darken (0 = black, 1 = original)
            return {
                r: Math.round(colorR * darkenFactor),
                g: Math.round(colorG * darkenFactor),
                b: Math.round(colorB * darkenFactor)
            };
        }
        
        // Dots represent distant/faint areas - make them much lighter
        if (char === '.') {
            const lightenFactor = 0.6; // How much to lighten (0 = no change, 1 = white)
            return {
                r: Math.round(colorR + (255 - colorR) * lightenFactor),
                g: Math.round(colorG + (255 - colorG) * lightenFactor),
                b: Math.round(colorB + (255 - colorB) * lightenFactor)
            };
        }
        // All other characters maintain original color
        return { r: colorR, g: colorG, b: colorB };
    }
    
    render(pixels) {
        // Keep original white background
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        const spaceX = this.charWidth * this.spacingFactor;
        const spaceY = this.charHeight * this.rowSpacingFactor;
        
        let i, r, g, b, a, colorR, colorG, colorB, brightness, char, finalColor;
        
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                i = (y * this.cols + x) * 4;
                a = pixels[i + 3];
                
                if (a > 0) {
                    r = pixels[i];
                    g = pixels[i + 1];
                    b = pixels[i + 2];
                    
                    colorR = this.adjustColor(r);
                    colorG = this.adjustColor(g);
                    colorB = this.adjustColor(b);
                    
                    brightness = (this.rCoeff * r + this.gCoeff * g + this.bCoeff * b) / 255;
                    char = this.getCharacterForBrightness(brightness, x, y);
                    
                    // Apply depth-based color lightening and hover effects
                    finalColor = this.getLighterColorForDepth(colorR, colorG, colorB, char, x, y);
                    
                    this.ctx.fillStyle = `rgb(${finalColor.r},${finalColor.g},${finalColor.b})`;
                    this.ctx.fillText(
                        char,
                        x * spaceX,
                        y * spaceY
                    );
                }
            }
        }
    }
}

export default AsciiRenderer;