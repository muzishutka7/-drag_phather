import Phaser from 'phaser';
import { gameConfig } from './config/gameConfig';
import './style.css';

const game = new Phaser.Game(gameConfig);
Object.assign(globalThis, { __PHASER_GAME__: game });
