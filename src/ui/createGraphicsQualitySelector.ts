import Phaser from 'phaser';
import { t } from '../i18n';
import {
  getGraphicsQuality,
  graphicsQualities,
  setGraphicsQuality,
  type GraphicsQuality,
} from '../settings/graphicsQuality';
import { createSegmentedSetting } from './createSegmentedSetting';

const qualityLabels: Record<GraphicsQuality, 'qualityLow' | 'qualityMedium' | 'qualityHigh'> = {
  low: 'qualityLow',
  medium: 'qualityMedium',
  high: 'qualityHigh',
};

export interface GraphicsQualitySelector {
  container: Phaser.GameObjects.Container;
  refresh: () => void;
  setEnabled: (enabled: boolean) => void;
}

export function createGraphicsQualitySelector(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  scale: number,
  onChange: (quality: GraphicsQuality) => void,
): GraphicsQualitySelector {
  return createSegmentedSetting(scene, x, y, scale, {
    width,
    label: t('graphicsQuality'),
    options: graphicsQualities.map((quality) => ({ value: quality, text: t(qualityLabels[quality]) })),
    get: getGraphicsQuality,
    set: (quality) => {
      setGraphicsQuality(quality);
      onChange(quality);
    },
  });
}
