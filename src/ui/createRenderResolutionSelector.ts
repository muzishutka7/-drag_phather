import Phaser from 'phaser';
import { t } from '../i18n';
import {
  getRenderResolution,
  renderResolutions,
  setRenderResolution,
  type RenderResolution,
} from '../settings/renderResolution';
import { createSegmentedSetting } from './createSegmentedSetting';

const resolutionLabels: Record<RenderResolution, 'resolutionLow' | 'resolutionMedium' | 'resolutionHigh'> = {
  low: 'resolutionLow',
  medium: 'resolutionMedium',
  high: 'resolutionHigh',
};

export interface RenderResolutionSelector {
  container: Phaser.GameObjects.Container;
  refresh: () => void;
  setEnabled: (enabled: boolean) => void;
}

export function createRenderResolutionSelector(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  scale: number,
  onChange: (resolution: RenderResolution) => void,
): RenderResolutionSelector {
  return createSegmentedSetting(scene, x, y, scale, {
    width,
    label: t('renderResolution'),
    options: renderResolutions.map((resolution) => ({ value: resolution, text: t(resolutionLabels[resolution]) })),
    get: getRenderResolution,
    set: (resolution) => {
      setRenderResolution(resolution);
      onChange(resolution);
    },
  });
}
