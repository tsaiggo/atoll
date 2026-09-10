import type { AppViewModel } from "../app/types";
import type { ShellState } from "../domain";
import { notchGeometry, type NotchEdge, type NotchGeometry } from "../shell/geometry";
import { geometryFrame, mix, MOTION, spring, springTiming, timingCurve } from "../shell/motion";
import { CODENOTCH as C } from "../shell/codenotch";

export type FrameSink = (geometry: NotchGeometry, shell: ShellState, edge: NotchEdge) => Promise<void>;
const animators = new WeakMap<HTMLElement, NotchAnimator>();
const clamp = (n: number) => Math.max(0,Math.min(1,n));
function ghostMarkup(element: Element | null): string {
  if (!element) return "";
  const clone=element.cloneNode(true) as HTMLElement;
  clone.setAttribute("inert","");clone.setAttribute("aria-hidden","true");
  clone.removeAttribute("id");
  for (const child of clone.querySelectorAll("[id],[data-action],[data-control]")) {
    child.removeAttribute("id");child.removeAttribute("data-action");child.removeAttribute("data-control");
  }
  return clone.outerHTML;
}
interface Reading { from: number; to: number; current: number; start: number; label: string }
class NotchAnimator {
  current: NotchGeometry | null = null;
  private from: NotchGeometry | null = null;
  private target: NotchGeometry | null = null;
  private state: ShellState = "hidden";
  private fromState: ShellState = "hidden";
  private edge: NotchEdge = "top";
  private key = "";
  private start = 0;
  private duration = 0;
  private busy = false;
  private epoch = 0;
  private railGhost = "";
  private orbGhost = "";
  private detailGhost = "";
  private reduced = false;
  private sink?: FrameSink;
  private readings = new Map<string, Reading>();
  private refreshing = false;
  private refreshStarted = 0;
  constructor(private root: HTMLElement) {
    root.style.setProperty("--orb-spring",springTiming(.36,.7));
    root.style.setProperty("--refresh-spring",springTiming(.3,.62));
  }

  prepare(vm: AppViewModel): void {
    const next=notchGeometry(vm.shell === "hidden" ? "reef" : vm.shell,vm.settings.notchEdge,vm.expandedPanel);
    const key=`${vm.shell}:${vm.settings.notchEdge}:${next.path}`;
    this.reduced=vm.motionDisabled;
    if (key!==this.key || (this.reduced && this.duration>0)) {
      const sameEdge=this.edge===vm.settings.notchEdge;
      const canAnimate=Boolean(this.current && sameEdge && !this.reduced && this.state!=="hidden" && vm.shell!=="hidden");
      this.fromState=this.state;
      this.from=this.current??next;
      this.target=next;
      this.start=performance.now();
      this.duration=canAnimate?(this.state==="reef"||vm.shell==="reef"?MOTION.unfold.response:MOTION.glide.response)*1.65:0;
      this.railGhost=vm.shell==="reef"?ghostMarkup(this.root.querySelector(".notch-rail")):"";
      this.orbGhost=vm.shell==="reef"?ghostMarkup(this.root.querySelector(".notch-settings")):"";
      this.detailGhost=ghostMarkup(this.root.querySelector(".notch-detail > .expanded"));
      this.state=vm.shell;this.edge=vm.settings.notchEdge;this.key=key;this.epoch++;
      if (!this.duration) this.current=next;
    }
  }
  present(vm: AppViewModel, sink?: FrameSink): void {
    this.sink=sink;
    if (!this.target) return;
    if (this.duration) {
      if (this.railGhost) this.root.insertAdjacentHTML("beforeend",`<div class="notch-motion-ghost" inert aria-hidden="true">${this.railGhost}${this.orbGhost}</div>`);
      if (this.detailGhost) {
        let detail=this.root.querySelector<HTMLElement>(".notch-detail");
        if (!detail && this.from?.panel) {
          detail=document.createElement("div");detail.className="notch-detail notch-motion-ghost";detail.inert=true;this.root.append(detail);
        }
        detail?.insertAdjacentHTML("beforeend",`<div class="notch-crossfade-old" inert aria-hidden="true">${this.detailGhost}</div>`);
      }
    }
    this.captureReadings();
    const refreshing=vm.pendingCodexUsageAction==="refresh";
    if (refreshing && !this.refreshing && !this.reduced) this.refreshStarted=performance.now();
    this.refreshing=refreshing;
    this.root.querySelector<HTMLElement>('[data-notch-panel="codex"] .notch-ring__visual')?.style.setProperty("scale",refreshing?".93":"1");
    this.paint(this.current??this.target,performance.now());
    this.schedule();
  }
  private captureReadings(): void {
    for (const button of this.root.querySelectorAll<HTMLElement>(".notch-ring")) {
      const circle=button.querySelector<SVGCircleElement>(".notch-ring__signal"), key=button.dataset.notchPanel;
      if (!circle || !key) continue;
      const to=Number(circle.getAttribute("stroke-dashoffset"));
      const old=this.readings.get(key);
      const label=button.querySelector(".notch-ring__value")?.textContent??"";
      if (!old) this.readings.set(key,{from:to,to,current:to,start:0,label});
      else if (to!==old.to) this.readings.set(key,{from:old.current,to,current:old.current,start:performance.now(),label});
    }
    for (const meter of this.root.querySelectorAll<HTMLElement>(".codex-usage__meter")) {
      const key="bar:"+meter.getAttribute("aria-label"), fill=meter.firstElementChild as HTMLElement | null;
      if (!fill) continue;
      const to=Number(fill.style.transform.match(/scaleX\(([^)]+)\)/)?.[1]??0), old=this.readings.get(key);
      if (!old) this.readings.set(key,{from:to,to,current:to,start:0,label:""});
      else if (to!==old.to) this.readings.set(key,{from:old.current,to,current:old.current,start:performance.now(),label:""});
    }
  }
  private schedule(): void {
    if (this.busy) return;
    this.busy=true;
    requestAnimationFrame(()=>void this.tick());
  }
  private async tick(): Promise<void> {
    const epoch=this.epoch, now=performance.now(), target=this.target;
    if (!target) {this.busy=false;return;}
    const elapsed=(now-this.start)/1000, done=!this.duration || elapsed>=this.duration;
    const spec=this.fromState==="reef"||this.state==="reef"?MOTION.unfold:MOTION.glide;
    const amount=done?1:spring(elapsed,spec.response,spec.damping);
    const frame=done?target:geometryFrame(this.from??target,target,this.edge,amount);
    try {
      // Native region and visible contour consume the same frame. No separate
      // resize spring or delayed content reveal can get ahead of this clock.
      await this.sink?.(frame,this.state,this.edge);
      if (epoch===this.epoch) {
        this.current=frame;this.paint(frame,now);
        if (done) {
          this.duration=0;
          for (const node of this.root.querySelectorAll(".notch-motion-ghost,.notch-crossfade-old")) node.remove();
          delete this.root.dataset.notchAnimating;
        } else this.root.dataset.notchAnimating="";
      }
    } catch (error) {
      console.warn("Unable to present notch frame",error);
      this.root.dataset.notchFrameError=String(error);
      // Stop until a new render retries; do not spin an unbounded failing IPC loop.
      this.duration=0;this.busy=false;return;
    }
    this.busy=false;
    const readingActive=[...this.readings.values()].some(r=>r.start>0&&(now-r.start)<MOTION.reading.response*1650);
    if (epoch!==this.epoch || this.duration>0 || readingActive || (this.refreshStarted>0 && now-this.refreshStarted<950)) this.schedule();
  }
  private paint(frame: NotchGeometry, now: number): void {
    const elapsed=(now-this.start)/1000;
    const active=this.duration>0;
    const amount=active?timingCurve(clamp(elapsed/MOTION.crossfade),.42,0,.58,1):1;
    const opening=this.fromState==="reef" && this.state!=="reef";
    const closing=this.state==="reef" && this.fromState!=="reef";
    const parts=frame.path.split(" Z");
    this.root.querySelector(".notch-outline")?.setAttribute("d",parts[0]+" Z");
    const bubble=this.root.querySelector<SVGElement>(".notch-bubble-outline");
    bubble?.setAttribute("d",parts.slice(1).join(" Z"));
    if (bubble) bubble.style.opacity=String(this.from?.panel && this.target?.panel ? 1 : this.target?.panel ? amount : 1-amount);
    const hits=this.root.querySelector(".notch-hit-regions");
    if (hits) {
      // Keep hit targets alive throughout a transition. Replacing them every
      // frame generates artificial enter/leave events under a stationary mouse.
      while (hits.children.length>frame.regions.length) hits.lastElementChild?.remove();
      frame.regions.forEach((r,index)=>{
        let polygon=hits.children[index];
        if (!polygon) { polygon=document.createElementNS("http://www.w3.org/2000/svg","polygon");hits.append(polygon); }
        polygon.setAttribute("points",r.points.map(p=>`${p.x},${p.y}`).join(" "));
      });
    }
    // Keep contents at their full layout size; only their clip changes.
    for (const rail of this.root.querySelectorAll<HTMLElement>(".notch-rail")) {
      const x=parseFloat(rail.style.left),y=parseFloat(rail.style.top);
      rail.style.clipPath=`polygon(${frame.regions[0].points.map(p=>`${p.x-x}px ${p.y-y}px`).join(",")})`;
      rail.querySelectorAll<HTMLElement>(".notch-ring").forEach((ring,index)=>{
        const delay=Math.min(index*MOTION.stagger,MOTION.maxStagger);
        const p=!active?1:spring(Math.max(0,elapsed-(opening?delay:0)),MOTION.contents.response,MOTION.contents.damping);
        const shown=opening?p:closing?1-p:1;
        ring.style.opacity=String(clamp(shown));
        const distance=(1-shown)*C.tailGap;
        ring.style.transform=this.edge==="left"?`translateX(${-distance}px)`:this.edge==="right"?`translateX(${distance}px)`:this.edge==="top"?`translateY(${-distance}px)`:`translateY(${distance}px)`;
      });
    }
    for (const orb of this.root.querySelectorAll<HTMLElement>(".notch-settings")) {
      const p=closing?timingCurve(clamp(elapsed/MOTION.merge),.42,0,1,1):opening?clamp(spring(Math.max(0,elapsed-MOTION.maxStagger),.36,.82)):1;
      orb.style.opacity=String(closing?1-p:p);
      orb.style.scale=String(closing?mix(1,(C.curl+C.orbStroke)/(C.curl-C.orbGap),p):1);
    }
    const detail=this.root.querySelector<HTMLElement>(".notch-detail");
    if (detail && frame.panel) {
      const p=frame.panel;
      Object.assign(detail.style,{left:`${p.x}px`,top:`${p.y}px`,width:`${p.width}px`,height:`${p.height}px`});
      const content=detail.querySelector<HTMLElement>(":scope > .expanded");
      if (content) {
        content.style.width=`${this.target?.panel?.width??p.width}px`;
        content.style.height=`${this.target?.panel?.height??p.height}px`;
        content.style.opacity=String(amount);
      }
      const old=detail.querySelector<HTMLElement>(".notch-crossfade-old");
      if (old) old.style.opacity=String(1-amount);
    }
    // Ring and number readings share the slower measurement spring. Routine
    // DOM repaints resume from the current interpolated value rather than reset.
    for (const button of this.root.querySelectorAll<HTMLElement>(".notch-ring")) {
      const r=this.readings.get(button.dataset.notchPanel??"");
      if (!r) continue;
      const elapsedReading=(now-r.start)/1000;
      const p=this.reduced||!r.start||elapsedReading>=MOTION.reading.response*1.65?1:spring(elapsedReading,.9,.9);
      r.current=mix(r.from,r.to,p);
      button.querySelector(".notch-ring__signal")?.setAttribute("stroke-dashoffset",String(r.current));
      const label=button.querySelector<HTMLElement>(".notch-ring__value");
      if (label && r.label.endsWith("%") && r.start>0) {
        const ratio=1-r.current/(Math.PI*(C.ring-C.track));
        label.textContent=p===1?r.label:`${Math.round(clamp(ratio)*100)}%`;
      }
    }
    for (const meter of this.root.querySelectorAll<HTMLElement>(".codex-usage__meter")) {
      const r=this.readings.get("bar:"+meter.getAttribute("aria-label")), fill=meter.firstElementChild as HTMLElement | null;
      if (!r || !fill) continue;
      const elapsedReading=(now-r.start)/1000;
      const p=this.reduced||!r.start||elapsedReading>=1.485?1:spring(elapsedReading,.9,.9);
      r.current=mix(r.from,r.to,p);fill.style.transform=`scaleX(${clamp(r.current)})`;
    }
    if (this.refreshStarted>0 && !this.reduced) {
      const p=clamp((now-this.refreshStarted)/950);
      const angle=-90+360*timingCurve(p,.32,0,.14,1);
      this.root.querySelector<SVGElement>('[data-notch-panel="codex"] .notch-ring__signal')?.style.setProperty("transform",`rotate(${angle}deg)`);
    }
  }
}
export function prepareNotchMotion(root: HTMLElement, vm: AppViewModel): void {
  let animator=animators.get(root);
  if (!animator) {animator=new NotchAnimator(root);animators.set(root,animator);}
  animator.prepare(vm);
}
export function presentNotchMotion(root: HTMLElement, vm: AppViewModel, sink?: FrameSink): void {
  animators.get(root)?.present(vm,sink);
}
