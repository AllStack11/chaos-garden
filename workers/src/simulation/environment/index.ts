/**
 * Environment System - Main Exports
 * 
 * A modular system for simulating environmental conditions,
 * weather patterns, and their effects on digital life.
 * 
 * This barrel file provides clean, organized exports
 * for all environment-related functionality.
 */

// Constants
export * from './constants';

// Core helpers (moved from simulation root)
export * from './helpers';

// Sunlight and day/night cycles
export * from './sunlight-calculator';

// Weather state definitions and state machine
export * from './weather-state-definitions';
export * from './weather-state-machine';

// Weather simulation and updates
export * from './weather-updater';

// Environmental effects on creatures
export * from './creature-effects';

// Condition checking and habitability
export * from './conditions-checker';