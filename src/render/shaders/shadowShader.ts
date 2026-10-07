export const SHADOW_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_corner;
uniform mat4 u_viewProj;
uniform vec3 u_center;
uniform float u_extent;
out vec2 v_corner;
void main() {
  v_corner = a_corner;
  gl_Position = u_viewProj * vec4(u_center.x + a_corner.x * u_extent, u_center.y, u_center.z + a_corner.y * u_extent, 1.0);
}`;

export const SHADOW_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_corner;
uniform float u_strength;
out vec4 outColor;
void main() {
  vec2 p = abs(v_corner);
  float r = pow(pow(p.x, 4.0) + pow(p.y, 4.0), 0.25);
  float a = (1.0 - smoothstep(0.52, 1.0, r)) * u_strength;
  outColor = vec4(0.0, 0.0, 0.0, a);
}`;

