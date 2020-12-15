import get from "lodash.get"
import { interpolate } from "d3-interpolate"

export default class Animator {
  static EasingFunctions = {
    linear: t => t,
    easeInQuad: t => t * t,
    easeOutQuad: t => t * (2 - t),
    easeInOutQuad: t => t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    easeInCubic: t => t * t * t,
    easeOutCubic: t => (--t) * t * t + 1,
    easeInOutCubic: t => t < .5 ? 4 * t * t * t : (t-1) * (2 * t - 2) * (2 * t - 2) + 1,
    easeInQuart: t => t * t * t * t,
    easeOutQuart: t => 1 - (--t) * t * t * t,
    easeInOutQuart: t => t < .5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,
    easeInQuint: t => t * t * t * t * t,
    easeOutQuint: t => 1 + (--t) * t * t * t * t,
    easeInOutQuint: t => t < .5 ? 16 * t * t * t * t * t : 1 + 16 * (--t) * t * t * t * t
  }
  constructor(options = {}) {
    const {
      ease = "easeInOutQuad",
      baseValue = 0,
      duration = 2000,
      verbose = false
    } = options;

    this.verbose = verbose;

    this.baseValue = baseValue;

    this.requests = [];

    this.prev = {};
    this.prevMeta = {};

    this.ease = get(Animator.EasingFunctions, ease, Animator.EasingFunctions["easeInOutQuad"]);
    this.duration = duration;

    this.timeout = null;
  }
  start(requests) {
    if (!Array.isArray(requests)) {
      requests = [requests];
    }
    for (const { to, callback, meta = {}, animateIf = () => true } of requests) {
      if (to === undefined) {
        this.requests.push({ callback, meta })
      }
      else {
        this.requests.push({
          to,
          callback,
          meta,
          animateIf
        });
      }
    }
    this.getRequest();
  }
  initRequest(request) {
    if (typeof request.to === "function") {
      request.to = request.to(this.prevMeta);
    }
    if (!Object.keys(request.to).length) {
      for (const key in this.prev) {
        request.to[key] = this.baseValue;
      }
    }
    request.meta = { ...this.prevMeta, ...request.meta };
    request.from = { ...this.prev };
    request.current = { ...this.prev };
    request.timer = 0;
    request.now = Date.now();
    request.duration = this.duration;
  }
  getRequest() {
    if ((this.timeout === null) && this.requests.length) {
      const request = this.requests.shift();

      if (request.to === undefined) {
        request.callback(this.prevMeta);
        this.prevMeta = { ...this.prevMeta, ...request.meta };
        this.getRequest();
      }
      else if (request.animateIf(this.prevMeta)) {
        this.initRequest(request);
        this.timeout = requestAnimationFrame(() => this.animate(request));
      }
      else {
        this.prevMeta = { ...this.prevMeta, ...request.meta };
        this.getRequest();
      }
    }
  }
  animate(request) {
    const now = Date.now();
    request.timer += (now - request.now);
    request.now = now;

    const t = Math.min(1.0, request.timer / request.duration),
      ease = this.ease(t);

    for (const key in request.to) {
      const from = get(request, ["from", key], this.baseValue),
        to = get(request, ["to", key], this.baseValue),
        interpolator = interpolate(from, to);
      request.current[key] = interpolator(ease);
    }
    request.callback(request.current, this.prevMeta);

    if (t < 1.0) {
      this.timeout = requestAnimationFrame(() => this.animate(request));
    }
    else {
      this.timeout = null;
      this.prev = { ...request.current };
      this.prevMeta = { ...this.prevMeta, ...request.meta };
      this.getRequest();
    }
  }
}
