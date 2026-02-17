import type { QualityTier } from './types.ts';

const FRAME_HISTORY_SIZE = 60;

interface DeviceQualityProfile {
  initialTier: QualityTier;
  maxTier: QualityTier;
}

export class AdaptiveQualityController {
  private frameTimes: number[] = [];
  private qualityTier: QualityTier = 'medium';
  private readonly deviceQualityProfile: DeviceQualityProfile;
  private forceHighQualityOverride: boolean;

  constructor() {
    this.forceHighQualityOverride = this.detectForceHighQualityOverride();
    this.deviceQualityProfile = this.detectDeviceQualityProfile();

    if (this.forceHighQualityOverride) {
      this.qualityTier = 'high';
    } else {
      this.qualityTier = this.deviceQualityProfile.initialTier;
    }
  }

  private detectDeviceQualityProfile(): DeviceQualityProfile {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return { initialTier: 'medium', maxTier: 'medium' };
    }

    const isMobile =
      window.matchMedia('(pointer: coarse)').matches ||
      window.matchMedia('(max-width: 767px)').matches;

    if (isMobile) {
      return { initialTier: 'low', maxTier: 'low' };
    }

    const hardwareThreads = navigator.hardwareConcurrency ?? 4;
    const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;

    const isVeryHighEndDesktop =
      hardwareThreads >= 12 &&
      deviceMemory !== undefined &&
      deviceMemory >= 16;

    if (isVeryHighEndDesktop) {
      return { initialTier: 'high', maxTier: 'high' };
    }

    const isLowEndDesktop =
      hardwareThreads <= 4 ||
      (deviceMemory !== undefined && deviceMemory <= 4);

    if (isLowEndDesktop) {
      return { initialTier: 'low', maxTier: 'low' };
    }

    return { initialTier: 'medium', maxTier: 'medium' };
  }

  private clampToDeviceTierCap(tier: QualityTier): QualityTier {
    if (this.forceHighQualityOverride) {
      return 'high';
    }

    if (this.deviceQualityProfile.maxTier === 'low') {
      return 'low';
    }

    if (this.deviceQualityProfile.maxTier === 'medium' && tier === 'high') {
      return 'medium';
    }

    return tier;
  }

  private detectForceHighQualityOverride(): boolean {
    if (typeof window !== 'undefined') {
      // Manual opt-in override for visual debugging.
      const searchParams = new URLSearchParams(window.location.search);
      const hasDevParam =
        searchParams.get('dev') === 'true' ||
        searchParams.get('debug') === 'true' ||
        searchParams.get('quality') === 'high';

      return hasDevParam;
    }
    return false;
  }

  recordFrame(frameDurationMs: number): QualityTier {
    if (this.forceHighQualityOverride) {
      this.qualityTier = 'high';
      return this.qualityTier;
    }

    this.frameTimes.push(frameDurationMs);
    if (this.frameTimes.length > FRAME_HISTORY_SIZE) {
      this.frameTimes.shift();
    }

    const averageFrame = this.frameTimes.reduce((sum, value) => sum + value, 0) / this.frameTimes.length;
    const averageFps = 1000 / Math.max(averageFrame, 1);

    if (averageFps < 50) {
      this.qualityTier = 'low';
    } else if (averageFps < 59) {
      this.qualityTier = 'medium';
    } else {
      this.qualityTier = 'high';
    }

    this.qualityTier = this.clampToDeviceTierCap(this.qualityTier);

    return this.qualityTier;
  }

  getQualityTier(): QualityTier {
    return this.qualityTier;
  }

  isDevMode(): boolean {
    return this.forceHighQualityOverride;
  }

  clampTierForDevice(tier: QualityTier): QualityTier {
    return this.clampToDeviceTierCap(tier);
  }
}
