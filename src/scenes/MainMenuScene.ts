import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig';
import { palette } from '../config/palette';
import { createDeliveryVan } from '../gameobjects/cars/createDeliveryVan';
import { createSportsCoupe } from '../gameobjects/cars/createSportsCoupe';
import { createUiText } from '../ui/createUiText';

export class MainMenuScene extends Phaser.Scene {
  private menuContainer?: Phaser.GameObjects.Container;

  constructor() {
    super('MainMenuScene');
  }

  create(): void {
    this.drawMenu(this.scale.width, this.scale.height);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    });
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.drawMenu(gameSize.width, gameSize.height);
  }

  private drawMenu(width: number, height: number): void {
    this.menuContainer?.destroy(true);
    this.menuContainer = this.add.container(0, 0);

    const scale = Math.min(width / GAME_WIDTH, height / GAME_HEIGHT);
    const centerX = width / 2;
    const trackTop = height * 0.58;
    const trackHeight = height * 0.28;
    const carY = trackTop + trackHeight * 0.53;
    const carOffset = Math.min(width * 0.16, 150 * scale);

    this.drawTrack(width, trackTop, trackHeight, scale);
    this.menuContainer.add(
      createSportsCoupe({
        scene: this,
        x: centerX - carOffset,
        y: carY,
        color: palette.sportsCoupe,
        scale,
      }),
    );
    this.menuContainer.add(
      createDeliveryVan({
        scene: this,
        x: centerX + carOffset,
        y: carY,
        color: palette.deliveryVan,
        scale,
      }),
    );

    this.menuContainer.add(
      createUiText(this, centerX, height * 0.12, 'gameTitle', 'title', scale),
    );

    this.menuContainer.add(
      createUiText(this, centerX, height * 0.22, 'gameMode', 'mode', scale),
    );

    this.menuContainer.add(
      this.add.rectangle(centerX, height * 0.305, 46 * scale, 3 * scale, palette.accent),
    );

    this.menuContainer.add(
      createUiText(this, centerX, height * 0.36, 'tagline', 'tagline', scale),
    );

    this.menuContainer.add(
      createUiText(this, centerX, height - 24 * scale, 'footer', 'footer', scale),
    );
  }

  private drawTrack(width: number, top: number, height: number, scale: number): void {
    const graphics = this.add.graphics();

    graphics.fillStyle(palette.track);
    graphics.fillRect(0, top, width, height);

    graphics.lineStyle(2 * scale, palette.trackBorder, 1);
    graphics.lineBetween(0, top, width, top);
    graphics.lineBetween(0, top + height, width, top + height);

    graphics.lineStyle(2 * scale, palette.trackDash, 0.8);
    for (let x = 20 * scale; x < width; x += 64 * scale) {
      graphics.lineBetween(x, top + height * 0.49, x + 32 * scale, top + height * 0.49);
    }

    this.menuContainer?.add(graphics);
  }

}
