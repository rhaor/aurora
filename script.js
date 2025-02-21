// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('Aurora Borealis Explorer initialized');

    const navButtons = document.querySelectorAll('.nav-btn');
    
    function switchPage(pageId) {
        // Hide all pages
        document.querySelectorAll('.tutorial-page, .sim-page').forEach(page => {
            page.classList.remove('active');
        });
        
        // Show selected pages
        document.getElementById(pageId).classList.add('active');
        document.getElementById(pageId + '-sim').classList.add('active');
        
        // Update navigation buttons
        navButtons.forEach(btn => {
            btn.classList.remove('active');
            if(btn.dataset.page === pageId) {
                btn.classList.add('active');
            }
        });

        // Initialize canvas when switching to sun page
        if (pageId === 'sun') {
            resizeCanvas();
            initParticles();
            if (!animationFrameId) {
                animate();
        }
        }

        if (pageId === 'magnetic') {
            resizeMagneticCanvas();
            initMagneticParticles();
            initMagneticField();
            if (!magneticAnimationFrameId) {
                animateMagnetic();
            }
        }

        if (pageId === 'particles') {
            initParticlesSim();
            initAtmosphereAnimation();
        }

        if (pageId === 'together') {
            resizeCombinedCanvas();
            initCombinedParticles();
            if (!combinedAnimationFrameId) {
                animateCombined();
            }
        }
    }
    
    // Add click handlers to navigation buttons
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            switchPage(button.dataset.page);
        });
    });

    // Solar wind controls
    const windStrengthSlider = document.getElementById('windStrength');
    const windSpeedValue = document.getElementById('windSpeedValue');
    const solarFlareBtn = document.getElementById('solarFlareBtn');

    // Particle System
    const canvas = document.getElementById('particleCanvas');
    const ctx = canvas.getContext('2d');
    let particles = [];
    let animationFrameId;
    let isFlareActive = false;
    
    // Resize canvas to match container
    function resizeCanvas() {
        const container = document.querySelector('.simulation-content');
        canvas.width = container.offsetWidth;
        canvas.height = container.offsetHeight;
        console.log('Container size:', container.offsetWidth, container.offsetHeight);
    }
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    class Particle {
        constructor(x, y, isFlareParticle = false) {
            this.x = x;
            this.y = y;
            this.size = Math.random() * 1.5 + 0.5; // Same size for all particles
            this.baseSpeed = isFlareParticle ? 4 : 2; // Keep flare particles faster
            this.isFlareParticle = isFlareParticle;
            // Brighter colors for flare particles but same size
            if (isFlareParticle) {
                this.color = Math.random() > 0.5 ? 
                    'rgba(255, 255, 255, 0.9)' : 
                    'rgba(255, 255, 0, 0.9)';
            } else {
                this.color = Math.random() > 0.5 ? 
                    'rgba(255, 255, 255, 0.6)' : 
                    'rgba(255, 255, 0, 0.6)';
            }
            this.leakImmunity = 0;
            this.fadeState = 'stable';
            this.opacity = isFlareParticle ? 0.1 : 0.6;
        }

        getEmissionX() {
            return 300;
        }

        getEmissionY() {
            // Add some randomness to emission position
            const spread = 160;
            const centerY = canvas.height / 2;
            return centerY + (Math.random() - 0.5) * spread + Math.sin(Date.now() * 0.001) * 20;
        }

        update(windSpeed) {
            let speedMultiplier = (windSpeed / 400) * this.baseSpeed;
            this.x += speedMultiplier * 5;
            
            if (this.x > canvas.width - 50) {
                if (this.isFlareParticle) {
                    // Remove flare particles when they go off screen
                    return false;
                } else {
                    this.x = this.getEmissionX();
                    this.y = this.getEmissionY();
                }
            }
            return true;
        }

        draw(context = ctx) {
            // Draw glow with current opacity
            context.beginPath();
            context.arc(this.x, this.y, this.size + 2, 0, Math.PI * 2);
            context.fillStyle = this.color.replace(
                this.opacity.toString(),
                (this.opacity * 0.5).toString()
            );
            context.fill();

            // Draw core
            context.beginPath();
            context.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            context.fillStyle = this.color;
            context.fill();
        }

        updateMagnetic(windSpeed) {
            // Handle opacity transitions
            if (this.fadeState === 'in' && this.opacity < 0.9) {
                this.opacity += 0.05;
            } else if (this.fadeState === 'out' && this.opacity > 0) {
                this.opacity -= 0.05;
                if (this.opacity <= 0) return false;
            }

            // Update color with current opacity
            const baseColor = this.isFlareParticle ? 
                (Math.random() > 0.5 ? '255, 255, 255' : '255, 255, 0') :
                (this.color.includes('255, 255, 255') ? '255, 255, 255' : '255, 255, 0');
            this.color = `rgba(${baseColor}, ${this.opacity})`;

            let speedMultiplier = (windSpeed / 400) * this.baseSpeed;
            if (this.isFlareParticle) {
                speedMultiplier *= 2.5;
            }

            const earthX = magneticCanvas.width - 150;
            const earthY = magneticCanvas.height / 2;
            
            // Check if particle should "leak" towards poles
            const leakCheckZone = 50;
            if (!this.isLeaking && 
                this.x > earthX - leakCheckZone && 
                this.x < earthX) {
                const distanceFromCenter = Math.abs(this.y - earthY);
                
                if (this.isFlareParticle) {
                    // Much higher chance for flare particles to leak
                    const leakChance = 0.3; // 30% chance to leak for flare particles
                    if (Math.random() < leakChance) {
                        this.isLeaking = true;
                        this.leakingToNorth = this.y < earthY;
                    }
                } else {
                    // Original leak chance calculation for regular particles
                    const speedFactor = (windSpeed - 300) / 500;
                    const baseLeakChance = 0.005;
                    const leakChance = baseLeakChance + (speedFactor * 0.03);
                    const finalChance = leakChance * (distanceFromCenter > 80 ? 1.5 : 0.5);
                    
                    if (Math.random() < finalChance) {
                        this.isLeaking = true;
                        this.leakingToNorth = this.y < earthY;
                    }
                }
            }

            if (this.isLeaking) {
                const northPoleY = earthY - 50;
                const southPoleY = earthY + 50;
                const poleRegionSize = 40;

                if (!this.hasCollided) {
                    // Move towards pole
                    const targetY = this.leakingToNorth ? northPoleY : southPoleY;
                    const dx = earthX - this.x;
                    const dy = targetY - this.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    const speed = speedMultiplier * 3;
                    this.x += (dx / distance) * speed;
                    this.y += (dy / distance) * speed;

                    // Check for nearby particles when close to poles
                    if (distance < poleRegionSize) {
                        const nearbyParticles = combinedParticles.filter(p => 
                            p !== this && 
                            p.isLeaking &&
                            !p.hasCollided &&
                            p.leakingToNorth === this.leakingToNorth &&
                            Math.abs(p.x - this.x) < 40 &&
                            Math.abs(p.y - this.y) < 40
                        );

                        if (nearbyParticles.length >= 2) {
                            const auroraColor = this.getAuroraColor(elevation, oxygenEnabled, nitrogenEnabled);
                            if (auroraColor) {
                                this.hasCollided = true;
                                this.collisionX = this.x;
                                this.collisionY = this.y;
                                this.collisionColor = auroraColor;
                                this.glowSize = 100 + (nearbyParticles.length * 15);
                                this.glowOpacity = 1.0;

                                nearbyParticles.forEach(p => {
                                    p.hasCollided = true;
                                    p.collisionX = p.x;
                                    p.collisionY = p.y;
                                    p.collisionColor = auroraColor;
                                    p.glowSize = this.glowSize * 0.8;
                                    p.glowOpacity = 1.0;
                                });
                            }
                        }
                    }
                }
            } else {
                // Normal magnetic field movement
                const frontFieldBoundary = earthX - 100;
                
                if (this.x < frontFieldBoundary) {
                    const distanceFromCenter = Math.abs(this.y - earthY);
                    const yDirection = this.y > earthY ? 1 : -1;
                    
                    const deflectionStrength = 2.5;
                    const xSpeed = speedMultiplier * 2;
                    let ySpeed = 0;
                    
                    if (this.x > frontFieldBoundary - 150) {
                        ySpeed = yDirection * speedMultiplier * deflectionStrength * 
                            (1 - (distanceFromCenter / 200));
                        
                        if (distanceFromCenter < 100) {
                            ySpeed *= 1.5;
                        }
                    }
                    
                    this.x += xSpeed;
                    this.y += ySpeed;
                } else {
                    const distanceFromCenter = Math.abs(this.y - earthY);
                    const yDirection = this.y > earthY ? 1 : -1;
                    
                    const tailDeflection = 0.8;
                    const xSpeed = speedMultiplier * 4;
                    const ySpeed = yDirection * speedMultiplier * tailDeflection * 
                        (1 - (distanceFromCenter / 200));
                    
                    this.x += xSpeed;
                    this.y += ySpeed;
                }
            }
            
            // Modified reset behavior
            if (this.x > magneticCanvas.width || 
                this.y < 0 || 
                this.y > magneticCanvas.height) {
                if (this.isFlareParticle) {
                    return false;
                }
                // Respawn with some horizontal variation
                this.x = 300 + Math.random() * 30;
                this.y = earthY + (Math.random() - 0.5) * 160;
                this.isLeaking = false;
                // Give newly spawned particles a brief immunity to leaking
                this.leakImmunity = 30; // frames of immunity
            } else if (this.leakImmunity > 0) {
                this.leakImmunity--;
            }
            
            return true;
        }
    }

    // Initialize particles
    function initParticles() {
        particles = [];
        // Create particles with random positions
        for (let i = 0; i < 50; i++) {
            const randomOffset = Math.random() * (canvas.width - 350);
            const x = 300 + randomOffset;
            const y = (canvas.height / 2) + (Math.random() - 0.5) * 160;
            particles.push(new Particle(x, y));
        }
    }

    // Animation loop
    function animate() {
        if (!document.getElementById('sun-sim').classList.contains('active')) {
            animationFrameId = null;
            return; // Stop animation if not on sun page
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        ctx.globalCompositeOperation = 'screen';
        
        const currentSpeed = parseInt(windSpeedValue.textContent);
        
        // Update and filter particles
        particles = particles.filter(particle => {
            return particle.update(currentSpeed);
        });
        
        // Draw all particles
        particles.forEach(particle => {
            particle.draw();
        });
        
        ctx.globalCompositeOperation = 'source-over';
        animationFrameId = requestAnimationFrame(animate);
    }

    // Update wind speed control
    if (windStrengthSlider && windSpeedValue) {
        windStrengthSlider.addEventListener('input', function() {
            windSpeedValue.textContent = this.value;
        });
    }

    // Handle solar flare button
    if (solarFlareBtn) {
        solarFlareBtn.addEventListener('click', function() {
            if (!isFlareActive) {
                isFlareActive = true;
                solarFlareBtn.disabled = true;

                // Pick a random point on the sun's right edge for the flare
                const flareY = (canvas.height / 2) + (Math.random() - 0.5) * 80;
                
                // Create a stretched cluster of fast particles
                for (let i = 0; i < 12; i++) { // Reduced from 20 to 12 particles
                    const particle = new Particle(
                        // Create a tail effect by varying the starting X position
                        300 + Math.random() * 50,  // Spread particles over 50px horizontally
                        flareY + (Math.random() - 0.5) * 20, // Slightly wider vertical spread
                        true // is flare particle
                    );
                    // Vary the speed slightly for particles further back
                    particle.baseSpeed = 4 + (Math.random() - 0.5);
                    particles.push(particle);
                }

                setTimeout(() => {
                    isFlareActive = false;
                    solarFlareBtn.disabled = false;
                }, 3000);
            }
        });
    }

    // Add magnetic field controls
    const magneticWindStrengthSlider = document.getElementById('magneticWindStrength');
    const magneticWindSpeedValue = document.getElementById('magneticWindSpeedValue');
    const magneticSolarFlareBtn = document.getElementById('magneticSolarFlareBtn');
    
    // Add magnetic field particle system
    const magneticCanvas = document.getElementById('magneticParticleCanvas');
    const magneticCtx = magneticCanvas.getContext('2d');
    let magneticParticles = [];
    let magneticAnimationFrameId;
    let isMagneticFlareActive = false;

    function resizeMagneticCanvas() {
        const container = document.querySelector('.simulation-content');
        magneticCanvas.width = container.offsetWidth;
        magneticCanvas.height = container.offsetHeight;
    }

    window.addEventListener('resize', resizeMagneticCanvas);

    function initMagneticParticles() {
        magneticParticles = [];
        const emissionX = 300;
        const centerY = magneticCanvas.height / 2;
        
        // Create more particles and spread them out more
        for (let i = 0; i < 80; i++) { // Increased from 50 to 80 particles
            // Spread across both X and Y more widely
            const x = emissionX + Math.random() * (magneticCanvas.width * 0.4); // Wider spread
            const y = centerY + (Math.random() - 0.5) * 160; // Increased from 80 to 160 (80% of sun height)
            magneticParticles.push(new Particle(x, y));
        }
    }

    function drawMagneticField(ctx, earthRadius) {
        const earthX = ctx.canvas.width - 150;
        const earthY = ctx.canvas.height / 2;
        
        ctx.strokeStyle = 'rgba(75, 156, 211, 0.3)';
        ctx.lineWidth = 1;

        // Draw sunward field lines (compressed ovals)
        const numOvals = 4;
        for (let i = 1; i <= numOvals; i++) {
            const scale = i / numOvals;
            
            ctx.beginPath();
            
            // Smaller ovals, shifted more to the left
            const width = earthRadius * (1.2 * scale); // Reduced from 2
            const height = earthRadius * (1.8 * scale); // Reduced from 3
            
            // Draw compressed oval, shifted further left
            ctx.ellipse(
                earthX - earthRadius - width/2, // Moved further left of Earth
                earthY,
                width,
                height,
                0,
                0,
                2 * Math.PI
            );
            
            ctx.stroke();
        }

        // Draw magnetotail (existing teardrop shapes)
        const numLines = 5;
        for (let i = 1; i <= numLines; i++) {
            const scale = i / numLines;
            
            ctx.beginPath();
            
            const startX = earthX;
            const width = earthRadius * (10 * scale);
            const height = earthRadius * (2.5 * scale);
            
            ctx.moveTo(startX, earthY);
            
            // Top half
            ctx.bezierCurveTo(
                startX, earthY - height,
                earthX + width, earthY - height,
                earthX + width, earthY
            );
            
            // Bottom half
            ctx.bezierCurveTo(
                earthX + width, earthY + height,
                startX, earthY + height,
                startX, earthY
            );
            
            ctx.stroke();
        }
    }

    function animateMagnetic() {
        if (!document.getElementById('magnetic-sim').classList.contains('active')) {
            magneticAnimationFrameId = null;
            return;
        }

        magneticCtx.clearRect(0, 0, magneticCanvas.width, magneticCanvas.height);
        drawMagneticField(magneticCtx, 50);
        
        const currentSpeed = parseInt(magneticWindSpeedValue.textContent);
        
        // Add new particles to replace ones that disappear
        const minParticles = 80; // Maintain minimum number of particles
        if (magneticParticles.length < minParticles) {
            const numToAdd = Math.min(3, minParticles - magneticParticles.length); // Add up to 3 at a time
            for (let i = 0; i < numToAdd; i++) {
                const emissionX = 300;
                const centerY = magneticCanvas.height / 2;
                const y = centerY + (Math.random() - 0.5) * 160;
                magneticParticles.push(new Particle(emissionX, y));
            }
        }
        
        magneticCtx.globalCompositeOperation = 'screen';
        
        magneticParticles = magneticParticles.filter(particle => {
            return particle.updateMagnetic(currentSpeed);
        });
        
        magneticParticles.forEach(particle => {
            particle.draw(magneticCtx);
        });
        
        magneticCtx.globalCompositeOperation = 'source-over';
        magneticAnimationFrameId = requestAnimationFrame(animateMagnetic);
    }

    // Add magnetic field controls event listeners
    if (magneticWindStrengthSlider && magneticWindSpeedValue) {
        magneticWindStrengthSlider.addEventListener('input', function() {
            magneticWindSpeedValue.textContent = this.value;
        });
    }

    if (magneticSolarFlareBtn) {
        magneticSolarFlareBtn.addEventListener('click', function() {
            if (!isMagneticFlareActive) {
                isMagneticFlareActive = true;
                magneticSolarFlareBtn.disabled = true;

                // Create flare particles in a tighter cluster
                const flareY = (magneticCanvas.height / 2) + (Math.random() - 0.5) * 160;
                
                // Create more flare particles since some will leak
                for (let i = 0; i < 20; i++) { // Increased from 12 to 20
                    const particle = new Particle(
                        300 + Math.random() * 30,
                        flareY + (Math.random() - 0.5) * 20,
                        true
                    );
                    particle.baseSpeed = 4 + (Math.random() - 0.5);
                    // Start with lower opacity
                    particle.color = particle.color.replace('0.9', '0.1');
                    // Add fade-in property
                    particle.fadeState = 'in';
                    particle.opacity = 0.1;
                    magneticParticles.push(particle);
                }

                setTimeout(() => {
                    isMagneticFlareActive = false;
                    magneticSolarFlareBtn.disabled = false;
                    // Start fade out for remaining flare particles
                    magneticParticles.forEach(p => {
                        if (p.isFlareParticle) {
                            p.fadeState = 'out';
                        }
                    });
                }, 3000);
            }
        });
    }

    // Add this to the magnetic field initialization
    function initMagneticField() {
        const earthElement = document.querySelector('#magnetic-sim .earth');
        const earthRect = earthElement.getBoundingClientRect();
        const canvasRect = magneticCanvas.getBoundingClientRect();
        
        // Calculate Earth's center position relative to canvas
        const earthX = earthRect.left - canvasRect.left + earthRect.width/2;
        const earthY = magneticCanvas.height/2;
        const earthRadius = earthRect.width/2;

        // Draw the field lines
        drawMagneticField(magneticCtx, earthRadius);
    }

    // Start the particle system
    // initParticles();
    // animate();

    function initParticlesSim() {
        const cloudsContainer = document.querySelector('.clouds');
        
        // Clear existing clouds
        cloudsContainer.innerHTML = '';
        
        // Generate random clouds
        const numClouds = 30;
        for (let i = 0; i < numClouds; i++) {
            const cloud = document.createElement('div');
            cloud.className = 'cloud';
            
            // Random size between 30 and 80 pixels
            const size = 30 + Math.random() * 50;
            cloud.style.width = `${size}px`;
            cloud.style.height = `${size}px`;
            
            // Random position
            cloud.style.left = `${Math.random() * 100}%`;
            cloud.style.bottom = `${Math.random() * 100}%`;
            
            cloudsContainer.appendChild(cloud);
        }
    }

    // Add to your existing initialization code
    const oxygenToggle = document.getElementById('oxygenToggle');
    const nitrogenToggle = document.getElementById('nitrogenToggle');
    const elevationControl = document.getElementById('elevationControl');
    const elevationValue = document.getElementById('elevationValue');

    if (elevationControl && elevationValue) {
        elevationControl.addEventListener('input', function() {
            elevationValue.textContent = this.value;
            // Add your elevation update logic here
        });
    }

    if (oxygenToggle) {
        oxygenToggle.addEventListener('change', function() {
            // Add your oxygen toggle logic here
        });
    }

    if (nitrogenToggle) {
        nitrogenToggle.addEventListener('change', function() {
            // Add your nitrogen toggle logic here
        });
    }

    class AtmosphericParticle {
        constructor(canvas) {
            this.canvas = canvas;
            this.x = Math.random() * canvas.width;
            this.y = 0;
            this.size = 2;
            this.speed = 2 + Math.random();
            this.hasCollided = false;
            this.collisionY = 0;
            this.glowSize = 0;
            this.glowOpacity = 0.8;
        }

        getColor(elevation, oxygenEnabled, nitrogenEnabled) {
            if (!oxygenEnabled && !nitrogenEnabled) return null;
            
            // Calculate actual elevation based on particle position
            const particleElevation = (this.canvas.height - this.y) / this.canvas.height * 300;
            
            if (Math.abs(particleElevation - elevation) > 10) return null;

            if (oxygenEnabled && nitrogenEnabled) {
                return 'rgba(255, 192, 203, 0.8)'; // Pink for mixture
            }
            
            if (oxygenEnabled) {
                if (particleElevation > 150) {
                    return 'rgba(255, 50, 50, 0.8)'; // Red for high oxygen
                } else if (particleElevation >= 60) {
                    return 'rgba(50, 255, 50, 0.8)'; // Green for lower oxygen
                }
            }
            
            if (nitrogenEnabled) {
                return 'rgba(147, 112, 219, 0.8)'; // Purple for nitrogen
            }

            return null;
        }

        update(elevation, oxygenEnabled, nitrogenEnabled) {
            if (!this.hasCollided) {
                this.y += this.speed;
                
                const collisionColor = this.getColor(elevation, oxygenEnabled, nitrogenEnabled);
                if (collisionColor) {
                    this.hasCollided = true;
                    this.collisionY = this.y;
                    this.collisionColor = collisionColor;
                    this.glowSize = 20;
                }
            } else {
                this.glowSize = Math.max(0, this.glowSize - 0.2);
                this.glowOpacity = Math.max(0, this.glowOpacity - 0.01);
            }

            if (this.y > this.canvas.height || (this.hasCollided && this.glowOpacity <= 0)) {
                this.reset();
            }
        }

        reset() {
            this.x = Math.random() * this.canvas.width;
            this.y = 0;
            this.hasCollided = false;
            this.glowOpacity = 0.8;
        }

        draw(ctx) {
            if (!this.hasCollided) {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.fill();
            } else if (this.glowSize > 0) {
                const gradient = ctx.createRadialGradient(
                    this.x, this.collisionY, 0,
                    this.x, this.collisionY, this.glowSize
                );
                gradient.addColorStop(0, this.collisionColor);
                gradient.addColorStop(1, 'rgba(0,0,0,0)');
                
                ctx.beginPath();
                ctx.arc(this.x, this.collisionY, this.glowSize, 0, Math.PI * 2);
                ctx.fillStyle = gradient;
                ctx.fill();
            }
        }
    }

    function initAtmosphereAnimation() {
        const canvas = document.getElementById('atmosphereCanvas');
        const ctx = canvas.getContext('2d');
        const particles = [];
        const numParticles = 50;
        let animationId;

        function resizeCanvas() {
            const container = canvas.parentElement;
            canvas.width = container.offsetWidth;
            canvas.height = container.offsetHeight;
        }

        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        // Initialize particles
        for (let i = 0; i < numParticles; i++) {
            particles.push(new AtmosphericParticle(canvas));
        }

        function animate() {
            if (!document.getElementById('particles-sim').classList.contains('active')) {
                cancelAnimationFrame(animationId);
                return;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const elevation = parseInt(document.getElementById('elevationControl').value);
            const oxygenEnabled = document.getElementById('oxygenToggle').checked;
            const nitrogenEnabled = document.getElementById('nitrogenToggle').checked;

            particles.forEach(particle => {
                particle.update(elevation, oxygenEnabled, nitrogenEnabled);
                particle.draw(ctx);
            });

            animationId = requestAnimationFrame(animate);
        }

        animate();
    }

    // Add these variables at the top level
    let combinedParticles = [];
    let combinedAnimationFrameId;
    let isCombinedFlareActive = false;

    function resizeCombinedCanvas() {
        const canvas = document.getElementById('combinedParticleCanvas');
        const container = document.querySelector('.simulation-content');
        canvas.width = container.offsetWidth;
        canvas.height = container.offsetHeight;
    }

    function initCombinedParticles() {
        combinedParticles = [];
        const emissionX = 300;
        const centerY = document.getElementById('combinedParticleCanvas').height / 2;
        
        for (let i = 0; i < 80; i++) {
            const x = emissionX + Math.random() * (canvas.width * 0.4);
            const y = centerY + (Math.random() - 0.5) * 160;
            combinedParticles.push(new CombinedParticle(x, y));
        }
    }

    class CombinedParticle extends Particle {
        constructor(x, y, isFlareParticle = false) {
            super(x, y, isFlareParticle);
            this.isLeaking = false;
            this.leakingToNorth = false;
            this.hasCollided = false;
            this.collisionY = 0;
            this.collisionX = 0;
            this.glowSize = 0;
            this.glowOpacity = 1.0;
        }

        getAuroraColor(elevation, oxygenEnabled, nitrogenEnabled) {
            if (!oxygenEnabled && !nitrogenEnabled) return null;
            
            // Only use the elevation from the slider
            // No need to calculate based on screen position
            
            if (oxygenEnabled && nitrogenEnabled) {
                return 'rgba(255, 192, 203, 1.0)'; // Bright pink for mixture
            }
            
            if (oxygenEnabled) {
                if (elevation > 150) {
                    return 'rgba(255, 50, 50, 1.0)'; // Bright red for high oxygen (>150km)
                } else if (elevation >= 60) {
                    return 'rgba(50, 255, 50, 1.0)'; // Bright green for lower oxygen (60-150km)
                }
            }
            
            if (nitrogenEnabled) {
                return 'rgba(147, 112, 219, 1.0)'; // Bright purple for nitrogen
            }

            return null;
        }

        update(windSpeed, elevation, oxygenEnabled, nitrogenEnabled) {
            let speedMultiplier = (windSpeed / 400) * this.baseSpeed;
            if (this.isFlareParticle) {
                speedMultiplier *= 2.5;
            }

            const canvas = document.getElementById('combinedParticleCanvas');
            const earthX = canvas.width - 150;
            const earthY = canvas.height / 2;

            // Normal magnetic field movement first
            if (!this.isLeaking) {
                const frontFieldBoundary = earthX - 100;
                
                if (this.x < frontFieldBoundary) {
                    const distanceFromCenter = Math.abs(this.y - earthY);
                    const yDirection = this.y > earthY ? 1 : -1;
                    
                    const deflectionStrength = 2.5;
                    const xSpeed = speedMultiplier * 2;
                    let ySpeed = 0;
                    
                    if (this.x > frontFieldBoundary - 150) {
                        ySpeed = yDirection * speedMultiplier * deflectionStrength * 
                            (1 - (distanceFromCenter / 200));
                        
                        if (distanceFromCenter < 100) {
                            ySpeed *= 1.5;
                        }
                    }
                    
                    this.x += xSpeed;
                    this.y += ySpeed;
                } else {
                    // Check for leaking near Earth
                    const leakCheckZone = 50;
                    if (this.x > earthX - leakCheckZone && this.x < earthX) {
                        const distanceFromCenter = Math.abs(this.y - earthY);
                        const leakChance = this.isFlareParticle ? 0.3 : 
                            (0.005 + ((windSpeed - 300) / 500) * 0.03) * 
                            (distanceFromCenter > 80 ? 1.5 : 0.5);
                        
                        if (Math.random() < leakChance) {
                            this.isLeaking = true;
                            this.leakingToNorth = this.y < earthY;
                        }
                    }

                    // Normal tail movement if not leaking
                    if (!this.isLeaking) {
                        const distanceFromCenter = Math.abs(this.y - earthY);
                        const yDirection = this.y > earthY ? 1 : -1;
                        const tailDeflection = 0.8;
                        const xSpeed = speedMultiplier * 4;
                        const ySpeed = yDirection * speedMultiplier * tailDeflection * 
                            (1 - (distanceFromCenter / 200));
                        
                        this.x += xSpeed;
                        this.y += ySpeed;
                    }
                }
            }

            // Handle leaking and aurora creation
            if (this.isLeaking && !this.hasCollided) {
                const targetY = this.leakingToNorth ? earthY - 50 : earthY + 50;
                const dx = earthX - this.x;
                const dy = targetY - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // Move towards pole
                const speed = speedMultiplier * 3;
                this.x += (dx / distance) * speed;
                this.y += (dy / distance) * speed;

                // Check for aurora creation near poles
                if (distance < 40) {
                    const auroraColor = this.getAuroraColor(elevation, oxygenEnabled, nitrogenEnabled);
                    if (auroraColor) {
                        this.hasCollided = true;
                        this.collisionX = this.x;
                        this.collisionY = this.y;
                        this.collisionColor = auroraColor;
                        this.glowSize = 30;
                        this.glowOpacity = 1.0;
                    }
                }
            }

            // Slower fade for aurora effect
            if (this.hasCollided) {
                this.glowSize = Math.max(0, this.glowSize - 0.1); // Slightly faster fade
                this.glowOpacity = Math.max(0, this.glowOpacity - 0.005);
                if (this.glowSize <= 0 || this.glowOpacity <= 0) {
                    return false;
                }
            }

            // Reset if off screen
            if (this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
                if (this.isFlareParticle) {
                    return false;
                }
                this.reset(canvas);
            }

            return true;
        }

        reset(canvas) {
            this.x = 300 + Math.random() * 30;
            this.y = canvas.height/2 + (Math.random() - 0.5) * 160;
            this.isLeaking = false;
            this.hasCollided = false;
            this.glowOpacity = 1.0;
        }

        draw(ctx) {
            if (this.hasCollided && this.glowSize > 0) {
                // Draw smaller but more intense aurora glow
                const gradient = ctx.createRadialGradient(
                    this.collisionX, this.collisionY, 0,
                    this.collisionX, this.collisionY, this.glowSize
                );
                
                // More intense gradient for smaller size
                gradient.addColorStop(0, this.collisionColor);
                gradient.addColorStop(0.4, this.collisionColor); // Larger solid center
                gradient.addColorStop(0.7, this.collisionColor.replace('1.0', '0.8')); // Brighter middle
                gradient.addColorStop(1, 'rgba(0,0,0,0)');
                
                ctx.globalAlpha = this.glowOpacity;
                ctx.beginPath();
                ctx.arc(this.collisionX, this.collisionY, this.glowSize, 0, Math.PI * 2);
                ctx.fillStyle = gradient;
                ctx.fill();
                ctx.globalAlpha = 1.0;
            }
            
            if (!this.hasCollided) {
                super.draw(ctx);
            }
        }
    }

    function animateCombined() {
        if (!document.getElementById('together-sim').classList.contains('active')) {
            combinedAnimationFrameId = null;
            return;
        }

        const canvas = document.getElementById('combinedParticleCanvas');
        const ctx = canvas.getContext('2d');
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawMagneticField(ctx, 50);
        
        const currentSpeed = parseInt(document.getElementById('combinedWindSpeedValue').textContent);
        const elevation = parseInt(document.getElementById('combinedElevationControl').value);
        const oxygenEnabled = document.getElementById('combinedOxygenToggle').checked;
        const nitrogenEnabled = document.getElementById('combinedNitrogenToggle').checked;

        // Add new particles if needed
        if (combinedParticles.length < 80) {
            const numToAdd = Math.min(3, 80 - combinedParticles.length);
            for (let i = 0; i < numToAdd; i++) {
                const emissionX = 300;
                const centerY = canvas.height / 2;
                const y = centerY + (Math.random() - 0.5) * 160;
                combinedParticles.push(new CombinedParticle(emissionX, y));
            }
        }

        ctx.globalCompositeOperation = 'screen';
        
        combinedParticles = combinedParticles.filter(particle => {
            return particle.update(currentSpeed, elevation, oxygenEnabled, nitrogenEnabled);
        });
        
        combinedParticles.forEach(particle => {
            particle.draw(ctx);
        });
        
        ctx.globalCompositeOperation = 'source-over';
        combinedAnimationFrameId = requestAnimationFrame(animateCombined);
    }

    // Add event listeners for combined controls
    const combinedWindStrengthSlider = document.getElementById('combinedWindStrength');
    const combinedWindSpeedValue = document.getElementById('combinedWindSpeedValue');
    const combinedSolarFlareBtn = document.getElementById('combinedSolarFlareBtn');

    if (combinedWindStrengthSlider && combinedWindSpeedValue) {
        combinedWindStrengthSlider.addEventListener('input', function() {
            combinedWindSpeedValue.textContent = this.value;
        });
    }

    if (combinedSolarFlareBtn) {
        combinedSolarFlareBtn.addEventListener('click', function() {
            if (!isCombinedFlareActive) {
                isCombinedFlareActive = true;
                combinedSolarFlareBtn.disabled = true;

                const flareY = (canvas.height / 2) + (Math.random() - 0.5) * 160;
                
                for (let i = 0; i < 20; i++) {
                    const particle = new CombinedParticle(
                        300 + Math.random() * 30,
                        flareY + (Math.random() - 0.5) * 20,
                        true
                    );
                    particle.baseSpeed = 4 + (Math.random() - 0.5);
                    particle.fadeState = 'in';
                    particle.opacity = 0.1;
                    combinedParticles.push(particle);
                }

                setTimeout(() => {
                    isCombinedFlareActive = false;
                    combinedSolarFlareBtn.disabled = false;
                }, 3000);
            }
        });
    }
}); 