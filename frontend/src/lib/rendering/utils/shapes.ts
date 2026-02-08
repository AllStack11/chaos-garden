/**
 * Shape Primitives for Procedural Entity Rendering
 * 
 * Contains all the drawing functions needed to create organic,
 * biological-feeling shapes for plants, animals, and fungi.
 */

export interface ShapeOptions {
  fill?: string;
  stroke?: string;
  lineWidth?: number;
  scale?: number;
  rotation?: number;
  opacity?: number;
}

/**
 * Draw a leaf shape with visible veins
 */
export function drawLeaf(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  length: number,
  width: number,
  options: ShapeOptions = {}
): void {
  const {
    fill = '#4ade80',
    stroke = '#166534',
    lineWidth = 1,
    scale = 1,
    rotation = 0,
    opacity = 1
  } = options;
  
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);
  ctx.globalAlpha = opacity;
  
  // Draw leaf body using bezier curves for organic shape
  ctx.beginPath();
  ctx.moveTo(0, 0);
  
  // Right side of leaf
  ctx.bezierCurveTo(
    width * 0.3, -length * 0.25,  // Control point 1
    width * 0.5, -length * 0.6,   // Control point 2
    0, -length                    // End point (tip)
  );
  
  // Left side of leaf (slightly asymmetrical for natural look)
  ctx.bezierCurveTo(
    -width * 0.4, -length * 0.55, // Control point 1
    -width * 0.35, -length * 0.2, // Control point 2
    0, 0                          // Back to origin
  );
  
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  
  if (stroke && lineWidth > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  
  // Draw central vein
  ctx.beginPath();
  ctx.moveTo(0, -length * 0.1);
  ctx.lineTo(0, -length * 0.85);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth * 0.8;
  ctx.globalAlpha = opacity * 0.6;
  ctx.stroke();
  
  // Draw side veins
  for (let i = 0.2; i < 0.8; i += 0.2) {
    const veinY = -length * i;
    const veinWidth = width * (0.8 - i) * 0.4;
    
    ctx.beginPath();
    ctx.moveTo(0, veinY);
    ctx.lineTo(veinWidth, veinY - length * 0.1);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(0, veinY);
    ctx.lineTo(-veinWidth, veinY - length * 0.1);
    ctx.stroke();
  }
  
  ctx.restore();
}

/**
 * Draw a flower with petals and center
 */
export function drawFlower(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  petalCount: number,
  petalLength: number,
  petalWidth: number,
  centerRadius: number,
  options: ShapeOptions = {}
): void {
  const {
    fill = '#fcd34d',
    stroke = '#b45309',
    lineWidth = 1,
    scale = 1,
    opacity = 1
  } = options;
  
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.globalAlpha = opacity;
  
  // Draw petals
  for (let i = 0; i < petalCount; i++) {
    const angle = (Math.PI * 2 * i) / petalCount;
    
    ctx.save();
    ctx.rotate(angle);
    
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.ellipse(0, -petalLength / 2, petalWidth, petalLength / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke && lineWidth > 0) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
    
    ctx.restore();
  }
  
  // Draw center
  ctx.beginPath();
  ctx.arc(0, 0, centerRadius, 0, Math.PI * 2);
  ctx.fillStyle = stroke;
  ctx.fill();
  
  // Add center detail
  ctx.beginPath();
  ctx.arc(0, 0, centerRadius * 0.6, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  
  ctx.restore();
}

/**
 * Draw a mushroom cap with gills underneath
 */
export function drawMushroomCap(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  capWidth: number,
  capHeight: number,
  stemHeight: number,
  stemWidth: number,
  options: ShapeOptions = {}
): void {
  const {
    fill = '#a855f7',
    stroke = '#6b21a8',
    lineWidth = 1,
    scale = 1,
    opacity = 1
  } = options;
  
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.globalAlpha = opacity;
  
  // Draw stem
  ctx.beginPath();
  ctx.moveTo(-stemWidth / 2, 0);
  ctx.quadraticCurveTo(-stemWidth / 3, stemHeight / 2, -stemWidth / 4, stemHeight);
  ctx.lineTo(stemWidth / 4, stemHeight);
  ctx.quadraticCurveTo(stemWidth / 3, stemHeight / 2, stemWidth / 2, 0);
  ctx.fillStyle = fill;
  ctx.globalAlpha = opacity * 0.7;
  ctx.fill();
  ctx.globalAlpha = opacity;
  
  if (stroke && lineWidth > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  
  // Draw cap (semicircle top)
  ctx.beginPath();
  ctx.arc(0, 0, capWidth / 2, Math.PI, 0);
  ctx.fillStyle = fill;
  ctx.fill();
  
  if (stroke && lineWidth > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  
  // Draw cap spots (random pattern for visual interest)
  const spotCount = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < spotCount; i++) {
    const spotAngle = Math.PI + Math.random() * Math.PI;
    const spotDist = capWidth * 0.15 + Math.random() * capWidth * 0.2;
    const spotX = Math.cos(spotAngle) * spotDist;
    const spotY = Math.sin(spotAngle) * spotDist * 0.5 - 2;
    const spotRadius = 2 + Math.random() * 3;
    
    ctx.beginPath();
    ctx.arc(spotX, spotY, spotRadius, 0, Math.PI * 2);
    ctx.fillStyle = stroke;
    ctx.globalAlpha = opacity * 0.4;
    ctx.fill();
    ctx.globalAlpha = opacity;
  }
  
  // Draw gills under cap
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = opacity * 0.5;
  for (let i = -capWidth / 2 + 4; i < capWidth / 2; i += 4) {
    ctx.beginPath();
    ctx.moveTo(i, 2);
    ctx.quadraticCurveTo(i + 2, 8, i, 15);
    ctx.stroke();
  }
  ctx.globalAlpha = opacity;
  
  ctx.restore();
}

/**
 * Draw an insect/creature body with segments
 */
export function drawInsectBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  bodyLength: number,
  bodyWidth: number,
  segmentCount: number,
  options: ShapeOptions = {}
): void {
  const {
    fill = '#fbbf24',
    stroke = '#b45309',
    lineWidth = 1,
    scale = 1,
    rotation = 0,
    opacity = 1
  } = options;
  
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);
  ctx.globalAlpha = opacity;
  
  // Draw segmented body
  const segLength = bodyLength / segmentCount;
  
  for (let i = 0; i < segmentCount; i++) {
    const segX = (i - segmentCount / 2) * segLength;
    const segWidth = bodyWidth * (1 - i * 0.1); // Tapers toward back
    
    ctx.beginPath();
    ctx.ellipse(segX, 0, segLength * 0.6, segWidth / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    
    if (stroke && lineWidth > 0) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }
  
  // Draw head
  const headX = (segmentCount / 2) * segLength;
  ctx.beginPath();
  ctx.arc(headX + segLength * 0.3, 0, bodyWidth * 0.4, 0, Math.PI * 2);
  ctx.fill();
  if (stroke && lineWidth > 0) {
    ctx.stroke();
  }
  
  ctx.restore();
}

/**
 * Draw creature legs (6 for insects)
 */
export function drawCreatureLegs(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  bodyLength: number,
  legLength: number,
  legCount: number,
  phase: number, // For animation
  options: ShapeOptions = {}
): void {
  const {
    stroke = '#b45309',
    lineWidth = 1.5,
    scale = 1,
    rotation = 0,
    opacity = 1
  } = options;
  
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);
  ctx.globalAlpha = opacity;
  
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  
  // Draw legs in pairs
  const pairs = Math.floor(legCount / 2);
  
  for (let i = 0; i < pairs; i++) {
    const legIndex = i;
    const bodyY = ((i + 0.5) / pairs - 0.5) * bodyLength * 0.8;
    const angle = Math.PI / 4 + (i * 0.2); // Angled legs
    
    // Left leg
    const leftPhase = phase + (legIndex * Math.PI / 3);
    const leftBend = Math.sin(leftPhase) * 0.3;
    
    ctx.beginPath();
    ctx.moveTo(0, bodyY);
    ctx.lineTo(-legLength * Math.cos(angle + leftBend), bodyY + legLength * Math.sin(angle + leftBend));
    ctx.lineTo(-legLength * Math.cos(angle + leftBend) * 1.3, bodyY + legLength * Math.sin(angle + leftBend) * 1.2);
    ctx.stroke();
    
    // Right leg (opposite phase)
    const rightPhase = phase + Math.PI + (legIndex * Math.PI / 3);
    const rightBend = Math.sin(rightPhase) * 0.3;
    
    ctx.beginPath();
    ctx.moveTo(0, bodyY);
    ctx.lineTo(legLength * Math.cos(angle + rightBend), bodyY + legLength * Math.sin(angle + rightBend));
    ctx.lineTo(legLength * Math.cos(angle + rightBend) * 1.3, bodyY + legLength * Math.sin(angle + rightBend) * 1.2);
    ctx.stroke();
  }
  
  ctx.restore();
}

/**
 * Draw creature wings
 */
export function drawWings(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  wingLength: number,
  wingWidth: number,
  flapPhase: number,
  wingColor: string,
  options: ShapeOptions = {}
): void {
  const {
    lineWidth = 1,
    opacity = 0.7,
    scale = 1
  } = options;
  
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.globalAlpha = opacity;
  
  // Left wing
  ctx.save();
  ctx.rotate(-Math.PI / 6 + Math.sin(flapPhase) * 0.5);
  ctx.beginPath();
  ctx.ellipse(-wingWidth / 2, 0, wingLength / 2, wingWidth / 2, 0, 0, Math.PI * 2);
  ctx.fillStyle = wingColor;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  ctx.restore();
  
  // Right wing
  ctx.save();
  ctx.rotate(Math.PI / 6 - Math.sin(flapPhase) * 0.5);
  ctx.beginPath();
  ctx.ellipse(wingWidth / 2, 0, wingLength / 2, wingWidth / 2, 0, 0, Math.PI * 2);
  ctx.fillStyle = wingColor;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  ctx.restore();
  
  ctx.restore();
}

/**
 * Draw creature antenna
 */
export function drawAntenna(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  length: number,
  angle: number,
  curlAmount: number,
  options: ShapeOptions = {}
): void {
  const {
    stroke = '#b45309',
    lineWidth = 1,
    opacity = 1
  } = options;
  
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = opacity;
  
  ctx.beginPath();
  ctx.moveTo(0, 0);
  
  // Curved antenna path
  const endX = Math.cos(angle) * length;
  const endY = Math.sin(angle) * length;
  const cpX = Math.cos(angle) * length * 0.5 + curlAmount;
  const cpY = Math.sin(angle) * length * 0.5 - curlAmount * 2;
  
  ctx.quadraticCurveTo(cpX, cpY, endX, endY);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  
  // Antenna tip (bulb)
  ctx.beginPath();
  ctx.arc(endX, endY, 2, 0, Math.PI * 2);
  ctx.fillStyle = stroke;
  ctx.fill();
  
  ctx.restore();
}

/**
 * Draw creature eye
 */
export function drawEye(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  isHunting: boolean,
  options: ShapeOptions = {}
): void {
  const {
    fill = 'white',
    stroke = '#333',
    lineWidth = 1,
    opacity = 1
  } = options;
  
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = opacity;
  
  // Eye white
  ctx.beginPath();
  ctx.ellipse(0, 0, radius, radius * 0.7, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  
  // Pupil
  const pupilRadius = radius * 0.4;
  ctx.beginPath();
  ctx.arc(0, 0, pupilRadius, 0, Math.PI * 2);
  ctx.fillStyle = isHunting ? '#ef4444' : '#1f2937';
  ctx.fill();
  
  // Eye shine
  ctx.beginPath();
  ctx.arc(-radius * 0.2, -radius * 0.2, radius * 0.15, 0, Math.PI * 2);
  ctx.fillStyle = 'white';
  ctx.fill();
  
  ctx.restore();
}

/**
 * Draw a plant stem
 */
export function drawStem(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  height: number,
  curveAmount: number,
  thickness: number,
  options: ShapeOptions = {}
): void {
  const {
    fill = '#166534',
    stroke = '#14532d',
    lineWidth = 1,
    opacity = 1
  } = options;
  
  ctx.save();
  ctx.globalAlpha = opacity;
  
  ctx.beginPath();
  ctx.moveTo(x, y);
  
  // Curved stem using bezier
  const cp1x = x + curveAmount;
  const cp1y = y - height * 0.3;
  const cp2x = x - curveAmount * 0.5;
  const cp2y = y - height * 0.7;
  const endX = x;
  const endY = y - height;
  
  ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
  
  // Stroke as line
  ctx.strokeStyle = stroke;
  ctx.lineWidth = thickness;
  ctx.stroke();
  
  // Inner fill (lighter)
  ctx.lineWidth = thickness * 0.6;
  ctx.strokeStyle = fill;
  ctx.stroke();
  
  ctx.restore();
