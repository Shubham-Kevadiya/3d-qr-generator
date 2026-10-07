export const MESH_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec3 a_pos;
layout(location = 1) in vec4 a_col;
layout(location = 2) in vec4 a_aux;
layout(location = 3) in vec4 a_alt;
uniform mat4 u_viewProj;
uniform float u_build;
uniform float u_resolve;
uniform vec3 u_sun;
uniform vec3 u_sky;
uniform vec3 u_gnd;
uniform vec3 u_sunCol;
uniform float u_exposure;
uniform float u_glow;
uniform float u_soften;
out vec3 v_albedo;
out vec3 v_light;
const vec3 NORMALS[6] = vec3[6](
  vec3(1.0, 0.0, 0.0), vec3(-1.0, 0.0, 0.0),
  vec3(0.0, 1.0, 0.0), vec3(0.0, -1.0, 0.0),
  vec3(0.0, 0.0, 1.0), vec3(0.0, 0.0, -1.0));
void main() {
  int ni = int(a_aux.x * 255.0 + 0.5);
  vec3 n = NORMALS[ni];
  int flags = int(a_aux.w * 255.0 + 0.5);
  bool ground = flags >= 128;
  if (ground && ni != 2) n = normalize(mix(n, vec3(0.0, 1.0, 0.0), u_soften));
  bool emissive = (flags & 64) != 0;
  float span = a_aux.z;

  // Voxel center from this vertex: faces are emitted as four consecutive corners.
  int axis = ni / 2;
  float sgn = (ni % 2 == 0) ? 1.0 : -1.0;
  int corner = gl_VertexID & 3;
  float iu = (corner == 1 || corner == 2) ? 1.0 : 0.0;
  float iv = (corner >= 2) ? 1.0 : 0.0;
  vec3 off;
  if (axis == 0) off = vec3(-0.5 * sgn, 0.5 - iu, 0.5 - iv);
  else if (axis == 1) off = vec3(0.5 - iv, -0.5 * sgn, 0.5 - iu);
  else off = vec3(0.5 - iu, 0.5 - iv, -0.5 * sgn);
  vec3 center = a_pos + off;

  float scale = 1.0;
  vec3 shift = vec3(0.0);
  bool hidden = false;
  if (ground) {
    // Tiles grow outward from the middle.
    float t = clamp(u_build * 1.9 - span * 0.9, 0.0, 1.0);
    float e = 1.0 - pow(1.0 - t, 3.0);
    scale = e;
    shift.y = -(1.0 - e) * 2.0;
    hidden = t <= 0.0;
  } else {
    // The object grows upward after the plot has formed.
    float t = clamp((u_build - span * 0.45 - 0.2) / 0.35, 0.0, 1.0);
    float e = 1.0 - pow(1.0 - t, 3.0);
    scale = e;
    shift.y = -(1.0 - e) * 3.0;
    hidden = t <= 0.0;
  }
  vec3 pos = center + (a_pos - center) * scale + shift;
  gl_Position = hidden ? vec4(2.0, 2.0, 2.0, 1.0) : u_viewProj * vec4(pos, 1.0);

  float sky = n.y * 0.5 + 0.5;
  vec3 ambient = mix(u_gnd, u_sky, sky);
  float lambert = max(dot(n, u_sun), 0.0);
  float ao = a_col.a;
  vec3 sun = u_sunCol * lambert * (1.0 - a_aux.y * 0.82) * mix(0.55, 1.0, ao);
  vec3 light = (ambient * ao + sun) * u_exposure;
  if (emissive) light += vec3(u_glow);
  v_albedo = mix(a_col.rgb, a_alt.rgb, u_resolve);
  v_light = light;
}`;

export const MESH_FRAGMENT = `#version 300 es
precision highp float;
in vec3 v_albedo;
in vec3 v_light;
uniform float u_flat;
out vec4 outColor;
void main() {
  vec3 linear = pow(v_albedo, vec3(2.2)) * v_light;
  linear = linear / (1.0 + max(linear - 0.7, 0.0));
  vec3 lit = pow(clamp(linear, 0.0, 1.0), vec3(1.0 / 2.2));
  outColor = vec4(mix(lit, v_albedo, u_flat), 1.0);
}`;

