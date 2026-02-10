/**
 * Herbivore Renderer
 * 
 * Renders all 10 herbivore types with unique, persistent visuals:
 * Butterfly, Beetle, Rabbit, Snail, Cricket, Ladybug, Grasshopper, Ant, Bee, Moth
 */

import type { Entity } from '../../../env.d.ts';
import type { HerbivoreVisual } from '../HerbivoreVisualSystem.ts';

/**
 * Deterministic seeded random
 */
class SeededRandom {
  private seed: number;
  
  constructor(seed: number) {
    this.seed = seed;
  }
  
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
  
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

/**
 * Main Herbivore Renderer Class
 */
export class HerbivoreRenderer {
  private ctx: CanvasRenderingContext2D | null = null;
  private rng: SeededRandom | null = null;
  
  /**
   * Render a herbivore with its specific type
   */
  render(
    ctx: CanvasRenderingContext2D,
    entity: Entity,
    visual: HerbivoreVisual,
    x: number,
    y: number,
    time: number
  ): void {
    this.ctx = ctx;
    const visualSeed = this.generateSeed(entity.id);
    this.rng = new SeededRandom(visualSeed);
    
    const size = this.calculateSize(entity.energy, visual);
    const healthFactor = entity.health / 100;
    const gaitProfile = visual.genome.herbivore.gaitProfile;
    const bobOffset = Math.abs(Math.sin(time * (7 + gaitProfile * 2))) * (2 + visual.genome.herbivore.appendageStyle * 2) * healthFactor;
    
    switch (visual.creatureType) {
      case 'butterfly':
        this.renderButterfly(x, y - bobOffset, size, visual, time, healthFactor);
        break;
      case 'beetle':
        this.renderBeetle(x, y - bobOffset, size, visual, time, healthFactor);
        break;
      case 'rabbit':
        this.renderRabbit(x, y, size, visual, time, healthFactor);
        break;
      case 'snail':
        this.renderSnail(x, y, size, visual, time, healthFactor);
        break;
      case 'cricket':
        this.renderCricket(x, y - bobOffset, size, visual, time, healthFactor);
        break;
      case 'ladybug':
        this.renderLadybug(x, y - bobOffset, size, visual, time, healthFactor);
        break;
      case 'grasshopper':
        this.renderGrasshopper(x, y - bobOffset, size, visual, time, healthFactor);
        break;
      case 'ant':
        this.renderAnt(x, y - bobOffset, size, visual, time, healthFactor);
        break;
      case 'bee':
        this.renderBee(x, y - bobOffset, size, visual, time, healthFactor);
        break;
      case 'moth':
        this.renderMoth(x, y - bobOffset, size, visual, time, healthFactor);
        break;
    }
    
    // Glow effect for some creatures
    if (visual.glowIntensity > 0.1) {
      this.renderGlow(x, y, size, visual);
    }
  }
  
  /**
   * Generate visual seed from entity ID
   */
  private generateSeed(id: string): number {
    const hash = id.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);
    return Math.abs(hash);
  }
  
  /**
   * Calculate size from energy
   */
  private calculateSize(energy: number, visual: HerbivoreVisual): number {
    return (6 + energy / 18) * visual.bodySize;
  }
  
  // ==========================================
  // BUTTERFLY - Delicate winged creatures
  // ==========================================
  private renderButterfly(
    x: number,
    y: number,
    size: number,
    visual: HerbivoreVisual,
    time: number,
    _healthFactor: number
  ): void {
    if (!this.ctx || !this.rng) return;
    
    const wingFlap = Math.sin(time * 12) * 0.4;
    const wingSpan = size * visual.wingSpan;
    
    // Wings
    // Get accent color from patternColor or use a default
    const accentColor = visual.patternColor;
    const wingColors = [visual.bodyColor, visual.patternColor, accentColor];
    
    // Left wings
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(-0.2 + wingFlap);
    
    // Forewing
    this.ctx.fillStyle = wingColors[0];
    this.ctx.beginPath();
    this.ctx.ellipse(-size * 0.8, -size * 0.3, wingSpan * 0.8, wingSpan * 0.5, -0.3, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Hindwing
    this.ctx.fillStyle = wingColors[1] || wingColors[0];
    this.ctx.beginPath();
    this.ctx.ellipse(-size * 0.6, size * 0.2, wingSpan * 0.6, wingSpan * 0.4, 0.2, 0, Math.PI * 2);
    this.ctx.fill();
    
    this.ctx.restore();
    
    // Right wings
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(0.2 - wingFlap);
    
    this.ctx.fillStyle = wingColors[0];
    this.ctx.beginPath();
    this.ctx.ellipse(size * 0.8, -size * 0.3, wingSpan * 0.8, wingSpan * 0.5, 0.3, 0, Math.PI * 2);
    this.ctx.fill();
    
    this.ctx.fillStyle = wingColors[1] || wingColors[0];
    this.ctx.beginPath();
    this.ctx.ellipse(size * 0.6, size * 0.2, wingSpan * 0.6, wingSpan * 0.4, -0.2, 0, Math.PI * 2);
    this.ctx.fill();
    
    this.ctx.restore();
    
    // Body
    this.ctx.fillStyle = visual.bodyColor;
    this.ctx.beginPath();
    this.ctx.ellipse(x, y, size * 0.15, size * 0.4, 0, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Antenna
    this.renderAntenna(x, y - size * 0.4, size * visual.antennaLength, -0.3, visual.patternColor);
    this.renderAntenna(x, y - size * 0.4, size * visual.antennaLength, 0.3, visual.patternColor);
  }
  
  // ==========================================
  // BEETLE - Armored creatures with shells
  // ==========================================
  private renderBeetle(
    x: number,
    y: number,
    size: number,
    visual: HerbivoreVisual,
    time: number,
    _healthFactor: number
  ): void {
    if (!this.ctx || !this.rng) return;
    
    // Shell
    this.ctx.fillStyle = visual.bodyColor;
    this.ctx.beginPath();
    this.ctx.ellipse(x, y, size * 0.5, size * 0.4, 0, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Shell line (elytra)
    this.ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y - size * 0.35);
    this.ctx.lineTo(x, y + size * 0.35);
    this.ctx.stroke();
    
    // Shell shine
    if (visual.shimmerIntensity > 0.1) {
      this.ctx.fillStyle = `rgba(255,255,255,${visual.shimmerIntensity * 0.3})`;
      this.ctx.beginPath();
      this.ctx.ellipse(x - size * 0.15, y - size * 0.15, size * 0.2, size * 0.1, -0.5, 0, Math.PI * 2);
      this.ctx.fill();
    }
    
    // Head
    this.ctx.fillStyle = visual.shellColor;
    this.ctx.beginPath();
    this.ctx.arc(x, y - size * 0.35, size * 0.2, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Antenna
    this.renderAntenna(x, y - size * 0.4, size * 0.3, -0.5, visual.patternColor);
    this.renderAntenna(x, y - size * 0.4, size * 0.3, 0.5, visual.patternColor);
    
    // Legs
    for (let i = 0; i < 3; i++) {
      const legY = y - size * 0.1 + i * size * 0.15;
      const legAngle = Math.sin(time * 2 + i) * 0.1;
      
      this.ctx.strokeStyle = visual.bodyColor;
      this.ctx.lineWidth = 2;
      
      // Left legs
      this.ctx.beginPath();
      this.ctx.moveTo(x - size * 0.3, legY);
      this.ctx.lineTo(x - size * 0.6, legY + Math.sin(legAngle) * 5);
      this.ctx.stroke();
      
      // Right legs
      this.ctx.beginPath();
      this.ctx.moveTo(x + size * 0.3, legY);
      this.ctx.lineTo(x + size * 0.6, legY + Math.sin(legAngle + Math.PI) * 5);
      this.ctx.stroke();
    }
  }
  
  // ==========================================
  // RABBIT - Small mammals with ears
  // ==========================================
  private renderRabbit(
    x: number,
    y: number,
    size: number,
    visual: HerbivoreVisual,
    time: number,
    _healthFactor: number
  ): void {
    if (!this.ctx) return;
    
    // Ears
    const earWiggle = Math.sin(time * 3) * 0.1;
    this.ctx.fillStyle = visual.bodyColor;
    
    // Left ear
    this.ctx.save();
    this.ctx.translate(x - size * 0.15, y - size * 0.5);
    this.ctx.rotate(-0.1 + earWiggle);
    this.ctx.beginPath();
    this.ctx.ellipse(0, -size * 0.4, size * 0.12, size * 0.4, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = '#ffb6c1';
    this.ctx.beginPath();
    this.ctx.ellipse(0, -size * 0.4, size * 0.06, size * 0.25, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
    
    // Right ear
    this.ctx.save();
    this.ctx.translate(x + size * 0.15, y - size * 0.5);
    this.ctx.rotate(0.1 - earWiggle);
    this.ctx.beginPath();
    this.ctx.ellipse(0, -size * 0.4, size * 0.12, size * 0.4, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = '#ffb6c1';
    this.ctx.beginPath();
    this.ctx.ellipse(0, -size * 0.4, size * 0.06, size * 0.25, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
    
    // Body (fluffy)
    this.ctx.fillStyle = visual.bodyColor;
    this.ctx.beginPath();
    this.ctx.ellipse(x, y, size * 0.4, size * 0.35, 0, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Tail (puffball)
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.arc(x - size * 0.4, y + size * 0.1, size * 0.12, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Face
    this.ctx.fillStyle = '#333';
    this.ctx.beginPath();
    this.ctx.arc(x + size * 0.25, y - size * 0.1, size * 0.05, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Pink nose
    this.ctx.fillStyle = '#ffb6c1';
    this.ctx.beginPath();
    this.ctx.arc(x + size * 0.35, y, size * 0.05, 0, Math.PI * 2);
    this.ctx.fill();
  }
  
  // ==========================================
  // SLOW SLOW SNAIL - Spiral shell creatures
  // ==========================================
  private renderSnail(
    x: number,
    y: number,
    size: number,
    visual: HerbivoreVisual,
    time: number,
    _healthFactor: number
  ): void {
    if (!this.ctx) return;
    
    // Shell (spiral)
    const shellColor = visual.bodyColor;
    const spiralColor = visual.shellColor;
    
    this.ctx.fillStyle = shellColor;
    this.ctx.beginPath();
    this.ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Spiral pattern
    this.ctx.strokeStyle = spiralColor;
    this.ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      this.ctx.beginPath();
      this.ctx.arc(x, y, size * 0.35 - i * size * 0.1, i * 0.5, Math.PI * 1.5 + i * 0.3);
      this.ctx.stroke();
    }
    
    // Head
    this.ctx.fillStyle = shellColor;
    this.ctx.beginPath();
    this.ctx.ellipse(x + size * 0.5, y + size * 0.1, size * 0.2, size * 0.15, 0, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Eye stalks
    const stalkWiggle = Math.sin(time * 2) * 2;
    this.ctx.strokeStyle = shellColor;
    this.ctx.lineWidth = 2;
    
    this.ctx.beginPath();
    this.ctx.moveTo(x + size * 0.45, y);
    this.ctx.quadraticCurveTo(x + size * 0.5 + stalkWiggle, y - size * 0.2, x + size * 0.45, y - size * 0.35);
    this.ctx.stroke();
    
    this.ctx.beginPath();
    this.ctx.moveTo(x + size * 0.55, y);
    this.ctx.quadraticCurveTo(x + size * 0.6 - stalkWiggle, y - size * 0.2, x + size * 0.55, y - size * 0.35);
    this.ctx.stroke();
    
    // Eyes
    this.ctx.fillStyle = '#000';
    this.ctx.beginPath();
    this.ctx.arc(x + size * 0.45, y - size * 0.35, 3, 0, Math.PI * 2);
    this.ctx.arc(x + size * 0.55, y - size * 0.35, 3, 0, Math.PI * 2);
    this.ctx.fill();
  }
  
  // ==========================================
  // CRICKET - Jumping insects
  // ==========================================
  private renderCricket(
    x: number,
    y: number,
    size: number,
    visual: HerbivoreVisual,
    time: number,
    _healthFactor: number
  ): void {
    if (!this.ctx || !this.rng) return;
    
    // Wings
    const wingAngle = Math.sin(time * 8) * 0.2;
    this.ctx.fillStyle = visual.bodyColor;
    this.ctx.beginPath();
    this.ctx.ellipse(x, y - size * 0.1, size * 0.4, size * 0.25, wingAngle, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Body
    this.ctx.beginPath();
    this.ctx.ellipse(x, y, size * 0.25, size * 0.35, 0, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Head
    this.ctx.beginPath();
    this.ctx.arc(x + size * 0.2, y - size * 0.25, size * 0.15, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Antenna (long!)
    this.ctx.strokeStyle = visual.patternColor;
    this.ctx.lineWidth = 1;
    
    this.ctx.beginPath();
    this.ctx.moveTo(x + size * 0.25, y - size * 0.3);
    this.ctx.quadraticCurveTo(
      x + size * 0.5, y - size * 0.6,
      x + size * 0.3, y - size * visual.antennaLength
    );
    this.ctx.stroke();
    
    // Legs (jumping legs are prominent)
    this.ctx.strokeStyle = visual.bodyColor;
    this.ctx.lineWidth = 3;
    
    // Hind leg (large jumping leg)
    this.ctx.beginPath();
    this.ctx.moveTo(x - size * 0.2, y + size * 0.2);
    this.ctx.lineTo(x - size * 0.5, y + size * 0.6);
    this.ctx.stroke();
  }
  
  // ==========================================
  // LADYBUG - Spotted red/orange beetles
  // ==========================================
  private renderLadybug(
    x: number,
    y: number,
    size: number,
    visual: HerbivoreVisual,
    _time: number,
    _healthFactor: number
  ): void {
    if (!this.ctx) return;
    
    // Shell (red/orange)
    this.ctx.fillStyle = visual.bodyColor;
    this.ctx.beginPath();
    this.ctx.ellipse(x, y, size * 0.4, size * 0.35, 0, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Center line
    this.ctx.strokeStyle = '#000';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y - size * 0.3);
    this.ctx.lineTo(x, y + size * 0.3);
    this.ctx.stroke();
    
    // Spots
    this.ctx.fillStyle = visual.spotColor;
    const spotPositions = [
      [-0.15, -0.15], [0.15, -0.15], [-0.1, 0], [0.1, 0],
      [-0.15, 0.15], [0.15, 0.15], [0, -0.2], [0, 0.2]
    ];
    for (let i = 0; i < Math.min(visual.spotCount, spotPositions.length); i++) {
      const [dx, dy] = spotPositions[i];
      this.ctx.beginPath();
      this.ctx.arc(x + dx * size, y + dy * size, size * 0.06, 0, Math.PI * 2);
      this.ctx.fill();
    }
    
    // Head
    this.ctx.fillStyle = '#1a202c';
    this.ctx.beginPath();
    this.ctx.arc(x + size * 0.25, y - size * 0.15, size * 0.1, 0, Math.PI * 2);
    this.ctx.fill();
  }
  
  // ==========================================
  // GRASSHOPPER - Large jumping insects
  // ==========================================
  private renderGrasshopper(
    x: number,
    y: number,
    size: number,
    visual: HerbivoreVisual,
    _time: number,
    _healthFactor: number
  ): void {
    if (!this.ctx || !this.rng) return;
    
    // Wings
    this.ctx.fillStyle = visual.bodyColor;
    this.ctx.beginPath();
    this.ctx.ellipse(x - size * 0.2, y, size * 0.5, size * 0.2, -0.2, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Body
    this.ctx.beginPath();
    this.ctx.ellipse(x, y, size * 0.2, size * 0.4, 0, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Head
    this.ctx.beginPath();
    this.ctx.arc(x + size * 0.15, y - size * 0.25, size * 0.12, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Antenna
    this.ctx.strokeStyle = visual.patternColor;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(x + size * 0.2, y - size * 0.3);
    this.ctx.quadraticCurveTo(x + size * 0.4, y - size * 0.6, x + size * 0.2, y - size * visual.antennaLength);
    this.ctx.stroke();
    
    // Large hind legs
    this.ctx.strokeStyle = visual.bodyColor;
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.moveTo(x - size * 0.1, y + size * 0.2);
    this.ctx.quadraticCurveTo(x - size * 0.4, y + size * 0.5, x - size * 0.3, y + size * 0.7);
    this.ctx.stroke();
    
    // Stripes on body
    if (visual.hasStripes) {
      this.ctx.strokeStyle = visual.patternColor;
      this.ctx.lineWidth = 2;
      for (let i = 0; i < visual.stripeCount; i++) {
        const stripeY = y - size * 0.25 + (i * size * 0.1);
        this.ctx.beginPath();
        this.ctx.moveTo(x - size * 0.1, stripeY);
        this.ctx.lineTo(x + size * 0.1, stripeY);
        this.ctx.stroke();
      }
    }
  }
  
  // ==========================================
  // ANT - Small industrious creatures
  // ==========================================
  private renderAnt(
    x: number,
    y: number,
    size: number,
    visual: HerbivoreVisual,
    time: number,
    _healthFactor: number
  ): void {
    if (!this.ctx || !this.rng) return;
    
    // Segmented body
    const segments = 3;
    const segmentColors = visual.hasStripes 
      ? [visual.bodyColor, visual.patternColor, visual.bodyColor]
      : [visual.bodyColor, visual.bodyColor, visual.bodyColor];
    
    for (let i = 0; i < segments; i++) {
      this.ctx.fillStyle = segmentColors[i % segmentColors.length];
      const segmentY = y + (i - 1) * size * 0.15;
      this.ctx.beginPath();
      this.ctx.ellipse(x, segmentY, size * 0.1 + i * size * 0.02, size * 0.12, 0, 0, Math.PI * 2);
      this.ctx.fill();
    }
    
    // Head
    this.ctx.fillStyle = visual.bodyColor;
    this.ctx.beginPath();
    this.ctx.arc(x, y - size * 0.25, size * 0.1, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Antenna
    this.ctx.strokeStyle = visual.patternColor;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(x - size * 0.05, y - size * 0.3);
    this.ctx.quadraticCurveTo(x - size * 0.2, y - size * 0.5, x - size * 0.1, y - size * visual.antennaLength);
    this.ctx.stroke();
    
    // Legs (6 legs, 3 on each side)
    this.ctx.strokeStyle = visual.bodyColor;
    this.ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const legY = y - size * 0.1 + i * size * 0.12;
      const legPhase = time * 5 + i;
      
      this.ctx.beginPath();
      this.ctx.moveTo(x - size * 0.05, legY);
      this.ctx.lineTo(x - size * 0.25, legY + Math.sin(legPhase) * 3);
      this.ctx.stroke();
      
      this.ctx.beginPath();
      this.ctx.moveTo(x + size * 0.05, legY);
      this.ctx.lineTo(x + size * 0.25, legY + Math.sin(legPhase + Math.PI) * 3);
      this.ctx.stroke();
    }
  }
  
  // ==========================================
  // BEE - Fuzzy striped creatures
  // ==========================================
  private renderBee(
    x: number,
    y: number,
    size: number,
    visual: HerbivoreVisual,
    time: number,
    _healthFactor: number
  ): void {
    if (!this.ctx || !this.rng) return;
    
    const wingFlap = Math.sin(time * 15) * 0.3;
    
    // Wings
    this.ctx.save();
    this.ctx.translate(x, y - size * 0.1);
    this.ctx.rotate(-0.2 + wingFlap);
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    this.ctx.beginPath();
    this.ctx.ellipse(-size * 0.1, -size * 0.2, size * 0.25, size * 0.12, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
    
    this.ctx.save();
    this.ctx.translate(x, y - size * 0.1);
    this.ctx.rotate(0.2 - wingFlap);
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    this.ctx.beginPath();
    this.ctx.ellipse(size * 0.1, -size * 0.2, size * 0.25, size * 0.12, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
    
    // Fuzzy body (striped)
    const stripeWidth = size * 0.08;
    for (let i = 0; i < 5; i++) {
      this.ctx.fillStyle = i % 2 === 0 ? visual.bodyColor : visual.patternColor;
      const stripeY = y - size * 0.15 + i * stripeWidth * 2;
      this.ctx.beginPath();
      this.ctx.ellipse(x, stripeY, size * 0.18, stripeWidth, 0, 0, Math.PI * 2);
      this.ctx.fill();
    }
    
    // Head
    this.ctx.fillStyle = visual.bodyColor;
    this.ctx.beginPath();
    this.ctx.arc(x + size * 0.15, y, size * 0.12, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Fuzzy texture lines
    if (visual.hasFur) {
      this.ctx.strokeStyle = 'rgba(0,0,0,0.1)';
      this.ctx.lineWidth = 0.5;
      for (let i = 0; i < 5; i++) {
        const stripeY = y - size * 0.15 + i * stripeWidth * 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x - size * 0.1, stripeY);
        this.ctx.lineTo(x + size * 0.1, stripeY);
        this.ctx.stroke();
      }
    }
    
    // Antenna
    this.renderAntenna(x + size * 0.2, y - size * 0.05, size * 0.2, -0.5, visual.patternColor);
    this.renderAntenna(x + size * 0.2, y - size * 0.05, size * 0.2, 0.5, visual.patternColor);
  }
  
  // ==========================================
  // MOTH - Nocturnal dusty winged creatures
  // ==========================================
  private renderMoth(
    x: number,
    y: number,
    size: number,
    visual: HerbivoreVisual,
    time: number,
    _healthFactor: number
  ): void {
    if (!this.ctx || !this.rng) return;
    
    const wingFlap = Math.sin(time * 6) * 0.2;
    const wingSpan = size * visual.wingSpan * 1.2;
    
    // Wings (larger, more rounded than butterfly)
    // Left wings
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(-0.1 + wingFlap);
    this.ctx.fillStyle = visual.bodyColor;
    this.ctx.globalAlpha = 0.9;
    this.ctx.beginPath();
    this.ctx.ellipse(-size * 0.7, 0, wingSpan * 0.7, wingSpan * 0.5, -0.1, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.beginPath();
    this.ctx.ellipse(-size * 0.5, size * 0.25, wingSpan * 0.5, wingSpan * 0.4, 0.1, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
    
    // Right wings
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(0.1 - wingFlap);
    this.ctx.fillStyle = visual.bodyColor;
    this.ctx.globalAlpha = 0.9;
    this.ctx.beginPath();
    this.ctx.ellipse(size * 0.7, 0, wingSpan * 0.7, wingSpan * 0.5, 0.1, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.beginPath();
    this.ctx.ellipse(size * 0.5, size * 0.25, wingSpan * 0.5, wingSpan * 0.4, -0.1, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
    
    this.ctx.globalAlpha = 1;
    
    // Fuzzy body
    this.ctx.fillStyle = visual.bodyColor;
    this.ctx.beginPath();
    this.ctx.ellipse(x, y, size * 0.15, size * 0.35, 0, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Feathered antenna
    this.renderAntenna(x, y - size * 0.3, size * visual.antennaLength, -0.4, visual.patternColor);
    this.renderAntenna(x, y - size * 0.3, size * visual.antennaLength, 0.4, visual.patternColor);
    
    // Body stripes (dusty look)
    if (visual.hasStripes) {
      this.ctx.strokeStyle = visual.patternColor;
      this.ctx.lineWidth = 1;
      for (let i = 0; i < visual.stripeCount; i++) {
        const stripeY = y - size * 0.2 + i * size * 0.1;
        this.ctx.beginPath();
        this.ctx.moveTo(x - size * 0.08, stripeY);
        this.ctx.lineTo(x + size * 0.08, stripeY);
        this.ctx.stroke();
      }
    }
  }
  
  // ==========================================
  // HELPER: Render antenna
  // ==========================================
  private renderAntenna(
    x: number,
    y: number,
    length: number,
    angle: number,
    color: string
  ): void {
    if (!this.ctx) return;
    
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.quadraticCurveTo(
      x + Math.cos(angle) * length * 0.5,
      y + Math.sin(angle) * length * 0.5 - 3,
      x + Math.cos(angle) * length,
      y + Math.sin(angle) * length
    );
    this.ctx.stroke();
    
    // Antenna tip
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(x + Math.cos(angle) * length, y + Math.sin(angle) * length, 2, 0, Math.PI * 2);
    this.ctx.fill();
  }
  
  // ==========================================
  // HELPER: Render glow effect
  // ==========================================
  private renderGlow(
    x: number,
    y: number,
    size: number,
    visual: HerbivoreVisual
  ): void {
    if (!this.ctx) return;
    
    const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, size * 2);
    gradient.addColorStop(0, `rgba(255, 255, 200, ${visual.glowIntensity * 0.5})`);
    gradient.addColorStop(0.5, `rgba(255, 255, 100, ${visual.glowIntensity * 0.2})`);
    gradient.addColorStop(1, 'rgba(255, 255, 50, 0)');
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, size * 2, 0, Math.PI * 2);
    this.ctx.fill();
  }
}
