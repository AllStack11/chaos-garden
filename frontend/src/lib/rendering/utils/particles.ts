/**
 * Particle System for Entity Visual Effects
 * 
 * Handles spores, bubbles, eating effects, and other
 * biological particle effects throughout the garden.
 */

// ==========================================
// Particle Types
// ==========================================

export interface Particle {
  id: string;
  type: ParticleType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  sizeChange: number;
  opacity: number;
  opacityChange: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  lifetime: number;
  maxLifetime: number;
  data?: Record<string, unknown>;
}

export type ParticleType = 
  | 'spore'
  | 'bubble'
  | 'eat'
  | 'death'
  | 'birth'
  | 'glow'
  | 'sparkle'
  | 'mycelium';

/**
 * Create a particle system instance
 */
export class ParticleSystem {
  private particles: Map<string, Particle> = new Map();
  private nextId: number = 0;

  constructor() {
    this.particles = new Map();
  }

  /**
   * Generate a unique particle ID
   */
  private generateId(): string {
    return `particle_${Date.now()}_${this.nextId++}`;
  }

  /**
   * Add a new particle to the system
   */
  addParticle(particle: Omit<Particle, 'id'>): string {
    const id = this.generateId();
    this.particles.set(id, { ...particle, id });
    return id;
  }

  /**
   * Remove a particle from the system
   */
  removeParticle(id: string): boolean {
    return this.particles.delete(id);
  }

  /**
   * Clear all particles
   */
  clear(): void {
    this.particles.clear();
  }

  /**
   * Update all particles
   */
  update(deltaTime: number): void {
    const deadParticles: string[] = [];

    for (const [id, particle] of this.particles) {
      // Update position
      particle.x += particle.vx * deltaTime * 60;
      particle.y += particle.vy * deltaTime * 60;

      // Update size
      particle.size += particle.sizeChange * deltaTime * 60;
      if (particle.size < 0.1) particle.size = 0.1;

      // Update opacity
      particle.opacity += particle.opacityChange * deltaTime * 60;
      particle.opacity = Math.max(0, Math.min(1, particle.opacity));

      // Update rotation
      particle.rotation += particle.rotationSpeed * deltaTime * 60;

      // Update lifetime
      particle.lifetime += deltaTime * 1000;

      // Remove dead particles
      if (particle.lifetime >= particle.maxLifetime || particle.opacity <= 0) {
        deadParticles.push(id);
      }
    }

    // Clean up dead particles
    for (const id of deadParticles) {
      this.particles.delete(id);
    }
  }

  /**
   * Render all particles
   */
  render(ctx: CanvasRenderingContext2D): void {
    for (const particle of this.particles.values()) {
      this.renderParticle(ctx, particle);
    }
  }

  /**
   * Render a single particle
   */
  private renderParticle(ctx: CanvasRenderingContext2D, particle: Particle): void {
    ctx.save();
    ctx.globalAlpha = particle.opacity;
    ctx.translate(particle.x, particle.y);
    ctx.rotate(particle.rotation);

    switch (particle.type) {
      case 'spore':
        this.renderSpore(ctx, particle);
        break;
      case 'bubble':
        this.renderBubble(ctx, particle);
        break;
      case 'eat':
        this.renderEat(ctx, particle);
        break;
      case 'death':
        this.renderDeath(ctx, particle);
        break;
      case 'birth':
        this.renderBirth(ctx, particle);
        break;
      case 'glow':
        this.renderGlow(ctx, particle);
        break;
      case 'sparkle':
        this.renderSparkle(ctx, particle);
        break;
      case 'mycelium':
        this.renderMycelium(ctx, particle);
        break;
    }

    ctx.restore();
  }

  /**
   * Render a spore particle
   */
  private renderSpore(ctx: CanvasRenderingContext2D, particle: Particle): void {
    // Spore glow
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, particle.size * 3);
    gradient.addColorStop(0, particle.color);
    gradient.addColorStop(0.3, particle.color.replace('1)', '0.5)'));
    gradient.addColorStop(1, 'transparent');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, particle.size * 3, 0, Math.PI * 2);
    ctx.fill();

    // Spore core
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Render a bubble particle
   */
  private renderBubble(ctx: CanvasRenderingContext2D, particle: Particle): void {
    // Bubble outline
    ctx.strokeStyle = particle.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
    ctx.stroke();

    // Bubble highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(-particle.size * 0.3, -particle.size * 0.3, particle.size * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Render an eating particle
   */
  private renderEat(ctx: CanvasRenderingContext2D, particle: Particle): void {
    // Star/sparkle shape
    const spikes = 5;
    const outerRadius = particle.size;
    const innerRadius = particle.size * 0.5;
    
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i * Math.PI) / spikes;
      if (i === 0) {
        ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      } else {
        ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
    }
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Render a death particle
   */
  private renderDeath(ctx: CanvasRenderingContext2D, particle: Particle): void {
    // Crumbling/ash effect
    ctx.fillStyle = particle.color;
    ctx.globalAlpha = particle.opacity * 0.5;
    
    for (let i = 0; i < 4; i++) {
      const offsetX = (Math.random() - 0.5) * particle.size;
      const offsetY = (Math.random() - 0.5) * particle.size;
      ctx.beginPath();
      ctx.arc(offsetX, offsetY, particle.size * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Render a birth particle
   */
  private renderBirth(ctx: CanvasRenderingContext2D, particle: Particle): void {
    // Rising sparkle
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, particle.size * 2);
    gradient.addColorStop(0, particle.color);
    gradient.addColorStop(0.5, particle.color.replace('1)', '0.3)'));
    gradient.addColorStop(1, 'transparent');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, particle.size * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Render a glow particle
   */
  private renderGlow(ctx: CanvasRenderingContext2D, particle: Particle): void {
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, particle.size * 4);
    gradient.addColorStop(0, particle.color);
    gradient.addColorStop(0.2, particle.color.replace('1)', '0.5)'));
    gradient.addColorStop(1, 'transparent');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, particle.size * 4, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Render a sparkle particle
   */
  private renderSparkle(ctx: CanvasRenderingContext2D, particle: Particle): void {
    ctx.strokeStyle = particle.color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = particle.opacity;
    
    // Four-pointed star
    ctx.beginPath();
    ctx.moveTo(0, -particle.size);
    ctx.lineTo(particle.size * 0.3, 0);
    ctx.lineTo(0, particle.size);
    ctx.lineTo(-particle.size * 0.3, 0);
    ctx.closePath();
    ctx.stroke();
  }

  /**
   * Render a mycelium particle
   */
  private renderMycelium(ctx: CanvasRenderingContext2D, particle: Particle): void {
    // Network-like line
    ctx.strokeStyle = particle.color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = particle.opacity * 0.5;
    
    ctx.beginPath();
    ctx.moveTo(-particle.size, 0);
    ctx.lineTo(particle.size, 0);
    ctx.moveTo(0, -particle.size * 0.5);
    ctx.lineTo(0, particle.size * 0.5);
    ctx.stroke();
  }

  /**
   * Get all particles
   */
  getParticles(): Particle[] {
    return Array.from(this.particles.values());
  }

  /**
   * Get particle count
   */
  getParticleCount(): number {
    return this.particles.size;
  }
}

// ==========================================
// Particle Creation Helpers
// ==========================================

/**
 * Create a spore particle for fungi
 */
export function createSpore(
  x: number,
  y: number,
  color: string = 'rgba(200, 180, 255, 1)'
): Omit<Particle, 'id'> {
  const angle = Math.random() * Math.PI * 2;
  const speed = 0.3 + Math.random() * 0.5;

  return {
    type: 'spore',
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: -0.5 - Math.random() * 0.5,
    size: 1 + Math.random() * 2,
    sizeChange: 0,
    opacity: 1,
    opacityChange: -0.003,
    color,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.1,
    lifetime: 0,
    maxLifetime: 2000 + Math.random() * 1000
  };
}

/**
 * Create a bubble particle (for moisture effects)
 */
export function createBubble(
  x: number,
  y: number,
  color: string = 'rgba(150, 220, 255, 0.6)'
): Omit<Particle, 'id'> {
  return {
    type: 'bubble',
    x,
    y,
    vx: (Math.random() - 0.5) * 0.3,
    vy: -0.5 - Math.random() * 0.5,
    size: 2 + Math.random() * 3,
    sizeChange: 0,
    opacity: 1,
    opacityChange: -0.005,
    color,
    rotation: 0,
    rotationSpeed: (Math.random() - 0.5) * 2,
    lifetime: 0,
    maxLifetime: 1500
  };
}

/**
 * Create eating particles (happy effect)
 */
export function createEatParticles(
  x: number,
  y: number,
  count: number = 5,
  color: string = 'rgba(255, 215, 0, 1)'
): Omit<Particle, 'id'>[] {
  const particles: Omit<Particle, 'id'>[] = [];

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const speed = 1 + Math.random();

    particles.push({
      type: 'eat',
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 2 + Math.random() * 2,
      sizeChange: -0.05,
      opacity: 1,
      opacityChange: -0.05,
      color,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
      lifetime: 0,
      maxLifetime: 500
    });
  }

  return particles;
}

/**
 * Create death particles (fade out effect)
 */
export function createDeathParticles(
  x: number,
  y: number,
  count: number = 8,
  color: string = 'rgba(100, 100, 100, 1)'
): Omit<Particle, 'id'>[] {
  const particles: Omit<Particle, 'id'>[] = [];

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.5 + Math.random() * 1.5;

    particles.push({
      type: 'death',
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1,
      size: 2 + Math.random() * 3,
      sizeChange: -0.02,
      opacity: 1,
      opacityChange: -0.01,
      color,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.1,
      lifetime: 0,
      maxLifetime: 1000
    });
  }

  return particles;
}

/**
 * Create birth particles (sparkle effect)
 */
export function createBirthParticles(
  x: number,
  y: number,
  count: number = 6,
  color: string = 'rgba(255, 255, 200, 1)'
): Omit<Particle, 'id'>[] {
  const particles: Omit<Particle, 'id'>[] = [];

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    const speed = 0.5 + Math.random();

    particles.push({
      type: 'birth',
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.5,
      size: 2 + Math.random() * 2,
      sizeChange: 0.1,
      opacity: 1,
      opacityChange: -0.02,
      color,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.1,
      lifetime: 0,
      maxLifetime: 800
    });
  }

  return particles;
}

/**
 * Create a glow effect around an entity
 */
export function createGlow(
  x: number,
  y: number,
  size: number,
  color: string = 'rgba(255, 255, 255, 0.3)'
): Omit<Particle, 'id'> {
  return {
    type: 'glow',
    x,
    y,
    vx: 0,
    vy: 0,
    size,
    sizeChange: 0,
    opacity: 0.8,
    opacityChange: -0.005,
    color,
    rotation: 0,
    rotationSpeed: 0,
    lifetime: 0,
    maxLifetime: 200
  };
}

/**
 * Create sparkle particles (for special moments)
 */
export function createSparkles(
  x: number,
  y: number,
  count: number = 4,
  color: string = 'rgba(255, 255, 255, 1)'
): Omit<Particle, 'id'>[] {
  const particles: Omit<Particle, 'id'>[] = [];

  for (let i = 0; i < count; i++) {
    particles.push({
      type: 'sparkle',
      x: x + (Math.random() - 0.5) * 20,
      y: y + (Math.random() - 0.5) * 20,
      vx: 0,
      vy: 0,
      size: 3 + Math.random() * 3,
      sizeChange: 0,
      opacity: 1,
      opacityChange: -0.03,
      color,
      rotation: Math.random() * Math.PI,
      rotationSpeed: 0,
      lifetime: 0,
      maxLifetime: 600
    });
  }

  return particles;
}
