/**
 * Chaos Garden - Soil Grid Shaders
 *
 * Bilinear sampling shader for 2-channel living soil (Moisture & Nitrates).
 * Maps scalar fields to deep earthen loam tones, moisture sheen, and glowing bioluminescent veins.
 */

export const soilVertexShader = `
precision mediump float;
attribute vec2 aPosition;
attribute vec2 aUV;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;

varying vec2 vUV;

void main() {
    vUV = aUV;
    gl_Position = vec4((uProjectionMatrix * uWorldTransformMatrix * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
}
`;

export const soilFragmentShader = `
precision mediump float;

varying vec2 vUV;
uniform sampler2D uTexture;
uniform float uTime;

void main() {
    vec4 texel = texture2D(uTexture, vUV);
    float moisture = texel.r;
    float nitrates = texel.g;

    // Base dry earthen loam
    vec3 dryLoam = vec3(0.10, 0.08, 0.06);

    // Deep forest loam (hydrated)
    vec3 wetLoam = vec3(0.06, 0.17, 0.11);

    // Bioluminescent nutrient glow (emerald & cyan veins)
    vec3 nutrientGlow = vec3(0.06, 0.72, 0.51);

    // Subtle gentle pulse in high-nitrate veins
    float pulse = 0.9 + 0.1 * sin(uTime * 2.0 + (vUV.x + vUV.y) * 12.0);

    // Blend base soil moisture
    vec3 soilColor = mix(dryLoam, wetLoam, moisture);

    // Add glowing nitrate veins
    vec3 finalColor = mix(soilColor, nutrientGlow * pulse, smoothstep(0.15, 0.85, nitrates) * 0.7);

    gl_FragColor = vec4(finalColor, 1.0);
}
`;

