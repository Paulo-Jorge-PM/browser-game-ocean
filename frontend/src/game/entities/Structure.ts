import { Container, Sprite, Graphics } from 'pixi.js';
import type { BaseType } from '../../types/game';

/**
 * Animated structure entity with visual effects
 */
export class Structure {
  public container: Container;
  private sprite: Sprite;
  private glowGraphics: Graphics;
  private baseType: BaseType;
  private isOperational: boolean;

  // Animation state
  private pulsePhase: number = 0;
  private bobPhase: number = 0;
  private rotationSpeed: number = 0;
  private glowIntensity: number = 0;
  private targetGlowIntensity: number = 0.3;

  constructor(sprite: Sprite, baseType: BaseType, isOperational: boolean) {
    this.container = new Container();
    this.sprite = sprite;
    this.baseType = baseType;
    this.isOperational = isOperational;

    // Center the sprite
    sprite.anchor.set(0.5);
    sprite.x = 0;
    sprite.y = 0;

    // Create glow effect graphics
    this.glowGraphics = new Graphics();
    this.container.addChild(this.glowGraphics);
    this.container.addChild(sprite);

    // Set animation properties based on structure type
    this.initAnimationProperties();
  }

  private initAnimationProperties() {
    switch (this.baseType) {
      case 'power_plant':
        this.rotationSpeed = 0.001; // Slow rotation for turbine effect
        this.targetGlowIntensity = 0.5;
        break;
      case 'comms_tower':
        this.targetGlowIntensity = 0.4;
        break;
      case 'oxygen_generator':
        this.targetGlowIntensity = 0.3;
        break;
      case 'research_lab':
        this.targetGlowIntensity = 0.5;
        break;
      case 'defense_platform':
        this.targetGlowIntensity = 0.4;
        break;
      case 'command_ship':
        this.targetGlowIntensity = 0.3;
        break;
      default:
        this.targetGlowIntensity = 0.2;
    }

    // Random initial phases for variety
    this.pulsePhase = Math.random() * Math.PI * 2;
    this.bobPhase = Math.random() * Math.PI * 2;
  }

  public update(deltaMs: number) {
    if (!this.isOperational) return;

    // Update phases
    this.pulsePhase += deltaMs * 0.003;
    this.bobPhase += deltaMs * 0.002;

    // Pulsing glow effect
    const pulseFactor = 0.5 + Math.sin(this.pulsePhase) * 0.5;
    this.glowIntensity = this.targetGlowIntensity * pulseFactor;

    // Draw glow
    this.drawGlow();

    // Bobbing motion (underwater effect)
    this.sprite.y = Math.sin(this.bobPhase) * 1.5;

    // Rotation for certain structures
    if (this.rotationSpeed > 0) {
      this.sprite.rotation += this.rotationSpeed * deltaMs;
    }

    // Scale pulse for power structures
    if (this.baseType === 'power_plant' || this.baseType === 'research_lab') {
      const scalePulse = 1 + Math.sin(this.pulsePhase * 2) * 0.02;
      this.sprite.scale.set(scalePulse);
    }
  }

  private drawGlow() {
    const g = this.glowGraphics;
    g.clear();

    if (this.glowIntensity <= 0) return;

    const glowColor = this.getGlowColor();
    const size = this.sprite.width * 0.6;

    // Outer glow
    g.circle(0, 0, size);
    g.fill({ color: glowColor, alpha: this.glowIntensity * 0.3 });

    // Inner glow
    g.circle(0, 0, size * 0.6);
    g.fill({ color: glowColor, alpha: this.glowIntensity * 0.5 });
  }

  private getGlowColor(): number {
    switch (this.baseType) {
      case 'power_plant':
        return 0xffaa00; // Orange
      case 'oxygen_generator':
        return 0x00ffff; // Cyan
      case 'research_lab':
        return 0xaa00ff; // Purple
      case 'comms_tower':
        return 0x00ff88; // Green
      case 'defense_platform':
        return 0x00aaff; // Blue
      case 'command_ship':
        return 0xffd700; // Gold
      default:
        return 0x00ffaa; // Default cyan-green
    }
  }

  public setOperational(operational: boolean) {
    this.isOperational = operational;
    if (!operational) {
      this.glowIntensity = 0;
      this.glowGraphics.clear();
      this.sprite.rotation = 0;
      this.sprite.y = 0;
      this.sprite.scale.set(1);
    }
  }

  public destroy() {
    this.glowGraphics.destroy();
    this.sprite.destroy();
    this.container.destroy();
  }
}

/**
 * Manages all structure entities for animation updates
 */
export class StructureManager {
  private structures: Map<string, Structure> = new Map();
  private container: Container;

  constructor(parent: Container) {
    this.container = new Container();
    parent.addChild(this.container);
  }

  public addStructure(
    id: string,
    sprite: Sprite,
    baseType: BaseType,
    isOperational: boolean,
    x: number,
    y: number
  ): Structure {
    // Remove existing structure with same ID
    this.removeStructure(id);

    const structure = new Structure(sprite, baseType, isOperational);
    structure.container.x = x;
    structure.container.y = y;

    this.container.addChild(structure.container);
    this.structures.set(id, structure);

    return structure;
  }

  public removeStructure(id: string) {
    const structure = this.structures.get(id);
    if (structure) {
      structure.destroy();
      this.structures.delete(id);
    }
  }

  public update(deltaMs: number) {
    this.structures.forEach((structure) => {
      structure.update(deltaMs);
    });
  }

  public clear() {
    this.structures.forEach((structure) => structure.destroy());
    this.structures.clear();
  }

  public destroy() {
    this.clear();
    this.container.destroy();
  }
}
