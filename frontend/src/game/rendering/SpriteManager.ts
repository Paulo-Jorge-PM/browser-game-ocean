import { Assets, Texture, Sprite } from 'pixi.js';
import type { BaseType } from '../../types/game';

/**
 * SpriteManager loads and manages sprite textures from SVG files.
 */
export class SpriteManager {
  private textures: Map<string, Texture> = new Map();
  private loaded: boolean = false;
  private spriteSize: number;

  constructor(spriteSize: number = 56) {
    this.spriteSize = spriteSize;
  }

  /**
   * Load all structure textures from SVG files
   */
  public async loadAssets(): Promise<void> {
    const baseTypes = [
      'command_ship',
      'residential',
      'hydroponic_farm',
      'kelp_forest',
      'mining_rig',
      'oxygen_generator',
      'water_purifier',
      'power_plant',
      'comms_tower',
      'defense_platform',
      'shipyard',
      'research_lab',
      'storage_hub',
      'trade_hub',
      'construction',
    ];

    for (const type of baseTypes) {
      try {
        const texture = await Assets.load(`/assets/sprites/${type}.svg`);
        this.textures.set(type, texture);
      } catch (e) {
        console.warn(`Failed to load sprite for ${type}:`, e);
      }
    }
    this.loaded = true;
    console.log(`SpriteManager loaded ${this.textures.size} textures`);
  }

  /**
   * Check if assets are loaded
   */
  public isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Get a texture for a structure type
   */
  public getTexture(type: BaseType | 'construction'): Texture | null {
    return this.textures.get(type) || null;
  }

  /**
   * Create a sprite from a texture
   */
  public createSprite(type: BaseType, isConstructing: boolean = false): Sprite | null {
    const key = isConstructing ? 'construction' : type;
    const texture = this.textures.get(key);

    if (!texture) {
      console.warn(`No texture found for ${key}`);
      return null;
    }

    const sprite = new Sprite(texture);
    sprite.width = this.spriteSize;
    sprite.height = this.spriteSize;
    return sprite;
  }

  /**
   * Cleanup textures
   */
  public destroy() {
    this.textures.forEach((texture) => texture.destroy(true));
    this.textures.clear();
    this.loaded = false;
  }
}
