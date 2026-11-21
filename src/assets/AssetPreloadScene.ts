import Phaser from 'phaser';
import { getGraphicsQuality, onGraphicsQualityChange } from '../settings/graphicsQuality';
import {
  getAllAssets,
  getBundleAssets,
  sceneAssetBundles,
  type GameAsset,
} from './assetBundles';

export const ASSET_PRELOAD_SCENE_KEY = 'AssetPreloadScene';

/** 0..1 */
export type LoadProgressListener = (progress: number) => void;

export interface LoadResult {
  /** Keys that could not be loaded (the game goes on without them). */
  failed: string[];
}

interface LoadRequest {
  keys: string[];
  onProgress?: LoadProgressListener;
  resolve: (result: LoadResult) => void;
}

/**
 * Invisible scene that runs for the whole game and owns the one loader every
 * other scene goes through. A Phaser scene's own loader is reset when the
 * scene stops; this one keeps working across scene changes, so assets can be
 * fetched in the background while the player is somewhere else.
 *
 * - loadAssets(): resolves when every asset is in the texture manager (or failed),
 *   reporting byte-weighted progress on the way. Assets that are already
 *   loaded or already on the way are not fetched twice.
 * - After the graphics quality changes, every bundle of the new quality is
 *   warmed up in the background.
 */
export class AssetPreloadScene extends Phaser.Scene {
  /** Progress (0..1) of every file this loader is fetching. */
  private readonly fileProgress = new Map<string, number>();
  private readonly failedKeys = new Set<string>();
  private readonly requests = new Set<LoadRequest>();
  private readonly assetTypes = new Map<string, 'image' | 'audio'>();
  private unsubscribeQuality?: () => void;

  constructor() {
    super({ key: ASSET_PRELOAD_SCENE_KEY, active: false, visible: false });
  }

  create(): void {
    this.load.on(Phaser.Loader.Events.FILE_PROGRESS, (file: Phaser.Loader.File, value: number) => {
      if (this.fileProgress.has(file.key)) {
        this.fileProgress.set(file.key, value);
        this.notify();
      }
    });
    this.load.on(Phaser.Loader.Events.FILE_COMPLETE, (key: string) => this.finishFile(key, false));
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.error(`Asset failed to load: ${file.src}`);
      this.finishFile(file.key, true);
    });
    // A file that downloads but cannot be decoded fails without FILE_LOAD_ERROR;
    // once the loader is idle, whatever is still pending is settled here.
    this.load.on(Phaser.Loader.Events.COMPLETE, () => {
      [...this.fileProgress.keys()].forEach((key) => {
        const loaded = this.isLoaded({ key, url: '', type: this.assetTypes.get(key) });
        if (!loaded) {
          console.error(`Asset failed to load: ${key}`);
        }
        this.finishFile(key, !loaded);
      });
    });

    this.unsubscribeQuality = onGraphicsQualityChange((quality) => {
      // Next tick: the scene that changed the quality loads what it shows first.
      this.time.delayedCall(0, () => {
        void this.loadAssets(getAllAssets(quality));
      });
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribeQuality?.());
  }

  /** Loads the assets; resolves when all of them are ready or have failed. */
  loadAssets(assets: readonly GameAsset[], onProgress?: LoadProgressListener): Promise<LoadResult> {
    const keys = [...new Set(assets.map((asset) => asset.key))];
    assets.forEach((asset) => {
      if (this.isLoaded(asset) || this.fileProgress.has(asset.key)) {
        return;
      }
      if (asset.type === 'audio' && this.sound instanceof Phaser.Sound.NoAudioSoundManager) {
        return;
      }
      this.failedKeys.delete(asset.key);
      this.fileProgress.set(asset.key, 0);
      this.assetTypes.set(asset.key, asset.type ?? 'image');
      if (asset.type === 'audio') {
        this.load.audio(asset.key, asset.url);
      } else {
        this.load.image(asset.key, asset.url as string);
      }
    });

    return new Promise((resolve) => {
      const request: LoadRequest = { keys, onProgress, resolve };
      this.requests.add(request);
      this.notify();
      if (!this.load.isLoading() && this.fileProgress.size > 0) {
        this.load.start();
      }
    });
  }

  /** Same as loadAssets, for one scene's bundle at the current quality. */
  loadScene(sceneKey: string, onProgress?: LoadProgressListener): Promise<LoadResult> {
    const bundle = sceneAssetBundles[sceneKey];
    if (!bundle) {
      return Promise.resolve({ failed: [] });
    }
    return this.loadAssets(getBundleAssets(bundle, getGraphicsQuality()), onProgress);
  }

  private isLoaded(asset: GameAsset): boolean {
    return asset.type === 'audio' ? this.cache.audio.exists(asset.key) : this.textures.exists(asset.key);
  }

  private finishFile(key: string, failed: boolean): void {
    if (!this.fileProgress.delete(key)) {
      return;
    }
    if (failed) {
      this.failedKeys.add(key);
    }
    this.notify();
  }

  private notify(): void {
    this.requests.forEach((request) => {
      let done = 0;
      let progress = 0;
      request.keys.forEach((key) => {
        const loading = this.fileProgress.get(key);
        if (loading === undefined) {
          done += 1;
          progress += 1;
        } else {
          progress += loading;
        }
      });
      request.onProgress?.(request.keys.length === 0 ? 1 : progress / request.keys.length);
      if (done === request.keys.length) {
        this.requests.delete(request);
        request.resolve({ failed: request.keys.filter((key) => this.failedKeys.has(key)) });
      }
    });
  }
}

/** The shared loader (launched by BootScene). */
export function getAssetPreloader(scene: Phaser.Scene): AssetPreloadScene {
  return scene.scene.get(ASSET_PRELOAD_SCENE_KEY) as AssetPreloadScene;
}

/** Starts a scene once its assets are loaded, so it never opens on a dark screen. */
export function startSceneWhenReady(from: Phaser.Scene, sceneKey: string, data?: object): void {
  void getAssetPreloader(from).loadScene(sceneKey).then(() => {
    if (from.sys.isActive()) {
      from.scene.start(sceneKey, data);
    }
  });
}
