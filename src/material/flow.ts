import type { ShellState } from "../domain";

export type MaterialPulse = "expand" | "media" | "volume" | "control";

export interface MaterialFlowState {
  shell: ShellState;
  cornerRadius: number;
  motionDisabled: boolean;
  lightTheme: boolean;
}

interface FlowUniforms {
  resolution: WebGLUniformLocation;
  time: WebGLUniformLocation;
  progress: WebGLUniformLocation;
  strength: WebGLUniformLocation;
  color: WebGLUniformLocation;
}

const PULSE_DURATION_MS = 760;
const FRAME_INTERVAL_MS = 1000 / 30;
const MAX_DEVICE_PIXEL_RATIO = 1.5;
const LIGHT_FLOW_COLOR: readonly [number, number, number] = [0.75, 0.86, 1];
const DARK_FLOW_COLOR: readonly [number, number, number] = [0.78, 0.89, 1];
const PULSE_STRENGTH: Record<MaterialPulse, number> = {
  expand: 1,
  media: 0.86,
  volume: 0.64,
  control: 0.48,
};

const VERTEX_SOURCE = `#version 300 es
in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const FRAGMENT_SOURCE = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 out_color;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_progress;
uniform float u_strength;
uniform vec3 u_color;

float soft_band(float value, float center, float width) {
  return exp(-pow((value - center) / width, 2.0));
}

void main() {
  float aspect = max(u_resolution.x / max(u_resolution.y, 1.0), 1.0);
  float diagonal = v_uv.x * aspect + (v_uv.y - 0.5) * 0.48;
  float sweep_center = mix(-0.3, aspect + 0.3, smoothstep(0.0, 1.0, u_progress));
  float sweep = soft_band(diagonal, sweep_center, 0.18);
  float fold = 0.72 + 0.28 * sin(v_uv.y * 8.0 + v_uv.x * 3.2 - u_time * 4.0);
  float echo = soft_band(diagonal, sweep_center - 0.34, 0.32) * 0.24;
  float envelope = pow(sin(clamp(u_progress, 0.0, 1.0) * 3.14159265), 0.82);
  float alpha = (sweep * fold * 0.14 + echo * 0.05) * envelope * u_strength;

  out_color = vec4(u_color * alpha, alpha);
}`;

export class IslandMaterialFlow {
  private readonly resizeObserver: ResizeObserver;
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vertexArray: WebGLVertexArrayObject | null = null;
  private uniforms: FlowUniforms | null = null;
  private state: MaterialFlowState | null = null;
  private frameId: number | null = null;
  private pulseStartedAt = 0;
  private pulseStrength = 0;
  private lastFrameAt = 0;
  private pendingPulse: MaterialPulse | null = null;
  private initializationFailed = false;

  constructor(
    private readonly layer: HTMLElement,
    private readonly canvas: HTMLCanvasElement,
  ) {
    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
      if (this.frameId === null) this.drawStatic();
    });
    this.resizeObserver.observe(this.layer);
    this.canvas.addEventListener("webglcontextlost", this.onContextLost, false);
    this.canvas.addEventListener("webglcontextrestored", this.onContextRestored, false);
    document.addEventListener("visibilitychange", this.onVisibilityChanged);
  }

  sync(state: MaterialFlowState): void {
    this.state = state;
    this.layer.style.setProperty("--material-radius", `${state.cornerRadius}px`);
    // Keep the GPU layer out of the compact resting states. It only becomes a
    // visible surface when the Island has room for a material response.
    const visible = state.shell === "expanded" && !state.motionDisabled;
    this.layer.hidden = !visible;

    if (!visible) {
      this.stop();
      this.pendingPulse = null;
      this.clear();
      return;
    }
    if (!this.ensureRenderer()) {
      this.layer.hidden = true;
      return;
    }

    this.resize();
    if (this.pendingPulse !== null) {
      const pending = this.pendingPulse;
      this.pendingPulse = null;
      this.beginPulse(PULSE_STRENGTH[pending]);
      return;
    }
    this.drawStatic();
  }

  pulse(kind: MaterialPulse): void {
    // An expanded transition can request its pulse just before the shell has
    // rendered. Other compact-state interactions should not queue a visual
    // response that appears later in an unrelated expansion.
    if (this.state && this.state.shell !== "expanded" && kind !== "expand") return;
    this.pendingPulse = kind;
    if (!this.canAnimate()) return;
    this.pendingPulse = null;
    this.beginPulse(PULSE_STRENGTH[kind]);
  }

  dispose(): void {
    this.stop();
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
    this.canvas.removeEventListener("webglcontextrestored", this.onContextRestored);
    document.removeEventListener("visibilitychange", this.onVisibilityChanged);
  }

  private readonly onContextLost = (event: Event): void => {
    event.preventDefault();
    this.stop();
    this.resetRenderer();
  };

  private readonly onContextRestored = (): void => {
    this.initializationFailed = false;
    if (!this.state || this.layer.hidden || !this.ensureRenderer()) return;
    this.resize();
    if (this.pendingPulse !== null && this.state.shell !== "reef") {
      const pending = this.pendingPulse;
      this.pendingPulse = null;
      this.beginPulse(PULSE_STRENGTH[pending]);
      return;
    }
    this.drawStatic();
  };

  private readonly onVisibilityChanged = (): void => {
    if (document.hidden) {
      this.stop();
      return;
    }
    if (this.pendingPulse !== null && this.canAnimate()) {
      const pending = this.pendingPulse;
      this.pendingPulse = null;
      this.beginPulse(PULSE_STRENGTH[pending]);
      return;
    }
    this.drawStatic();
  };

  private ensureRenderer(): boolean {
    if (this.initializationFailed) return false;
    if (this.gl && this.program && this.vertexArray && this.uniforms) return true;

    const gl = this.canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      stencil: false,
    });
    if (!gl) {
      this.initializationFailed = true;
      return false;
    }

    const vertexShader = this.compileShader(gl, gl.VERTEX_SHADER, VERTEX_SOURCE);
    const fragmentShader = this.compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SOURCE);
    if (!vertexShader || !fragmentShader) {
      this.initializationFailed = true;
      return false;
    }
    const program = gl.createProgram();
    if (!program) {
      this.initializationFailed = true;
      return false;
    }
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      this.initializationFailed = true;
      return false;
    }

    const vertexArray = gl.createVertexArray();
    const buffer = gl.createBuffer();
    if (!vertexArray || !buffer) {
      gl.deleteProgram(program);
      this.initializationFailed = true;
      return false;
    }
    const position = gl.getAttribLocation(program, "a_position");
    const resolution = gl.getUniformLocation(program, "u_resolution");
    const time = gl.getUniformLocation(program, "u_time");
    const progress = gl.getUniformLocation(program, "u_progress");
    const strength = gl.getUniformLocation(program, "u_strength");
    const color = gl.getUniformLocation(program, "u_color");
    if (position < 0 || !resolution || !time || !progress || !strength || !color) {
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vertexArray);
      gl.deleteProgram(program);
      this.initializationFailed = true;
      return false;
    }

    gl.bindVertexArray(vertexArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 0);

    this.gl = gl;
    this.program = program;
    this.vertexArray = vertexArray;
    this.uniforms = { resolution, time, progress, strength, color };
    return true;
  }

  private compileShader(
    gl: WebGL2RenderingContext,
    type: number,
    source: string,
  ): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    gl.deleteShader(shader);
    return null;
  }

  private resize(): void {
    const gl = this.gl;
    if (!gl || this.layer.hidden) return;
    const bounds = this.layer.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
    const width = Math.max(1, Math.round(bounds.width * scale));
    const height = Math.max(1, Math.round(bounds.height * scale));
    if (this.canvas.width === width && this.canvas.height === height) return;
    this.canvas.width = width;
    this.canvas.height = height;
    gl.viewport(0, 0, width, height);
  }

  private beginPulse(strength: number): void {
    if (!this.canAnimate()) return;
    this.pulseStartedAt = performance.now();
    this.pulseStrength = strength;
    this.lastFrameAt = 0;
    this.start();
  }

  private start(): void {
    if (this.frameId !== null) return;
    this.frameId = requestAnimationFrame(this.frame);
  }

  private stop(): void {
    if (this.frameId === null) return;
    cancelAnimationFrame(this.frameId);
    this.frameId = null;
  }

  private readonly frame = (now: number): void => {
    this.frameId = null;
    if (!this.canAnimate()) return;
    const elapsed = now - this.pulseStartedAt;
    if (elapsed >= PULSE_DURATION_MS) {
      this.drawStatic();
      return;
    }
    if (now - this.lastFrameAt >= FRAME_INTERVAL_MS) {
      this.lastFrameAt = now;
      this.draw(now, elapsed / PULSE_DURATION_MS, this.pulseStrength);
    }
    this.start();
  };

  private drawStatic(): void {
    if (!this.gl || !this.program || !this.vertexArray || !this.uniforms || this.layer.hidden) return;
    this.draw(performance.now(), 1, 0);
  }

  private draw(now: number, progress: number, strength: number): void {
    const gl = this.gl;
    const program = this.program;
    const vertexArray = this.vertexArray;
    const uniforms = this.uniforms;
    const state = this.state;
    if (!gl || !program || !vertexArray || !uniforms || !state) return;
    const [red, green, blue] = state.lightTheme ? LIGHT_FLOW_COLOR : DARK_FLOW_COLOR;
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (strength <= 0) return;
    gl.useProgram(program);
    gl.bindVertexArray(vertexArray);
    gl.uniform2f(uniforms.resolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(uniforms.time, now / 1000);
    gl.uniform1f(uniforms.progress, Math.min(1, Math.max(0, progress)));
    gl.uniform1f(uniforms.strength, strength);
    gl.uniform3f(uniforms.color, red, green, blue);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  private clear(): void {
    if (!this.gl) return;
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  private canAnimate(): boolean {
    return Boolean(
      this.gl &&
        this.program &&
        this.vertexArray &&
        this.uniforms &&
        this.state &&
        this.state.shell !== "hidden" &&
        !this.state.motionDisabled &&
        !this.layer.hidden &&
        !document.hidden,
    );
  }

  private resetRenderer(): void {
    this.gl = null;
    this.program = null;
    this.vertexArray = null;
    this.uniforms = null;
  }
}
