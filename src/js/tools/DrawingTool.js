import { DRAWING_CONFIG } from '../utils/constants.js';

/**
 * Handles freehand drawing logic.
 */
export class DrawingTool {
    constructor(controller) {
        this.controller = controller;
        this.state = controller.state;
        this.ctx = controller.canvasManager.ctx; // Need context
    }

    start(e) {
        this.state.isDrawing = true;
        [this.state.lastX, this.state.lastY] = [e.clientX, e.clientY];

        // Initialize physics properties for smooth strokes
        this.state.lastVelocityX = 0;
        this.state.lastVelocityY = 0;
        this.state.lastTimestamp = Date.now();

        this.state.annotations.push({
            type: 'draw',
            color: this.state.drawColor,
            width: this.state.drawWidth,
            points: [[this.state.lastX, this.state.lastY]],
            pressures: [1.0], // Start with default pressure
            velocities: [0], // Start with zero velocity
            timestamps: [this.state.lastTimestamp],
            controlPoints: [] // Initialize control points array
        });
    }

    draw(e) {
        if (!this.state.isDrawing) return;

        const currentX = e.clientX;
        const currentY = e.clientY;
        const currentTime = Date.now();
        const ctx = this.ctx;

        const deltaTime = (currentTime - this.state.lastTimestamp) / 1000; // Seconds
        const deltaX = currentX - this.state.lastX;
        const deltaY = currentY - this.state.lastY;

        // --- Physics Calculations --- (From original draw function)
        const velocityX = deltaTime > 0 ? (deltaX / deltaTime) : 0;
        const velocityY = deltaTime > 0 ? (deltaY / deltaTime) : 0;

        const smoothingFactor = DRAWING_CONFIG.SMOOTHING_FACTOR;
        const smoothVelocityX = smoothingFactor * this.state.lastVelocityX + (1 - smoothingFactor) * velocityX;
        const smoothVelocityY = smoothingFactor * this.state.lastVelocityY + (1 - smoothingFactor) * velocityY;

        const speed = Math.sqrt(smoothVelocityX * smoothVelocityX + smoothVelocityY * smoothVelocityY);

        const maxSpeed = DRAWING_CONFIG.MAX_SPEED;
        const minPressure = DRAWING_CONFIG.MIN_PRESSURE;
        const maxPressure = DRAWING_CONFIG.MAX_PRESSURE;
        const normalizedSpeed = Math.min(speed / maxSpeed, 1);
        const pressureValue = maxPressure - normalizedSpeed * (maxPressure - minPressure);
        // --- End Physics Calculations ---

        const currentPath = this.state.annotations[this.state.annotations.length - 1];
        const points = currentPath.points;
        const pressures = currentPath.pressures;
        const velocities = currentPath.velocities;

        velocities.push(speed);
        pressures.push(pressureValue);
        currentPath.timestamps.push(currentTime);
        points.push([currentX, currentY]);

        // --- Incremental Drawing Optimization --- (From original draw function)
        const numPoints = points.length;
        if (numPoints === 2) {
            ctx.beginPath();
            ctx.moveTo(points[0][0], points[0][1]);
            ctx.lineWidth = this.state.drawWidth * (pressures[1] || 1.0);
            ctx.lineTo(points[1][0], points[1][1]);
            ctx.strokeStyle = currentPath.color;
            ctx.lineCap = 'round';
            ctx.stroke();
        } else if (numPoints > 2) {
            const k = numPoints - 1;
            const Pk_2 = points[k - 2];
            const Pk_1 = points[k - 1];
            const Pk = points[k];

            const tension = DRAWING_CONFIG.TENSION;
            const hasHighVelocitySegments = velocities && velocities.some(v => v > DRAWING_CONFIG.HIGH_VELOCITY_THRESHOLD);
            const velocityAdjustedTension = hasHighVelocitySegments ? tension * DRAWING_CONFIG.VELOCITY_TENSION_FACTOR : tension;
            let segmentTension = velocityAdjustedTension;
            const currentVelocity = velocities[k - 1] || 0;
            const nextVelocity = velocities[k] || 0;
            segmentTension = velocityAdjustedTension * (1 - Math.min(Math.max(currentVelocity, nextVelocity) / DRAWING_CONFIG.VELOCITY_TENSION_SCALE, DRAWING_CONFIG.VELOCITY_TENSION_REDUCTION_MAX));

            let cp1x = Pk_1[0] + (Pk[0] - Pk_2[0]) * segmentTension;
            let cp1y = Pk_1[1] + (Pk[1] - Pk_2[1]) * segmentTension;
            let cp2x = (Pk_1[0] + Pk[0]) / 2;
            let cp2y = (Pk_1[1] + Pk[1]) / 2;

            ctx.beginPath();
            ctx.moveTo(Pk_1[0], Pk_1[1]);
            ctx.lineWidth = this.state.drawWidth * (pressures[k] || 1.0);
            ctx.strokeStyle = currentPath.color;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, Pk[0], Pk[1]);
            ctx.stroke();

            // Store control points
            const segmentIndex = k - 1;
            if (!currentPath.controlPoints[segmentIndex]) {
                currentPath.controlPoints[segmentIndex] = {};
            }
            currentPath.controlPoints[segmentIndex].cp1 = { x: cp1x, y: cp1y };
            currentPath.controlPoints[segmentIndex].cp2 = { x: cp2x, y: cp2y };
        }
        // --- End Incremental Drawing --- 

        this.state.lastVelocityX = smoothVelocityX;
        this.state.lastVelocityY = smoothVelocityY;
        this.state.lastTimestamp = currentTime;
        [this.state.lastX, this.state.lastY] = [currentX, currentY];
    }

    stop() {
        this.state.isDrawing = false;
        // Optional: Final processing of the completed path if needed
    }
}
