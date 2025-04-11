/**
 * Drawing Tools Module
 * Handles drawing related functionality
 */

/**
 * Starts a drawing operation
 */
function startDrawing(e, state, annotations) {
  if (state.tool !== 'draw' && state.tool !== 'eraser') return;
  
  state.isDrawing = true;
  [state.lastX, state.lastY] = [e.clientX, e.clientY];
  
  // For eraser, we don't add a new path
  if (state.tool === 'draw') {
    // Initialize physics properties for smooth strokes
    state.lastVelocityX = 0;
    state.lastVelocityY = 0;
    state.lastTimestamp = Date.now();
    
    annotations.push({
      type: 'draw',
      color: state.drawColor,
      width: state.drawWidth,
      points: [[state.lastX, state.lastY]],
      // Add pressure, velocity and timestamp information
      pressures: [1.0],
      velocities: [0],
      timestamps: [state.lastTimestamp],
      controlPoints: []
    });
  }
}

/**
 * Continues a drawing operation as the mouse moves
 */
function draw(e, state, ctx, annotations) {
  if (!state.isDrawing) return;
  
  const currentX = e.clientX;
  const currentY = e.clientY;
  const currentTime = Date.now();
  
  if (state.tool === 'draw') {
    // Calculate time delta for physics calculations
    const deltaTime = (currentTime - state.lastTimestamp) / 1000; // Convert to seconds
    
    // Calculate velocity (pixels per second)
    const deltaX = currentX - state.lastX;
    const deltaY = currentY - state.lastY;
    
    // Apply smoothing with momentum (weighted average of current and previous velocity)
    const velocityX = deltaTime > 0 ? (deltaX / deltaTime) : 0;
    const velocityY = deltaTime > 0 ? (deltaY / deltaTime) : 0;
    
    // Use momentum to smooth velocity changes (exponential smoothing)
    const smoothingFactor = 0.7; // Higher value = more smoothing
    const smoothVelocityX = smoothingFactor * state.lastVelocityX + (1 - smoothingFactor) * velocityX;
    const smoothVelocityY = smoothingFactor * state.lastVelocityY + (1 - smoothingFactor) * velocityY;
    
    // Calculate speed for pressure simulation
    const speed = Math.sqrt(smoothVelocityX * smoothVelocityX + smoothVelocityY * smoothVelocityY);
    
    // Simulate pressure based on speed - faster drawing = thinner lines
    // Scale between 0.5 and 1.5 based on speed
    const maxSpeed = 1500; // Calibrate based on testing
    const minPressure = 0.5;
    const maxPressure = 1.5;
    const normalizedSpeed = Math.min(speed / maxSpeed, 1);
    const pressureValue = maxPressure - normalizedSpeed * (maxPressure - minPressure);
    
    // Get the current path
    const currentPath = annotations[annotations.length - 1];
    const points = currentPath.points;
    const pressures = currentPath.pressures;
    const velocities = currentPath.velocities;
    
    // Add physics-based properties to the path
    velocities.push(speed);
    pressures.push(pressureValue);
    currentPath.timestamps.push(currentTime);
    
    // Add new point to the path
    points.push([currentX, currentY]);
    const numPoints = points.length;
    
    // --- Performance Optimization: Draw only the latest segment --- 
    if (numPoints === 2) {
      // Draw the first line segment directly
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      ctx.lineWidth = state.drawWidth * (pressures[1] || 1.0); // Pressure at the end point
      ctx.lineTo(points[1][0], points[1][1]);
      ctx.strokeStyle = currentPath.color;
      ctx.lineCap = 'round';
      ctx.stroke();
    } else if (numPoints > 2) {
      // Draw the latest Bezier segment incrementally
      const k = numPoints - 1;
      const Pk_2 = points[k - 2];
      const Pk_1 = points[k - 1]; // Start point of the new segment
      const Pk   = points[k];     // End point of the new segment (current mouse position)

      // Calculate tension based on velocity
      const tension = 0.4; // Base tension
      const hasHighVelocitySegments = velocities && velocities.some(v => v > 1000);
      const velocityAdjustedTension = hasHighVelocitySegments ? tension * 0.8 : tension;
      let segmentTension = velocityAdjustedTension;
      const currentVelocity = velocities[k - 1] || 0;
      const nextVelocity = velocities[k] || 0;
      segmentTension = velocityAdjustedTension * (1 - Math.min(Math.max(currentVelocity, nextVelocity) / 2000, 0.5));

      // Control point after Pk_1 (cp1)
      let cp1x = Pk_1[0] + (Pk[0] - Pk_2[0]) * segmentTension;
      let cp1y = Pk_1[1] + (Pk[1] - Pk_2[1]) * segmentTension;

      // Control point before Pk (cp2) - Midpoint approximation for the live end
      let cp2x = (Pk_1[0] + Pk[0]) / 2;
      let cp2y = (Pk_1[1] + Pk[1]) / 2;
      
      ctx.beginPath();
      ctx.moveTo(Pk_1[0], Pk_1[1]); // Move to the start of the new segment
      ctx.lineWidth = state.drawWidth * (pressures[k] || 1.0); // Pressure at the end point
      ctx.strokeStyle = currentPath.color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round'; // Ensures smooth connection between segments

      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, Pk[0], Pk[1]);
      ctx.stroke();
      
      // Store control points (optional, but might be useful later)
      const segmentIndex = k - 1;
      if (!currentPath.controlPoints[segmentIndex]) {
        currentPath.controlPoints[segmentIndex] = {};
      }
      currentPath.controlPoints[segmentIndex].cp1 = { x: cp1x, y: cp1y };
      currentPath.controlPoints[segmentIndex].cp2 = { x: cp2x, y: cp2y };
    }
    // --- End Performance Optimization ---
    
    // Update velocity state for next frame
    state.lastVelocityX = smoothVelocityX;
    state.lastVelocityY = smoothVelocityY;
    state.lastTimestamp = currentTime;
  } 
  else if (state.tool === 'eraser') {
    // Eraser mode - we draw temporarily to show the user where they're erasing
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(state.lastX, state.lastY);
    ctx.lineTo(currentX, currentY);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)'; // Semi-transparent stroke for eraser visualization
    ctx.lineWidth = state.eraserWidth || 20; // Wider stroke for eraser
    ctx.lineCap = 'round';
    ctx.stroke();
    
    // Apply destination-out composite operation to create transparent path
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.moveTo(state.lastX, state.lastY);
    ctx.lineTo(currentX, currentY);
    ctx.strokeStyle = 'rgba(0, 0, 0, 1)';
    ctx.lineWidth = state.eraserWidth || 20;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over'; // Reset to default
    ctx.restore();
    
    // Erase any paths that intersect with the eraser
    // Note: Erasing might still require a full redraw depending on its implementation
    if(eraseIntersectingPaths(state, annotations, currentX, currentY)) {
       // If eraseIntersectingPaths modified annotations and returns true, trigger a full redraw
       redrawAnnotations(ctx, annotations, state, ctx.canvas); 
    }
  }
  
  // Update last position
  [state.lastX, state.lastY] = [currentX, currentY];
}

/**
 * Draws a smooth curve through points using cardinal spline interpolation
 * with physics-based properties like pressure and velocity
 */
function drawSmoothPath(annotation, ctx) {
  const points = annotation.points;
  if (points.length < 2) return;
  
  ctx.beginPath();
  ctx.strokeStyle = annotation.color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  // Start at the first point
  ctx.moveTo(points[0][0], points[0][1]);
  
  // For just two points, draw a straight line
  if (points.length === 2) {
    ctx.lineWidth = annotation.width * (annotation.pressures?.[1] || 1.0);
    ctx.lineTo(points[1][0], points[1][1]);
    ctx.stroke();
    return;
  }
  
  // Tension controls how tight the curve fits to points (0.0-1.0)
  // Lower values create smoother curves, higher values create more angular curves
  const tension = 0.4; // Slightly lower tension for smoother curves
  
  // Detect if we have a high-speed flick and adjust smoothing accordingly
  const hasHighVelocitySegments = annotation.velocities && 
    annotation.velocities.some(v => v > 1000);
  
  // Reduce control point influence for high-speed strokes
  const velocityAdjustedTension = hasHighVelocitySegments ? tension * 0.8 : tension;
  
  for (let i = 0; i < points.length - 1; i++) {
    // Get current point and the next point
    const current = points[i];
    const next = points[i + 1];
    
    // Apply pressure-sensitive line width (default to base width if no pressure data)
    const pressure = annotation.pressures?.[i + 1] || 1.0;
    ctx.lineWidth = annotation.width * pressure;
    
    // Calculate control points
    let cp1x, cp1y, cp2x, cp2y;
    
    if (i === 0) {
      // First segment: calculate only one control point
      cp2x = (current[0] + next[0]) / 2;
      cp2y = (current[1] + next[1]) / 2;
      cp1x = current[0];
      cp1y = current[1];
    }
    else if (i === points.length - 2) {
      // Last segment: only the first control point affects the curve
      cp1x = (current[0] + points[i - 1][0]) / 2;
      cp1y = (current[1] + points[i - 1][1]) / 2;
      cp2x = next[0];
      cp2y = next[1];
    }
    else {
      // Middle segments: calculate both control points
      const prev = points[i - 1];
      const afterNext = points[i + 2];
      
      // Get velocity for physics-based adjustments
      const currentVelocity = annotation.velocities?.[i] || 0;
      const nextVelocity = annotation.velocities?.[i+1] || 0;
      
      // Dynamic tension based on velocity - faster strokes get more smoothing
      const segmentTension = velocityAdjustedTension * 
        (1 - Math.min(Math.max(currentVelocity, nextVelocity) / 2000, 0.5));
      
      // Calculate control points with dynamic tension adjustment
      cp1x = current[0] + (next[0] - prev[0]) * segmentTension;
      cp1y = current[1] + (next[1] - prev[1]) * segmentTension;
      
      cp2x = next[0] - (afterNext[0] - current[0]) * segmentTension;
      cp2y = next[1] - (afterNext[1] - current[1]) * segmentTension;
    }
    
    // Draw cubic Bezier curve segment
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, next[0], next[1]);
    
    // Store control points for potential future use
    if (!annotation.controlPoints[i]) {
      annotation.controlPoints[i] = {
        cp1: { x: cp1x, y: cp1y },
        cp2: { x: cp2x, y: cp2y }
      };
    }
  }
  
  ctx.stroke();
}

/**
 * Erases any drawing paths that intersect with the eraser stroke
 */
function eraseIntersectingPaths(state, annotations, currentX, currentY) {
  const eraserRadius = state.eraserWidth || 20;
  let needsRedraw = false;
  
  // Check each annotation for intersection with eraser
  for (let i = annotations.length - 1; i >= 0; i--) {
    const annotation = annotations[i];
    
    if (annotation.type === 'draw') {
      const points = annotation.points;
      const newSegments = [];
      let currentSegment = [];
      let segmentErased = false;
      
      // Check each segment of the path
      for (let j = 0; j < points.length; j++) {
        const point = points[j];
        
        // If this is not the first point, check if the segment is erased
        if (j > 0) {
          const prevPoint = points[j-1];
          const isSegmentErased = isPointInEraserStroke(
            prevPoint[0], prevPoint[1], 
            point[0], point[1], 
            state.lastX, state.lastY, 
            currentX, currentY, 
            eraserRadius
          );
          
          if (isSegmentErased) {
            segmentErased = true;
            needsRedraw = true;
            
            // If we have a current segment with points, save it
            if (currentSegment.length > 1) {
              newSegments.push([...currentSegment]);
            }
            
            // Start a new segment with the current point
            currentSegment = [point];
          } else {
            // Add point to current segment
            currentSegment.push(point);
          }
        } else {
          // First point always goes into the current segment
          currentSegment.push(point);
        }
      }
      
      // Add the last segment if it has at least 2 points
      if (currentSegment.length > 1) {
        newSegments.push(currentSegment);
      }
      
      if (segmentErased) {
        // Replace the original annotation with new segments
        annotations.splice(i, 1);
        
        // Create new annotation objects for each valid segment
        for (const segment of newSegments) {
          if (segment.length >= 2) {
            annotations.push({
              type: 'draw',
              color: annotation.color,
              width: annotation.width,
              points: segment,
              controlPoints: [] // Initialize controlPoints for the new segment
            });
          }
        }
      }
    }
  }
  
  return needsRedraw;
}

/**
 * Checks if a line segment intersects with the eraser stroke
 */
function isPointInEraserStroke(x1, y1, x2, y2, eraserX1, eraserY1, eraserX2, eraserY2, eraserRadius) {
  // Sample multiple points along the segment to see if any are within the eraser stroke
  const steps = 5; // Number of points to check along the segment
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x1 + t * (x2 - x1);
    const y = y1 + t * (y2 - y1);
    
    // Check if this point is close to the eraser stroke
    if (pointLineDistance(x, y, eraserX1, eraserY1, eraserX2, eraserY2) < eraserRadius) {
      return true;
    }
  }
  
  return false;
}

/**
 * Calculates the minimum distance from a point to a line segment
 */
function pointLineDistance(px, py, x1, y1, x2, y2) {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;
  
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  
  if (lenSq !== 0) {
    param = dot / lenSq;
  }
  
  let xx, yy;
  
  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }
  
  const dx = px - xx;
  const dy = py - yy;
  
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Draw path with straight lines (used for simple paths or fallback)
 */
function drawPathOld(annotation, ctx) {
  ctx.beginPath();
  ctx.strokeStyle = annotation.color;
  ctx.lineWidth = annotation.width;
  ctx.lineCap = 'round';
  
  const points = annotation.points;
  if (points.length > 0) {
    ctx.moveTo(points[0][0], points[0][1]);
    
    for (let i = 1; i < points.length; i++) {
      // Apply pressure if available
      if (annotation.pressures && annotation.pressures[i]) {
        ctx.lineWidth = annotation.width * annotation.pressures[i];
      }
      ctx.lineTo(points[i][0], points[i][1]);
    }
  }
  
  ctx.stroke();
}

/**
 * Draws a path from saved annotation data
 */
function drawPath(annotation, ctx) {
  if (annotation.points.length > 2) {
    drawSmoothPath(annotation, ctx);
  } else {
    drawPathOld(annotation, ctx);
  }
}

/**
 * Draws text annotation from saved data
 */
function drawText(annotation, ctx, state) {
  ctx.font = annotation.font;
  ctx.fillStyle = annotation.color;
  ctx.fillText(annotation.text, annotation.x, annotation.y);
  
  if (state.isDraggingText && state.activeTextAnnotation && 
      state.activeTextAnnotation.id === annotation.id) {
    drawTextHighlight(annotation, ctx);
  }
}

/**
 * Draws a highlight around the selected text
 */
function drawTextHighlight(annotation, ctx) {
  const metrics = ctx.measureText(annotation.text);
  const textWidth = metrics.width;
  const textHeight = annotation.fontSize;
  
  ctx.strokeStyle = '#4285f4';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.strokeRect(
    annotation.x, 
    annotation.y - textHeight, 
    textWidth, 
    textHeight * 1.2
  );
  ctx.setLineDash([]);
}

/**
 * Redraws all annotations from the saved state
 */
function redrawAnnotations(ctx, annotations, state, canvas, selectedShapeIndex = null) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw all saved annotations
  for (let i = 0; i < annotations.length; i++) {
    const annotation = annotations[i];
    if (annotation.type === 'draw') {
      drawPath(annotation, ctx);
    } else if (annotation.type === 'text') {
      drawText(annotation, ctx, state);
    } else if (annotation.type === 'shape') {
      drawShape(annotation, ctx);
      // Draw selection handles if this shape is selected
      if (i === selectedShapeIndex) {
        drawSelectionHandles(annotation, ctx);
      }
    }
  }
}

/**
 * Draws shapes on the canvas
 */
function drawShape(annotation, ctx) {
  ctx.save(); // Save context before transformation
  ctx.strokeStyle = annotation.color;
  ctx.lineWidth = annotation.width;
  
  // Calculate center for rotation
  const centerX = annotation.startX + (annotation.endX - annotation.startX) / 2;
  const centerY = annotation.startY + (annotation.endY - annotation.startY) / 2;
  
  // Apply rotation
  ctx.translate(centerX, centerY);
  ctx.rotate(annotation.rotation || 0);
  ctx.translate(-centerX, -centerY);
  
  ctx.beginPath();
  
  // Use original (unrotated) coordinates relative to the rotated context
  const x = annotation.startX;
  const y = annotation.startY;
  
  // Normalize coordinates for drawing (especially for rectangles/circles)
  const x1 = Math.min(x, annotation.endX);
  const y1 = Math.min(y, annotation.endY);
  const x2 = Math.max(x, annotation.endX);
  const y2 = Math.max(y, annotation.endY);
  
  const width = x2 - x1;
  const height = y2 - y1;
  
  switch(annotation.shapeType) {
    case 'rectangle':
      ctx.rect(x1, y1, width, height);
      break;
    case 'circle':
      const circleCenterX = x1 + width / 2;
      const circleCenterY = y1 + height / 2;
      const radius = Math.max(Math.abs(width), Math.abs(height)) / 2;
      ctx.ellipse(circleCenterX, circleCenterY, radius, radius, 0, 0, 2 * Math.PI);
      break;
    case 'line':
      ctx.moveTo(x, y);
      ctx.lineTo(annotation.endX, annotation.endY);
      break;
    case 'arrow':
      drawArrow(ctx, x, y, annotation.endX, annotation.endY, annotation.width);
      break;
  }
  
  ctx.stroke();
  ctx.restore(); // Restore context after drawing
}

/**
 * Draws selection handles (bounding box and resize points) around a shape
 */
function drawSelectionHandles(annotation, ctx) {
    const handleSize = 8;
    const halfHandleSize = handleSize / 2;
    const rotationHandleOffset = 20; // Distance above the top-center handle
    const rotationHandleRadius = 5;
    ctx.fillStyle = 'rgba(0, 100, 255, 0.7)'; // Semi-transparent blue handles
    ctx.strokeStyle = 'rgba(0, 100, 255, 0.5)'; // Lighter blue border
    ctx.lineWidth = 1;

    // Calculate the actual bounding box based on min/max coordinates
    const minX = Math.min(annotation.startX, annotation.endX);
    const minY = Math.min(annotation.startY, annotation.endY);
    const maxX = Math.max(annotation.startX, annotation.endX);
    const maxY = Math.max(annotation.startY, annotation.endY);
    const width = maxX - minX;
    const height = maxY - minY;
    const centerX = minX + width / 2;
    const centerY = minY + height / 2;
    const rotation = annotation.rotation || 0;

    // Define unrotated handle positions based on the normalized bounding box
    const unrotatedHandles = {
        tl: { x: minX, y: minY },
        tr: { x: maxX, y: minY },
        bl: { x: minX, y: maxY },
        br: { x: maxX, y: maxY },
        t:  { x: centerX, y: minY },
        b:  { x: centerX, y: maxY },
        l:  { x: minX, y: centerY },
        r:  { x: maxX, y: centerY },
        rotate: { x: centerX, y: minY - rotationHandleOffset }
    };

    // Calculate rotated handle positions
    const rotatedHandles = {};
    for (const key in unrotatedHandles) {
        rotatedHandles[key] = rotatePoint(unrotatedHandles[key], { x: centerX, y: centerY }, rotation);
    }

    // Draw dashed bounding box (rotated)
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);
    ctx.translate(-centerX, -centerY);
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(minX, minY, width, height);
    ctx.setLineDash([]); // Reset line dash
    ctx.restore();

    // Draw handles at rotated positions
    for (const key in rotatedHandles) {
        const pos = rotatedHandles[key];
        if (key === 'rotate') {
            // Draw rotation handle (circle)
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, rotationHandleRadius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 150, 0, 0.7)'; // Green rotation handle
            ctx.fill();
            ctx.strokeStyle = 'rgba(0, 100, 0, 0.5)';
            ctx.stroke();

            // Draw line from top-center handle to rotation handle
            const topCenterHandle = rotatedHandles['t'];
            ctx.beginPath();
            ctx.moveTo(topCenterHandle.x, topCenterHandle.y);
            ctx.lineTo(pos.x, pos.y);
            ctx.strokeStyle = 'rgba(0, 150, 0, 0.5)';
            ctx.stroke();

        } else {
            // Draw resize handles (rectangles)
            ctx.fillStyle = 'rgba(0, 100, 255, 0.7)'; // Blue resize handles
            ctx.strokeStyle = 'rgba(0, 100, 255, 0.5)';
            ctx.fillRect(pos.x - halfHandleSize, pos.y - halfHandleSize, handleSize, handleSize);
            ctx.strokeRect(pos.x - halfHandleSize, pos.y - halfHandleSize, handleSize, handleSize);
        }
    }
}

/**
 * Checks if a point (x, y) is inside a shape annotation.
 * Returns the index of the shape if found, otherwise null.
 */
function getShapeAtPoint(x, y, annotations, ctx) {
  for (let i = annotations.length - 1; i >= 0; i--) {
    const annotation = annotations[i];
    if (annotation.type !== 'shape') continue;

    // Calculate center and un-rotate the point
    const centerX = annotation.startX + (annotation.endX - annotation.startX) / 2;
    const centerY = annotation.startY + (annotation.endY - annotation.startY) / 2;
    const rotation = annotation.rotation || 0;
    const unrotatedPoint = rotatePoint({ x, y }, { x: centerX, y: centerY }, -rotation);

    // Create a path for the shape to use isPointInPath/isPointInStroke
    ctx.beginPath();
    const minX = Math.min(annotation.startX, annotation.endX);
    const minY = Math.min(annotation.startY, annotation.endY);
    const maxX = Math.max(annotation.startX, annotation.endX);
    const maxY = Math.max(annotation.startY, annotation.endY);
    const width = maxX - minX;
    const height = maxY - minY;

    switch (annotation.shapeType) {
      case 'rectangle':
        ctx.rect(minX, minY, width, height);
        break;
      case 'circle':
        const circleCenterX = minX + width / 2;
        const circleCenterY = minY + height / 2;
        const radius = Math.max(Math.abs(width), Math.abs(height)) / 2;
        ctx.ellipse(circleCenterX, circleCenterY, radius, radius, 0, 0, 2 * Math.PI);
        break;
      case 'line':
        // Check proximity to the line segment
        const dist = pointLineDistance(unrotatedPoint.x, unrotatedPoint.y, annotation.startX, annotation.startY, annotation.endX, annotation.endY);
        const lineThickness = annotation.width + 10; // Add tolerance
        // Basic bounding box check first for optimization
        if (unrotatedPoint.x >= Math.min(annotation.startX, annotation.endX) - lineThickness &&
            unrotatedPoint.x <= Math.max(annotation.startX, annotation.endX) + lineThickness &&
            unrotatedPoint.y >= Math.min(annotation.startY, annotation.endY) - lineThickness &&
            unrotatedPoint.y <= Math.max(annotation.startY, annotation.endY) + lineThickness &&
            dist <= lineThickness / 2) {
           return i;
        }
        break; // Use break for line case after handling
      case 'arrow':
        // Hit detection for arrow is similar to line
        const arrowDist = pointLineDistance(unrotatedPoint.x, unrotatedPoint.y, annotation.startX, annotation.startY, annotation.endX, annotation.endY);
        const arrowThickness = annotation.width + 10; // Add tolerance
        // Bounding box check
        if (unrotatedPoint.x >= Math.min(annotation.startX, annotation.endX) - arrowThickness &&
            unrotatedPoint.x <= Math.max(annotation.startX, annotation.endX) + arrowThickness &&
            unrotatedPoint.y >= Math.min(annotation.startY, annotation.endY) - arrowThickness &&
            unrotatedPoint.y <= Math.max(annotation.startY, annotation.endY) + arrowThickness &&
            arrowDist <= arrowThickness / 2) {
          return i;
        }
        break; // Use break for arrow case after handling
    }

    // Use isPointInStroke for outlines, add tolerance
    ctx.lineWidth = annotation.width + 10; // Consider line width + tolerance
    if (ctx.isPointInStroke(unrotatedPoint.x, unrotatedPoint.y)) {
      return i;
    }
    // For filled shapes (if implemented later), use isPointInPath
    // if (ctx.isPointInPath(x, y)) {
    //   return i;
    // }
  }
  return null; // No shape found at this point
}

/**
* Checks if a point (x, y) is over a resize handle of a shape.
* Returns the handle identifier ('tl', 'tr', etc.) if found, otherwise null.
*/
function getInteractionHandleAtPoint(x, y, annotation, ctx) {
    if (!annotation || annotation.type !== 'shape') return null;

    const handleSize = 8;
    const resizeTouchRadius = handleSize; // Larger clickable area for resize handles
    const rotationHandleRadius = 5;
    const rotationTouchRadius = rotationHandleRadius + 5; // Larger touch area for rotation handle
    const rotationHandleOffset = 20;

    // Calculate center and rotation
    const minX = Math.min(annotation.startX, annotation.endX);
    const minY = Math.min(annotation.startY, annotation.endY);
    const maxX = Math.max(annotation.startX, annotation.endX);
    const maxY = Math.max(annotation.startY, annotation.endY);
    const width = maxX - minX;
    const height = maxY - minY;
    const centerX = minX + width / 2;
    const centerY = minY + height / 2;
    const rotation = annotation.rotation || 0;

    // Define unrotated handle positions
    const unrotatedHandles = {
        tl: { x: minX, y: minY },
        tr: { x: maxX, y: minY },
        bl: { x: minX, y: maxY },
        br: { x: maxX, y: maxY },
        t:  { x: centerX, y: minY },
        b:  { x: centerX, y: maxY },
        l:  { x: minX, y: centerY },
        r:  { x: maxX, y: centerY },
        rotate: { x: centerX, y: minY - rotationHandleOffset }
    };

    // Calculate rotated handle positions
    const rotatedHandles = {};
    for (const key in unrotatedHandles) {
        rotatedHandles[key] = rotatePoint(unrotatedHandles[key], { x: centerX, y: centerY }, rotation);
    }

    // Check collision with handles
    for (const key in rotatedHandles) {
        const pos = rotatedHandles[key];
        const touchRadius = (key === 'rotate') ? rotationTouchRadius : resizeTouchRadius;

        // Check if the point (x, y) is within the touch radius of the handle center
        if (Math.abs(x - pos.x) <= touchRadius && Math.abs(y - pos.y) <= touchRadius) {
            return key;
        }
    }

    return null;
}

/**
 * Starts drawing a shape
 */
function startShape(e, state, annotations) {
  state.isDrawingShape = true;
  state.shapeStartX = e.clientX;
  state.shapeStartY = e.clientY;
  
  // Add a new shape annotation
  annotations.push({
    type: 'shape',
    shapeType: state.currentShapeType || 'rectangle', // Default to rectangle
    color: state.drawColor,
    width: state.drawWidth,
    rotation: 0, // Initialize rotation
    startX: state.shapeStartX,
    startY: state.shapeStartY,
    endX: state.shapeStartX,
    endY: state.shapeStartY
  });
}

/**
 * Updates the shape as the user drags
 */
function updateShape(e, state, ctx, annotations) {
  if (!state.isDrawingShape) return;
  
  const currentShape = annotations[annotations.length - 1];
  currentShape.endX = e.clientX;
  currentShape.endY = e.clientY;
  
  // Redraw all annotations to show the shape in progress
  redrawAnnotations(ctx, annotations, state, ctx.canvas);
}

/**
 * Finishes drawing a shape
 */
function endShape(state) {
  state.isDrawingShape = false;
}

// Helper function to draw an arrowhead
function drawArrowhead(ctx, fromX, fromY, toX, toY, headLength, lineWidth) {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const arrowWidth = Math.max(10, lineWidth * 3); // Make arrowhead proportional to line width but not too small

    // Adjust headLength based on line width to maintain proportion
    headLength = Math.max(15, lineWidth * 5); 

    ctx.save();
    ctx.beginPath();
    ctx.translate(toX, toY);
    ctx.rotate(angle);
    ctx.moveTo(0, 0);
    ctx.lineTo(-headLength, -arrowWidth / 2);
    ctx.lineTo(-headLength * 0.9, 0); // Indent base slightly for better look
    ctx.lineTo(-headLength, arrowWidth / 2);
    ctx.closePath();
    ctx.restore();
    ctx.fill(); // Fill the arrowhead
}

// Helper function to draw an arrow
function drawArrow(ctx, fromX, fromY, toX, toY, lineWidth) {
    const headLength = 15; // Base length of the arrowhead lines
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.lineWidth = lineWidth;
    ctx.stroke(); // Draw the line part first

    // Draw the arrowhead
    // Use the line color for the arrowhead fill
    ctx.fillStyle = ctx.strokeStyle; 
    drawArrowhead(ctx, fromX, fromY, toX, toY, headLength, lineWidth);
}

// Helper function to rotate a point around a center
function rotatePoint(point, center, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    // Standard rotation formula:
    // x' = cx + (x - cx) * cos - (y - cy) * sin
    // y' = cy + (x - cx) * sin + (y - cy) * cos
    const nx = center.x + (cos * (point.x - center.x)) - (sin * (point.y - center.y));
    const ny = center.y + (sin * (point.x - center.x)) + (cos * (point.y - center.y));
    return { x: nx, y: ny };
}

export {
  startDrawing,
  draw,
  drawPath,
  drawText,
  redrawAnnotations,
  startShape,
  updateShape,
  endShape,
  drawShape,
  getShapeAtPoint,
  getInteractionHandleAtPoint
}; 