/**
 * Chaos Garden - Fullscreen Atmospheric & Post-Processing Filter
 *
 * Provides diurnal lighting tints (Dawn, Day, Dusk, Night),
 * additive bioluminescent bloom highlights, and weather moisture overlays.
 */

export const atmosphericVertexShader = `
precision mediump float;
attribute vec2 aPosition;
attribute vec2 aUV;

uniform mat3 uProjectionMatrix;

varying vec2 vUV;

void main() {
    vUV = aUV;
    gl_Position = vec4((uProjectionMatrix * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
}
`;

export const atmosphericFragmentShader = `
precision mediump float;

varying vec2 vUV;
uniform sampler2D uTexture;
uniform float uSunlight;     // 0.0 = night, 1.0 = noon
uniform float uWeatherRain;   // 0.0 = clear, 1.0 = storm
uniform float uTime;

void main() {
    vec4 color = texture2D(uTexture, vUV);

    // Diurnal color grading:
    // Night: Deep navy darkness (0.1, 0.15, 0.3)
    // Dawn/Dusk: Rose-gold & violet
    // Day: Neutral bright
    vec3 nightTint = vec3(0.35, 0.45, 0.70);
    vec3 dayTint = vec3(1.0, 1.0, 1.0);
    vec3 dawnTint = vec3(1.1, 0.85, 0.75);

    vec3 ambientGrade = mix(nightTint, dayTint, uSunlight);

    // Weather dimming
    ambientGrade *= (1.0 - uWeatherRain * 0.3);

    // Preserve bioluminescence in the dark:
    // Pixels with strong green/cyan/magenta emissions pop out strongly against night ambient
    float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    float bioMask = smoothstep(0.4, 0.9, luminance);

    // Apply lighting: non-emissive darkens at night, emissive organisms remain vibrant
    vec3 finalRgb = mix(color.rgb * ambientGrade, color.rgb * 1.15, bioMask);

    gl_FragColor = vec4(finalRgb, color.a);
}
`;

