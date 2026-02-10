/**
 * Plant Renderer
 * 
 * Renders all 10 plant types with unique, persistent visuals:
 * Fern, Flower, Grass, Vine, Succulent, Lily, Moss, Cactus, Bush, Herb
 */

import type { Entity } from '../../../env.d.ts';
import type { PlantVisual } from '../PlantVisualSystem.ts';

const BLUE_PLANT_BASE_HUE = 210;
const BROWN_PLANT_BASE_HUE = 28;

function clampToRange(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

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
 * Main Plant Renderer Class
 */
export class PlantRenderer {
  private ctx: CanvasRenderingContext2D | null = null;
  private rng: SeededRandom | null = null;
  
  /**
   * Render a plant with its specific type
   */
  render(
    ctx: CanvasRenderingContext2D,
    entity: Entity,
    visual: PlantVisual,
    x: number,
    y: number,
    time: number
  ): void {
    this.ctx = ctx;
    const visualSeed = this.generateSeed(entity.id);
    this.rng = new SeededRandom(visualSeed);
    
    const size = this.calculateSize(entity.energy, visual);
    const genome = visual.genome.plant;
    const sway = Math.sin(time * (1.8 + genome.veinDensity * 0.6) + x * 0.01) * (2 + visual.stemCurvature * 0.5 + genome.silhouetteNoise * 2);
    const healthFactor = entity.health / 100;
    const branchPulse = 1 + Math.sin(time * (0.8 + genome.branchDepth * 0.1)) * 0.02;

    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.scale(branchPulse, branchPulse);
    this.ctx.translate(-x, -y);
    
    switch (visual.plantType) {
      case 'fern':
        this.renderFern(x, y, size, sway, visual, healthFactor, time);
        break;
      case 'flower':
        this.renderFlower(x, y, size, sway, visual, healthFactor, time);
        break;
      case 'grass':
        this.renderGrass(x, y, size, sway, visual, healthFactor, time);
        break;
      case 'vine':
        this.renderVine(x, y, size, sway, visual, healthFactor, time);
        break;
      case 'succulent':
        this.renderSucculent(x, y, size, sway, visual, healthFactor, time);
        break;
      case 'lily':
        this.renderLily(x, y, size, sway, visual, healthFactor, time);
        break;
      case 'moss':
        this.renderMoss(x, y, size, sway, visual, healthFactor, time);
        break;
      case 'cactus':
        this.renderCactus(x, y, size, sway, visual, healthFactor, time);
        break;
      case 'bush':
        this.renderBush(x, y, size, sway, visual, healthFactor, time);
        break;
      case 'herb':
        this.renderHerb(x, y, size, sway, visual, healthFactor, time);
        break;
    }
    
    // Energy glow for healthy plants
    if (entity.energy > 85) {
      this.renderEnergyGlow(x, y - size, size * 1.45, visual);
    }

    this.ctx.restore();
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
  private calculateSize(energy: number, visual: PlantVisual): number {
    return (8 + energy / 15) * visual.height * visual.leafSize;
  }

  private getBluePlantColor(
    visual: PlantVisual,
    hueOffset: number,
    saturationBase: number,
    lightnessBase: number
  ): string {
    const hue = (BLUE_PLANT_BASE_HUE + visual.baseHue + hueOffset + 360) % 360;
    const saturation = clampToRange(saturationBase + visual.saturation, 18, 88);
    const lightness = clampToRange(lightnessBase + visual.baseHue * 0.18, 20, 86);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  private getBrownPlantColor(
    visual: PlantVisual,
    hueOffset: number,
    saturationBase: number,
    lightnessBase: number
  ): string {
    const hue = (BROWN_PLANT_BASE_HUE + visual.baseHue * 0.22 + hueOffset + 360) % 360;
    const saturation = clampToRange(saturationBase + visual.saturation * 0.2, 14, 62);
    const lightness = clampToRange(lightnessBase + visual.baseHue * 0.12, 16, 74);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }
  
  // ==========================================
  // FERN - Ancient, feathery fronds
  // ==========================================
  private renderFern(
    x: number,
    y: number,
    size: number,
    sway: number,
    visual: PlantVisual,
    healthFactor: number,
    time: number
  ): void {
    if (!this.ctx || !this.rng) return;
    
    const tiers = Math.floor(3 + visual.leafCount / 4);
    const stemHeight = size * 1.5;
    const baseColor = this.getBluePlantColor(visual, -8, 54, 48);
    
    // Central stem
    this.ctx.strokeStyle = this.getBrownPlantColor(visual, 2, 40, 34);
    this.ctx.lineWidth = 3 * visual.stemThickness;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.quadraticCurveTo(x + sway, y - stemHeight / 2, x + sway * 1.5, y - stemHeight);
    this.ctx.stroke();
    
    // Frond tiers
    for (let tier = 0; tier < tiers; tier++) {
      const tierY = y - (stemHeight * tier) / tiers;
      const tierSway = sway * (1 - tier * 0.15);
      const tierSize = size * (1 - tier * 0.15);
      const frondsOnSide = Math.floor(Math.max(1, visual.leafCount / tiers / 2));
      
      for (let i = -frondsOnSide; i <= frondsOnSide; i++) {
        const angle = (i / Math.max(1, frondsOnSide)) * 0.8 - 0.4;
        const frondLength = tierSize * (1 - Math.abs(i) / (frondsOnSide + 1));
        this.renderFernFrond(x + tierSway * 0.5, tierY, frondLength, angle, baseColor, healthFactor, visual.droopFactor);
      }
    }
  }
  
  private renderFernFrond(
    x: number,
    y: number,
    length: number,
    angle: number,
    color: string,
    healthFactor: number,
    droopFactor: number
  ): void {
    if (!this.ctx) return;
    
    const endX = x + Math.cos(-Math.PI / 2 + angle) * length;
    const endY = y + Math.sin(-Math.PI / 2 + angle) * length * (1 - droopFactor * 0.5);
    
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2 + length * 0.05;
    this.ctx.lineCap = 'round';
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.quadraticCurveTo(x + 5, y - length / 2, endX, endY);
    this.ctx.stroke();
  }
  
  // ==========================================
  // FLOWER - Bright blooms with petals
  // ==========================================
  private renderFlower(
    x: number,
    y: number,
    size: number,
    sway: number,
    visual: PlantVisual,
    healthFactor: number,
    time: number
  ): void {
    if (!this.ctx || !this.rng) return;
    
    const stemHeight = size * 2;
    const petalCount = Math.max(5, visual.petalCount);
    
    // Stem
    this.ctx.strokeStyle = this.getBrownPlantColor(visual, -4, 42, 36);
    this.ctx.lineWidth = 4 * visual.stemThickness;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.quadraticCurveTo(x + sway * 0.5, y - stemHeight / 2, x + sway, y - stemHeight);
    this.ctx.stroke();
    
    // Stem leaves
    this.ctx.fillStyle = this.getBluePlantColor(visual, -4, 52, 44);
    this.ctx.beginPath();
    this.ctx.ellipse(x + sway * 0.3, y - stemHeight * 0.4, size * 0.3, size * 0.15, -0.5, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.beginPath();
    this.ctx.ellipse(x + sway * 0.4, y - stemHeight * 0.7, size * 0.25, size * 0.12, 0.5, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Bloom
    this.renderBloom(x + sway, y - stemHeight, size * visual.bloomSize, petalCount, visual, healthFactor, time);
  }
  
  private renderBloom(
    x: number,
    y: number,
    size: number,
    petalCount: number,
    visual: PlantVisual,
    healthFactor: number,
    time: number
  ): void {
    if (!this.ctx) return;
    
    const baseHue = 220 + visual.baseHue;
    const petalStretch = 1 + visual.genome.plant.petalDeformation * 0.25;
    
    // Outer petals
    for (let i = 0; i < petalCount; i++) {
      const angle = (i / petalCount) * Math.PI * 2 + time * 0.1;
      this.ctx.fillStyle = `hsl(${baseHue + 20}, ${70 + visual.saturation}%, ${60 + visual.baseHue / 2}%)`;
      this.ctx.beginPath();
      this.ctx.ellipse(
        x + Math.cos(angle) * size * 0.3,
        y + Math.sin(angle) * size * 0.3,
        size * 0.35 * petalStretch, size * 0.17, angle, 0, Math.PI * 2
      );
      this.ctx.fill();
    }

    // Inner petals
    for (let i = 0; i < petalCount / 2; i++) {
      const angle = (i / (petalCount / 2)) * Math.PI * 2 + Math.PI / petalCount + time * 0.1;
      this.ctx.fillStyle = `hsl(${baseHue}, ${75 + visual.saturation}%, ${65 + visual.baseHue / 2}%)`;
      this.ctx.beginPath();
      this.ctx.ellipse(
        x + Math.cos(angle) * size * 0.15,
        y + Math.sin(angle) * size * 0.15,
        size * 0.22 * petalStretch, size * 0.1, angle, 0, Math.PI * 2
      );
      this.ctx.fill();
    }

    // Center
    this.ctx.fillStyle = this.getBrownPlantColor(visual, 8, 52, 48);
    this.ctx.beginPath();
    this.ctx.arc(x, y, size * 0.18, 0, Math.PI * 2);
    this.ctx.fill();

    // Stamens
    this.ctx.fillStyle = '#d8b57a';
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + time * 0.2;
      this.ctx.beginPath();
      this.ctx.arc(x + Math.cos(angle) * size * 0.09, y + Math.sin(angle) * size * 0.09, 2, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
  
  private renderLeaf(
    x: number,
    y: number,
    size: number,
    angle: number,
    color: string,
    healthFactor: number
  ): void {
    if (!this.ctx) return;
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.ellipse(x, y, size, size * 0.4, angle, 0, Math.PI * 2);
    this.ctx.fill();
  }
  
  // ==========================================
  // GRASS - Simple blade clusters
  // ==========================================
  private renderGrass(
    x: number,
    y: number,
    size: number,
    sway: number,
    visual: PlantVisual,
    healthFactor: number,
    time: number
  ): void {
    if (!this.ctx || !this.rng) return;
    
    const bladeCount = Math.max(4, visual.leafCount);
    const grassColor = this.getBluePlantColor(visual, -12, 42, 42);
    
    for (let i = 0; i < bladeCount; i++) {
      const length = size * 1.5 * (0.7 + this.rng!.range(0, 0.6));
      const bladeSway = sway + Math.sin(time * 3 + i) * 4;
      
      this.ctx.strokeStyle = grassColor;
      this.ctx.lineWidth = 2 + i * 0.2;
      this.ctx.lineCap = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(x + i * 4 - bladeCount * 2, y);
      this.ctx.quadraticCurveTo(
        x + i * 4 - bladeCount * 2 + bladeSway,
        y - length / 2,
        x + i * 4 - bladeCount * 2 + bladeSway * 1.5,
        y - length
      );
      this.ctx.stroke();
    }
  }
  
  // ==========================================
  // VINE - Trailing/climbing growth
  // ==========================================
  private renderVine(
    x: number,
    y: number,
    size: number,
    sway: number,
    visual: PlantVisual,
    healthFactor: number,
    time: number
  ): void {
    if (!this.ctx || !this.rng) return;
    
    const stemHeight = size * 2;
    const vineColor = this.getBrownPlantColor(visual, -6, 38, 30);
    const leafColor = this.getBluePlantColor(visual, 0, 50, 46);
    
    // Curved vine stem
    this.ctx.strokeStyle = vineColor;
    this.ctx.lineWidth = 3 * visual.stemThickness;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.bezierCurveTo(
      x + sway * 2, y - stemHeight * 0.3,
      x - sway, y - stemHeight * 0.6,
      x + sway * 0.5, y - stemHeight
    );
    this.ctx.stroke();
    
    // Leaves along vine
    const leafPositions = [0.2, 0.4, 0.6, 0.8];
    for (const pos of leafPositions) {
      const t = pos;
      const vineX = x + Math.sin(t * Math.PI * 2) * sway * 0.5;
      const vineY = y - stemHeight * pos;
      const leafAngle = Math.sin(time * 2 + pos * 10) * 0.3;
      
      this.ctx.fillStyle = leafColor;
      this.ctx.beginPath();
      this.ctx.ellipse(vineX, vineY, size * 0.3, size * 0.15, leafAngle, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
  
  // ==========================================
  // SUCCULENT - Thick, rounded bodies
  // ==========================================
  private renderSucculent(
    x: number,
    y: number,
    size: number,
    sway: number,
    visual: PlantVisual,
    healthFactor: number,
    time: number
  ): void {
    if (!this.ctx || !this.rng) return;
    
    const succColor = this.getBluePlantColor(visual, 10, 36, 50);
    const accentColor = this.getBluePlantColor(visual, 20, 46, 58);
    
    // Main succulent body (rounded shape)
    this.ctx.fillStyle = succColor;
    this.ctx.beginPath();
    this.ctx.ellipse(x, y - size * 0.5, size * 0.8, size * 0.6, 0, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Layered leaves
    for (let i = 0; i < visual.leafCount; i++) {
      const angle = (i / visual.leafCount) * Math.PI * 2;
      const leafSize = size * (0.4 + this.rng!.range(0, 0.3));
      const leafX = x + Math.cos(angle) * size * 0.3;
      const leafY = y - size * 0.5 + Math.sin(angle) * size * 0.2;
      
      this.ctx.fillStyle = accentColor;
      this.ctx.beginPath();
      this.ctx.ellipse(leafX, leafY, leafSize, leafSize * 0.6, angle + time * 0.1, 0, Math.PI * 2);
      this.ctx.fill();
    }
    
    // Dew drops
    if (visual.hasDewDrops && this.rng!.next() > 0.5) {
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      this.ctx.beginPath();
      this.ctx.arc(x + this.rng!.range(-size * 0.3, size * 0.3), y - size * 0.6 + this.rng!.range(-size * 0.2, size * 0.1), 3, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
  
  // ==========================================
  // LILY - Elegant trumpet blooms (water plants)
  // ==========================================
  private renderLily(
    x: number,
    y: number,
    size: number,
    sway: number,
    visual: PlantVisual,
    healthFactor: number,
    time: number
  ): void {
    if (!this.ctx) return;
    
    const stemHeight = size * 2.5;
    const bloomSize = size * visual.bloomSize;
    
    // Tall elegant stem
    this.ctx.strokeStyle = this.getBrownPlantColor(visual, -8, 36, 30);
    this.ctx.lineWidth = 3 * visual.stemThickness;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.quadraticCurveTo(x + sway * 0.3, y - stemHeight / 2, x + sway * 0.5, y - stemHeight);
    this.ctx.stroke();
    
    // Lily pad (floating leaf)
    this.ctx.fillStyle = this.getBluePlantColor(visual, -16, 34, 44);
    this.ctx.beginPath();
    this.ctx.ellipse(x - size * 0.8, y + size * 0.3, size * 0.6, size * 0.3, -0.3, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Trumpet bloom
    this.renderLilyBloom(x + sway * 0.5, y - stemHeight, bloomSize, visual, healthFactor, time);
  }
  
  private renderLilyBloom(
    x: number,
    y: number,
    size: number,
    visual: PlantVisual,
    healthFactor: number,
    time: number
  ): void {
    if (!this.ctx) return;
    
    const baseHue = 180 + visual.baseHue;
    
    // Outer petals (trumpet shape)
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      this.ctx.fillStyle = `hsl(${baseHue + 20}, ${40 + visual.saturation}%, ${90 + visual.baseHue / 2}%)`;
      this.ctx.beginPath();
      this.ctx.ellipse(
        x + Math.cos(angle) * size * 0.3,
        y + Math.sin(angle) * size * 0.3,
        size * 0.5, size * 0.25, angle, 0, Math.PI * 2
      );
      this.ctx.fill();
    }
    
    // Inner trumpet tube
    this.ctx.fillStyle = `hsl(${baseHue + 10}, ${30}%, ${88 + visual.baseHue / 2}%)`;
    this.ctx.beginPath();
    this.ctx.ellipse(x, y, size * 0.35, size * 0.4, 0, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Center (stigma)
    this.ctx.fillStyle = this.getBrownPlantColor(visual, 6, 46, 56);
    this.ctx.beginPath();
    this.ctx.arc(x, y, size * 0.15, 0, Math.PI * 2);
    this.ctx.fill();
  }
  
  // ==========================================
  // MOSS - Low spreading ground cover
  // ==========================================
  private renderMoss(
    x: number,
    y: number,
    size: number,
    sway: number,
    visual: PlantVisual,
    healthFactor: number,
    time: number
  ): void {
    if (!this.ctx || !this.rng) return;
    
    const mossColor = this.getBluePlantColor(visual, -10, 34, 38);
    const highlightColor = this.getBluePlantColor(visual, 0, 40, 50);
    
    const patchRadius = size * 1.2;
    this.ctx.fillStyle = mossColor;
    this.ctx.beginPath();
    this.ctx.arc(x, y - patchRadius * 0.3, patchRadius, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Texture bumps
    const bumpCount = Math.floor(5 + visual.leafCount / 3);
    for (let i = 0; i < bumpCount; i++) {
      const bumpX = x + this.rng!.range(-patchRadius * 0.7, patchRadius * 0.7);
      const bumpY = y - this.rng!.range(0, patchRadius * 0.5);
      const bumpSize = size * 0.3 * (0.5 + this.rng!.range(0, 0.5));
      
      this.ctx.fillStyle = highlightColor;
      this.ctx.beginPath();
      this.ctx.arc(bumpX, bumpY, bumpSize, 0, Math.PI * 2);
      this.ctx.fill();
    }
    
    // Spore stalks
    if (visual.hasSpores) {
      const stalkCount = Math.floor(3 + this.rng!.range(0, 4));
      for (let i = 0; i < stalkCount; i++) {
        const stalkX = x + this.rng!.range(-patchRadius * 0.5, patchRadius * 0.5);
        const stalkHeight = size * 0.4 * (0.5 + this.rng!.range(0, 0.5));
        
        this.ctx.strokeStyle = this.getBrownPlantColor(visual, -2, 34, 30);
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(stalkX, y - patchRadius * 0.3);
        this.ctx.lineTo(stalkX, y - patchRadius * 0.3 - stalkHeight);
        this.ctx.stroke();
        
        // Spore head
        this.ctx.fillStyle = this.getBrownPlantColor(visual, 10, 46, 46);
        this.ctx.beginPath();
        this.ctx.arc(stalkX, y - patchRadius * 0.3 - stalkHeight, 3, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }
  
  // ==========================================
  // CACTUS - Prickly desert survivors
  // ==========================================
  private renderCactus(
    x: number,
    y: number,
    size: number,
    sway: number,
    visual: PlantVisual,
    healthFactor: number,
    time: number
  ): void {
    if (!this.ctx || !this.rng) return;
    
    const cactusColor = this.getBluePlantColor(visual, -6, 30, 40);
    const darkCactusColor = this.getBluePlantColor(visual, -14, 28, 30);
    
    const cactusHeight = size * 2.5;
    const armCount = Math.floor(visual.leafCount / 3);
    
    // Main body
    this.ctx.fillStyle = cactusColor;
    this.ctx.beginPath();
    this.ctx.roundRect(x - size * 0.3, y - cactusHeight, size * 0.6, cactusHeight, size * 0.2);
    this.ctx.fill();
    
    // Ribs
    const ribCount = 5 + Math.floor(visual.stemThickness * 3);
    for (let i = 0; i < ribCount; i++) {
      const ribX = x - size * 0.25 + (size * 0.5 * i) / (ribCount - 1);
      this.ctx.strokeStyle = darkCactusColor;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(ribX, y - cactusHeight + size * 0.2);
      this.ctx.lineTo(ribX, y);
      this.ctx.stroke();
    }
    
    // Arms
    for (let i = 0; i < armCount; i++) {
      const armHeight = size * 0.8 * (0.5 + this.rng!.range(0, 0.5));
      const armY = y - cactusHeight * (0.3 + (i * 0.2));
      const armSide = i % 2 === 0 ? 1 : -1;
      
      this.ctx.fillStyle = cactusColor;
      this.ctx.beginPath();
      this.ctx.roundRect(x + armSide * size * 0.15, armY - armHeight, size * 0.3, armHeight, size * 0.1);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.roundRect(x + armSide * size * 0.15, armY - armHeight, size * 0.3 * armSide, armHeight * 0.6, size * 0.15);
      this.ctx.fill();
      
      // Areoles
      this.ctx.fillStyle = darkCactusColor;
      for (let j = 0; j < 3; j++) {
        const areoleX = x + armSide * (size * 0.35 + j * size * 0.05);
        const areoleY = armY - armHeight * (0.3 + j * 0.3);
        this.ctx.beginPath();
        this.ctx.arc(areoleX, areoleY, 2, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
    
    // Top cephalium
    if (visual.hasBloom) {
      this.ctx.fillStyle = this.getBrownPlantColor(visual, 14, 54, 50);
      this.ctx.beginPath();
      this.ctx.arc(x, y - cactusHeight, size * 0.15, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
  
  // ==========================================
  // BUSH - Dense shrubby growth
  // ==========================================
  private renderBush(
    x: number,
    y: number,
    size: number,
    sway: number,
    visual: PlantVisual,
    healthFactor: number,
    time: number
  ): void {
    if (!this.ctx || !this.rng) return;
    
    const bushColor = this.getBluePlantColor(visual, -8, 40, 40);
    const lightBushColor = this.getBluePlantColor(visual, 2, 44, 48);
    
    const clusterCount = Math.floor(4 + visual.leafCount / 2);
    
    for (let i = 0; i < clusterCount; i++) {
      const clusterX = x + this.rng!.range(-size * 0.6, size * 0.6);
      const clusterY = y - this.rng!.range(size * 0.2, size * 0.8);
      const clusterSize = size * 0.5 * (0.5 + this.rng!.range(0, 0.5));
      
      this.ctx.fillStyle = i % 2 === 0 ? bushColor : lightBushColor;
      this.ctx.beginPath();
      this.ctx.arc(clusterX, clusterY, clusterSize, 0, Math.PI * 2);
      this.ctx.fill();
    }
    
    this.ctx.fillStyle = bushColor;
    this.ctx.beginPath();
    this.ctx.ellipse(x, y - size * 0.5, size * 0.8, size * 0.6, 0, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Berries or flowers
    if (visual.hasBloom || this.rng!.next() > 0.5) {
      const berryCount = Math.floor(5 + visual.petalCount);
      for (let i = 0; i < berryCount; i++) {
        const berryX = x + this.rng!.range(-size * 0.5, size * 0.5);
        const berryY = y - this.rng!.range(size * 0.2, size * 0.8);
        
        this.ctx.fillStyle = visual.hasBloom
          ? this.getBrownPlantColor(visual, 12, 52, 50)
          : this.getBrownPlantColor(visual, 2, 44, 44);
        this.ctx.beginPath();
        this.ctx.arc(berryX, berryY, 4, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }
  
  // ==========================================
  // HERB - Culinary/medicinal plants
  // ==========================================
  private renderHerb(
    x: number,
    y: number,
    size: number,
    sway: number,
    visual: PlantVisual,
    healthFactor: number,
    time: number
  ): void {
    if (!this.ctx || !this.rng) return;
    
    const herbColor = this.getBluePlantColor(visual, -6, 46, 44);
    const stemColor = this.getBrownPlantColor(visual, -6, 34, 30);
    
    const stalkCount = Math.max(3, Math.floor(visual.leafCount / 2));
    
    for (let i = 0; i < stalkCount; i++) {
      const stalkX = x + (i - stalkCount / 2) * size * 0.4;
      const stalkHeight = size * 1.2 * (0.6 + this.rng!.range(0, 0.4));
      const stalkSway = sway * (0.5 + this.rng!.range(0, 0.5));
      
      this.ctx.strokeStyle = stemColor;
      this.ctx.lineWidth = 2 * visual.stemThickness;
      this.ctx.lineCap = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(stalkX, y);
      this.ctx.quadraticCurveTo(stalkX + stalkSway * 0.3, y - stalkHeight / 2, stalkX + stalkSway, y - stalkHeight);
      this.ctx.stroke();
      
      const leafPositions = [0.3, 0.5, 0.7];
      for (const pos of leafPositions) {
        const leafX = stalkX + stalkSway * pos * 0.7;
        const leafY = y - stalkHeight * pos;
        const leafAngle = -0.5 + this.rng!.range(-0.3, 0.3);
        
        this.ctx.fillStyle = herbColor;
        this.ctx.beginPath();
        this.ctx.ellipse(leafX, leafY, size * 0.2, size * 0.1, leafAngle, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.ellipse(leafX, leafY, size * 0.2, size * 0.1, -leafAngle, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
    
    // Small flower cluster
    if (visual.hasBloom && this.rng!.next() > 0.3) {
      const bloomStalk = Math.floor(this.rng!.range(0, stalkCount));
      const bloomX = x + (bloomStalk - stalkCount / 2) * size * 0.4 + sway;
      const bloomY = y - size * 1.2;
      
      this.ctx.fillStyle = this.getBluePlantColor(visual, 16, 36, 68);
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        this.ctx.beginPath();
        this.ctx.arc(bloomX + Math.cos(angle) * size * 0.1, bloomY + Math.sin(angle) * size * 0.1, 3, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.fillStyle = '#e0c894';
      this.ctx.beginPath();
      this.ctx.arc(bloomX, bloomY, 4, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
  
  // ==========================================
  // ENERGY GLOW - Health/energy feedback
  // ==========================================
  private renderEnergyGlow(
    x: number,
    y: number,
    radius: number,
    visual: PlantVisual
  ): void {
    if (!this.ctx) return;
    
    const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `hsla(${visual.baseHue + BLUE_PLANT_BASE_HUE}, 72%, 66%, 0.11)`);
    gradient.addColorStop(0.5, `hsla(${visual.baseHue + BLUE_PLANT_BASE_HUE}, 64%, 56%, 0.03)`);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();
  }
}
