import { computeCamera, type ViewState } from './camera';
import { SUN_DIR } from './light';
import { LIGHTING, type Lighting } from './lighting';
import { VERTEX_STRIDE, type Mesh } from './mesher';
import { MESH_FRAGMENT, MESH_VERTEX } from './shaders/meshShader';
import { SHADOW_FRAGMENT, SHADOW_VERTEX } from './shaders/shadowShader';
import type { ViewRenderer } from './types';

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Could not create a shader.');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile failed: ${log}`);
  }
  return shader;
}

function link(gl: WebGL2RenderingContext, vertex: string, fragment: string): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error('Could not create a program.');
  const vs = compile(gl, gl.VERTEX_SHADER, vertex);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragment);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link failed: ${log}`);
  }
  return program;
}

type Uniforms = Record<string, WebGLUniformLocation | null>;

function locations(gl: WebGL2RenderingContext, program: WebGLProgram, names: string[]): Uniforms {
  const out: Uniforms = {};
  for (const name of names) out[name] = gl.getUniformLocation(program, name);
  return out;
}

interface Resources {
  mesh: WebGLProgram;
  shadow: WebGLProgram;
  vao: WebGLVertexArrayObject;
  vertexBuffer: WebGLBuffer;
  indexBuffer: WebGLBuffer;
  shadowVao: WebGLVertexArrayObject;
  shadowBuffer: WebGLBuffer;
  uniforms: Uniforms;
  shadowUniforms: Uniforms;
}

/** Draws the whole voxel mesh with a single indexed draw call. Requires WebGL2. */
export class WebGLRenderer implements ViewRenderer {
  readonly kind = 'webgl' as const;
  private readonly gl: WebGL2RenderingContext;
  private resources: Resources | null = null;
  private mesh: Mesh | null = null;
  private lighting: Lighting = LIGHTING.night;
  private contextLost = false;
  private width = 1;
  private height = 1;

  private readonly onLost = (event: Event): void => {
    event.preventDefault();
    this.contextLost = true;
    this.resources = null;
  };
  private readonly onRestored = (): void => {
    this.contextLost = false;
    this.createResources();
    if (this.mesh) this.upload(this.mesh);
  };

  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'default' });
    if (!gl) throw new Error('WebGL2 is not available.');
    this.gl = gl;
    canvas.addEventListener('webglcontextlost', this.onLost);
    canvas.addEventListener('webglcontextrestored', this.onRestored);
    this.createResources();
  }

  private createResources(): void {
    const gl = this.gl;
    const mesh = link(gl, MESH_VERTEX, MESH_FRAGMENT);
    const shadow = link(gl, SHADOW_VERTEX, SHADOW_FRAGMENT);
    const vao = gl.createVertexArray();
    const vertexBuffer = gl.createBuffer();
    const indexBuffer = gl.createBuffer();
    const shadowVao = gl.createVertexArray();
    const shadowBuffer = gl.createBuffer();
    if (!vao || !vertexBuffer || !indexBuffer || !shadowVao || !shadowBuffer) throw new Error('Could not allocate GPU resources.');

    gl.bindVertexArray(shadowVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, shadowBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this.resources = {
      mesh, shadow, vao, vertexBuffer, indexBuffer, shadowVao, shadowBuffer,
      uniforms: locations(gl, mesh, [
        'u_viewProj', 'u_build', 'u_resolve', 'u_sun', 'u_sky', 'u_gnd',
        'u_sunCol', 'u_exposure', 'u_glow', 'u_flat', 'u_soften',
      ]),
      shadowUniforms: locations(gl, shadow, ['u_viewProj', 'u_center', 'u_extent', 'u_strength']),
    };
  }

  setMesh(mesh: Mesh): void {
    this.mesh = mesh;
    if (!this.contextLost && this.resources) this.upload(mesh);
  }

  setLighting(lighting: Lighting): void {
    this.lighting = lighting;
  }

  private upload(mesh: Mesh): void {
    const gl = this.gl;
    const r = this.resources;
    if (!r) return;
    gl.bindVertexArray(r.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, r.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, VERTEX_STRIDE, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.UNSIGNED_BYTE, true, VERTEX_STRIDE, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, VERTEX_STRIDE, 16);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 4, gl.UNSIGNED_BYTE, true, VERTEX_STRIDE, 20);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, r.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    if (this.canvas.width !== this.width) this.canvas.width = this.width;
    if (this.canvas.height !== this.height) this.canvas.height = this.height;
  }

  render(view: ViewState): void {
    const r = this.resources;
    const mesh = this.mesh;
    if (this.contextLost || !r || !mesh) return;
    const gl = this.gl;
    const light = this.lighting;
    const camera = computeCamera(view, this.width / this.height, mesh.bounds);

    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Soft contact shadow under the plot.
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(r.shadow);
    gl.uniformMatrix4fv(r.shadowUniforms.u_viewProj, false, camera.viewProj);
    gl.uniform3f(r.shadowUniforms.u_center, mesh.bounds.size / 2, -0.4, mesh.bounds.size / 2);
    gl.uniform1f(r.shadowUniforms.u_extent, mesh.bounds.size * 0.78);
    gl.uniform1f(r.shadowUniforms.u_strength, light.shadow * (1 - view.flat) * Math.min(1, view.build * 2));
    gl.bindVertexArray(r.shadowVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.useProgram(r.mesh);
    const u = r.uniforms;
    gl.uniformMatrix4fv(u.u_viewProj, false, camera.viewProj);
    gl.uniform1f(u.u_build, view.build);
    gl.uniform1f(u.u_resolve, view.resolve);
    gl.uniform3f(u.u_sun, SUN_DIR[0], SUN_DIR[1], SUN_DIR[2]);
    gl.uniform3f(u.u_sky, light.sky[0], light.sky[1], light.sky[2]);
    gl.uniform3f(u.u_gnd, light.ground[0], light.ground[1], light.ground[2]);
    gl.uniform3f(u.u_sunCol, light.sun[0], light.sun[1], light.sun[2]);
    gl.uniform1f(u.u_exposure, light.exposure);
    gl.uniform1f(u.u_glow, light.glow);
    gl.uniform1f(u.u_flat, view.flat);
    gl.uniform1f(u.u_soften, mesh.soften);
    gl.bindVertexArray(r.vao);
    gl.drawElements(gl.TRIANGLES, mesh.faceCount * 6, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored);
    const r = this.resources;
    const gl = this.gl;
    if (r) {
      gl.deleteBuffer(r.vertexBuffer);
      gl.deleteBuffer(r.indexBuffer);
      gl.deleteBuffer(r.shadowBuffer);
      gl.deleteVertexArray(r.vao);
      gl.deleteVertexArray(r.shadowVao);
      gl.deleteProgram(r.mesh);
      gl.deleteProgram(r.shadow);
    }
    this.resources = null;
    this.mesh = null;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
