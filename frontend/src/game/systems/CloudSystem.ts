import { Container, Graphics } from 'pixi.js';

interface Cloud {
  graphics: Graphics;
  x: number;
  y: number;
  speed: number;
  width: number;
  height: number;
  opacity: number;
}

export class CloudSystem {
  private container: Container;
  private clouds: Cloud[] = [];
  private screenWidth: number;
  private skyHeight: number;
  private maxClouds: number = 8;

  constructor(parent: Container, screenWidth: number, skyHeight: number) {
    this.container = new Container();
    this.container.eventMode = 'none'; // Don't block clicks
    this.screenWidth = screenWidth;
    this.skyHeight = skyHeight;
    parent.addChild(this.container);

    // Create initial clouds
    this.initializeClouds();
  }

  private initializeClouds() {
    for (let i = 0; i < this.maxClouds; i++) {
      this.createCloud(Math.random() * this.screenWidth);
    }
  }

  private createCloud(startX: number = this.screenWidth + 50): Cloud {
    const width = 40 + Math.random() * 80;
    const height = 15 + Math.random() * 25;

    const cloud: Cloud = {
      graphics: new Graphics(),
      x: startX,
      y: 5 + Math.random() * (this.skyHeight - 30),
      speed: 0.01 + Math.random() * 0.02,
      width,
      height,
      opacity: 0.3 + Math.random() * 0.4,
    };

    this.drawCloud(cloud);
    this.container.addChild(cloud.graphics);
    this.clouds.push(cloud);

    return cloud;
  }

  private drawCloud(cloud: Cloud) {
    const { graphics, width, height } = cloud;
    graphics.clear();

    // Draw cloud as overlapping ellipses
    const numBlobs = 3 + Math.floor(Math.random() * 3);

    for (let i = 0; i < numBlobs; i++) {
      const blobX = (width / numBlobs) * i + (width / numBlobs) * 0.5;
      const blobY = height * 0.5 + Math.sin(i * 0.8) * height * 0.2;
      const blobWidth = width / numBlobs + Math.random() * 10;
      const blobHeight = height * 0.6 + Math.random() * height * 0.4;

      graphics.ellipse(blobX, blobY, blobWidth * 0.6, blobHeight * 0.5);
    }

    graphics.fill({ color: 0xffffff, alpha: cloud.opacity });
  }

  public update(deltaMs: number) {
    // Move clouds and recycle them
    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const cloud = this.clouds[i];
      cloud.x -= cloud.speed * deltaMs;
      cloud.graphics.x = cloud.x;

      // Recycle cloud if it goes off screen
      if (cloud.x + cloud.width < -50) {
        cloud.graphics.destroy();
        this.clouds.splice(i, 1);

        // Create a new cloud on the right
        this.createCloud();
      }
    }

    // Ensure we have enough clouds
    while (this.clouds.length < this.maxClouds) {
      this.createCloud();
    }
  }

  public resize(screenWidth: number, skyHeight: number) {
    this.screenWidth = screenWidth;
    this.skyHeight = skyHeight;
  }

  public destroy() {
    this.clouds.forEach((cloud) => {
      cloud.graphics.destroy();
    });
    this.container.destroy();
  }
}
