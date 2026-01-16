import { Container, Graphics, Sprite, Texture } from 'pixi.js';

interface Cloud {
  sprite: Sprite;
  x: number;
  y: number;
  speed: number;
  width: number;
  height: number;
  opacity: number;
}

export class SurfaceClouds {
  private container: Container;
  private maskGraphic: Graphics;
  private clouds: Cloud[] = [];
  private width: number;
  private height: number;
  private maxClouds: number;
  private texture: Texture;

  constructor(parent: Container, width: number, height: number, offsetX: number, offsetY: number) {
    this.container = new Container();
    this.container.eventMode = 'none';
    this.container.x = offsetX;
    this.container.y = offsetY;
    this.width = width;
    this.height = height;
    this.maxClouds = Math.max(3, Math.floor(width / 220));
    this.texture = Texture.from('/assets/sky/cloud.png');

    this.maskGraphic = new Graphics();
    this.maskGraphic.eventMode = 'none';
    this.container.addChild(this.maskGraphic);
    this.container.mask = this.maskGraphic;
    this.updateMask();

    parent.addChild(this.container);

    this.initializeClouds();
  }

  private initializeClouds() {
    for (let i = 0; i < this.maxClouds; i++) {
      this.createCloud(Math.random() * this.width);
    }
  }

  private createCloud(startX: number = this.width + 80): Cloud {
    const targetWidth = 120 + Math.random() * 160;
    const scale = targetWidth / this.texture.width;
    const width = this.texture.width * scale;
    const height = this.texture.height * scale;
    const yMax = Math.max(4, this.height - height - 6);
    const y = 4 + Math.random() * yMax;

    const sizeFactor = 1 - (targetWidth - 120) / 160;
    const cloud: Cloud = {
      sprite: new Sprite(this.texture),
      x: startX,
      y,
      speed: 0.002 + sizeFactor * 0.007 + Math.random() * 0.0015,
      width,
      height,
      opacity: 0.32 + Math.random() * 0.28,
    };

    cloud.sprite.eventMode = 'none';
    cloud.sprite.x = cloud.x;
    cloud.sprite.y = cloud.y;
    cloud.sprite.width = width;
    cloud.sprite.height = height;
    cloud.sprite.alpha = cloud.opacity;
    this.container.addChild(cloud.sprite);
    this.clouds.push(cloud);

    return cloud;
  }

  private updateMask() {
    this.maskGraphic.clear();
    this.maskGraphic.rect(0, 0, this.width, this.height);
    this.maskGraphic.fill({ color: 0xffffff, alpha: 1 });
  }

  public update(deltaMs: number) {
    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const cloud = this.clouds[i];
      cloud.x -= cloud.speed * deltaMs;
      cloud.sprite.x = cloud.x;

      if (cloud.x + cloud.width < -80) {
        cloud.sprite.destroy();
        this.clouds.splice(i, 1);
        this.createCloud();
      }
    }

    while (this.clouds.length < this.maxClouds) {
      this.createCloud();
    }
  }

  public resize(width: number, height: number, offsetX: number, offsetY: number) {
    this.width = width;
    this.height = height;
    this.container.x = offsetX;
    this.container.y = offsetY;
    this.maxClouds = Math.max(3, Math.floor(width / 220));
    this.updateMask();
  }

  public setPosition(offsetX: number, offsetY: number) {
    this.container.x = offsetX;
    this.container.y = offsetY;
  }

  public destroy() {
    this.clouds = [];
    this.container.destroy({ children: true });
  }
}
