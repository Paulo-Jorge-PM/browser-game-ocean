import { Container, Graphics, Texture, TilingSprite } from 'pixi.js';

export class SurfaceMountains {
  private container: Container;
  private maskGraphic: Graphics;
  private mountainStrip: TilingSprite;
  private width: number;
  private height: number;
  private scrollSpeed: number;

  constructor(parent: Container, width: number, height: number, offsetX: number, offsetY: number) {
    this.container = new Container();
    this.container.eventMode = 'none';
    this.container.x = offsetX;
    this.container.y = offsetY;
    this.width = width;
    this.height = height;
    this.scrollSpeed = 0.0015;

    const texture = Texture.from('/assets/sky/mountains.png');
    const mountainHeight = Math.max(24, Math.min(72, Math.floor(height * 0.65)));
    this.mountainStrip = new TilingSprite(texture, width, mountainHeight);
    this.mountainStrip.eventMode = 'none';
    this.mountainStrip.y = Math.max(0, height - mountainHeight);
    this.mountainStrip.alpha = 0.65;
    this.mountainStrip.tint = 0xa6bdd1;
    this.container.addChild(this.mountainStrip);

    this.maskGraphic = new Graphics();
    this.maskGraphic.eventMode = 'none';
    this.container.addChild(this.maskGraphic);
    this.container.mask = this.maskGraphic;
    this.updateMask();

    parent.addChild(this.container);
  }

  private updateMask() {
    this.maskGraphic.clear();
    this.maskGraphic.rect(0, 0, this.width, this.height);
    this.maskGraphic.fill({ color: 0xffffff, alpha: 1 });
  }

  public update(deltaMs: number) {
    this.mountainStrip.tilePosition.x -= this.scrollSpeed * deltaMs;
  }

  public resize(width: number, height: number, offsetX: number, offsetY: number) {
    this.width = width;
    this.height = height;
    this.container.x = offsetX;
    this.container.y = offsetY;

    const mountainHeight = Math.max(24, Math.min(72, Math.floor(height * 0.65)));
    this.mountainStrip.width = width;
    this.mountainStrip.height = mountainHeight;
    this.mountainStrip.y = Math.max(0, height - mountainHeight);
    this.updateMask();
  }

  public setPosition(offsetX: number, offsetY: number) {
    this.container.x = offsetX;
    this.container.y = offsetY;
  }

  public destroy() {
    this.container.destroy({ children: true });
  }
}
