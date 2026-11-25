/**
 * Voice call between two teammates (2v2 and team competition rooms) during the preparation minute.
 * WebRTC, audio only. The Backend only relays the signals (hub method TeamCallSignal): offer / answer / ice / hangup.
 */
import type { IceServersResponse } from "../types/debate.types";
import type { TeamCallSignalEvent, TeamCallSignalResult, TeamCallSignalType } from "./debateHub";

export type TeamCallState = "connecting" | "connected" | "failed" | "ended";

// ---------------------------------------------------------------- ICE servers

type IceFetcher = (sessionId: number) => Promise<{ success?: boolean; data?: IceServersResponse | null }>;

const iceCache = new Map<number, { servers: RTCIceServer[]; refreshAt: number }>();
const iceInFlight = new Map<number, Promise<RTCIceServer[]>>();

/** Share of the time-to-live after which the servers (their credentials) are asked for again. */
const ICE_REFRESH_SHARE = 0.8;

export function clearIceServersCache(): void {
  iceCache.clear();
  iceInFlight.clear();
}

/** The ICE servers of a session, cached per session and asked for again when their time to live is nearly over. */
export function getIceServers(sessionId: number, fetcher: IceFetcher, now: number = Date.now()): Promise<RTCIceServer[]> {
  const cached = iceCache.get(sessionId);
  if (cached && now < cached.refreshAt) return Promise.resolve(cached.servers);
  const pending = iceInFlight.get(sessionId);
  if (pending) return pending;
  const request = (async () => {
    try {
      const res = await fetcher(sessionId);
      const data = res?.data;
      if (!res?.success || !data || !Array.isArray(data.iceServers)) throw new Error("No ICE servers");
      const servers = data.iceServers as RTCIceServer[];
      const ttlMs = (data.ttlSeconds > 0 ? data.ttlSeconds : 300) * 1000;
      iceCache.set(sessionId, { servers, refreshAt: now + ttlMs * ICE_REFRESH_SHARE });
      return servers;
    } finally {
      iceInFlight.delete(sessionId);
    }
  })();
  iceInFlight.set(sessionId, request);
  return request;
}

// ------------------------------------------------------------------ the call

export interface TeamCallOptions {
  sessionId: number;
  myUserId: number;
  teammateUserId: number;
  /** The shared microphone stream: its track is cloned for the call, the original is never stopped here. */
  localStream: MediaStream;
  iceServers: RTCIceServer[];
  sendSignal: (type: TeamCallSignalType, payload: string) => Promise<TeamCallSignalResult>;
  onState: (state: TeamCallState) => void;
  onRemoteStream: (stream: MediaStream | null) => void;
  /** The browser refused to play the teammate's voice (no gesture yet): the room shows a button that resumes it. */
  onAudioBlocked: (blocked: boolean) => void;
  createPeerConnection?: (config: RTCConfiguration) => RTCPeerConnection;
  /** How long before the offer is sent again while the teammate has not joined yet. */
  resendMs?: number;
  maxResends?: number;
}

export class TeamCall {
  private pc: RTCPeerConnection | null = null;
  private localTrack: MediaStreamTrack | null = null;
  private audio: HTMLAudioElement | null = null;
  private closed = false;
  private state: TeamCallState = "connecting";
  // "Perfect negotiation" (both sides may offer at once): the side with the larger user id gives way
  private readonly polite: boolean;
  private makingOffer = false;
  private ignoreOffer = false;
  private queue: Promise<void> = Promise.resolve();
  private pendingIce: RTCIceCandidateInit[] = [];
  private localCandidates: string[] = [];
  private resendTimer: ReturnType<typeof setTimeout> | null = null;
  private resends = 0;

  constructor(private readonly opts: TeamCallOptions) {
    this.polite = opts.myUserId > opts.teammateUserId;
  }

  get isClosed(): boolean {
    return this.closed;
  }

  start(): void {
    const source = this.opts.localStream.getAudioTracks()[0];
    if (!source) {
      this.fail();
      return;
    }
    // A clone: hanging up stops the clone only, the recording and the speech-to-text keep the original
    this.localTrack = source.clone();
    const config: RTCConfiguration = { iceServers: this.opts.iceServers };
    const pc = this.opts.createPeerConnection ? this.opts.createPeerConnection(config) : new RTCPeerConnection(config);
    this.pc = pc;

    pc.ontrack = (event) => {
      const stream = event.streams?.[0] ?? (typeof MediaStream !== "undefined" ? new MediaStream([event.track]) : null);
      if (stream) this.attachRemote(stream);
    };
    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      const json = JSON.stringify(typeof event.candidate.toJSON === "function" ? event.candidate.toJSON() : event.candidate);
      this.localCandidates.push(json);
      void this.send("ice", json);
    };
    pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true;
        await pc.setLocalDescription();
        if (this.closed) return;
        await this.send("offer", JSON.stringify(pc.localDescription));
      } catch (err) {
        console.warn("Team call: could not make an offer", err);
        this.fail();
      } finally {
        this.makingOffer = false;
      }
    };
    pc.onconnectionstatechange = () => {
      if (this.closed) return;
      if (pc.connectionState === "connected") this.setState("connected");
      else if (pc.connectionState === "failed") this.fail();
      else if (pc.connectionState === "disconnected") this.setState("connecting");
    };

    pc.addTrack(this.localTrack, this.opts.localStream);
  }

  /** A signal from the hub: anything not from this session's teammate is ignored. */
  handleSignal(event: TeamCallSignalEvent): void {
    if (this.closed) return;
    if (event.sessionId !== this.opts.sessionId || Number(event.fromUserId) !== this.opts.teammateUserId) return;
    if (event.type === "hangup") {
      void this.hangup(false);
      return;
    }
    this.queue = this.queue.then(() => this.process(event)).catch((err) => {
      console.warn("Team call: could not handle a signal", err);
    });
  }

  setMuted(muted: boolean): void {
    if (this.localTrack) this.localTrack.enabled = !muted;
  }

  /** The learner pressed "Bật âm thanh": a click lets the browser play the teammate's voice. */
  resumeAudio(): void {
    const audio = this.audio;
    if (!audio) return;
    void Promise.resolve(audio.play?.())
      .then(() => this.opts.onAudioBlocked(false))
      .catch(() => {});
  }

  /** Ends the call. Safe to call again: the teammate is told once, the connection and the clone are closed once. */
  async hangup(notifyTeammate = true): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.clearResend();
    this.teardown();
    this.setState("ended");
    if (notifyTeammate) {
      try {
        await this.opts.sendSignal("hangup", "{}");
      } catch {
        // the call is over either way
      }
    }
  }

  private async process(event: TeamCallSignalEvent): Promise<void> {
    const pc = this.pc;
    if (!pc || this.closed) return;
    if (event.type === "offer" || event.type === "answer") {
      const description = JSON.parse(event.payload) as RTCSessionDescriptionInit;
      const collision = description.type === "offer" && (this.makingOffer || pc.signalingState !== "stable");
      this.ignoreOffer = !this.polite && collision;
      if (this.ignoreOffer) return;
      await pc.setRemoteDescription(description); // the polite side rolls its own offer back by itself
      await this.flushPendingIce();
      if (description.type === "offer") {
        await pc.setLocalDescription();
        if (!this.closed) await this.send("answer", JSON.stringify(pc.localDescription));
      }
      return;
    }
    if (event.type === "ice") {
      const candidate = JSON.parse(event.payload) as RTCIceCandidateInit;
      if (!pc.remoteDescription) {
        this.pendingIce.push(candidate); // the offer has not been applied yet
        return;
      }
      try {
        await pc.addIceCandidate(candidate);
      } catch (err) {
        if (!this.ignoreOffer) throw err;
      }
    }
  }

  private async flushPendingIce(): Promise<void> {
    const pending = this.pendingIce;
    this.pendingIce = [];
    for (const candidate of pending) {
      try {
        await this.pc?.addIceCandidate(candidate);
      } catch (err) {
        if (!this.ignoreOffer) console.warn("Team call: bad ICE candidate", err);
      }
    }
  }

  private async send(type: TeamCallSignalType, payload: string): Promise<void> {
    if (this.closed) return;
    let result: TeamCallSignalResult;
    try {
      result = await this.opts.sendSignal(type, payload);
    } catch {
      result = { ok: false, code: "SEND_FAILED" };
    }
    if (result.ok || this.closed) return;
    if (result.code === "TEAM_CALL_CLOSED") {
      void this.hangup(false); // the minute is over: no error to show
    } else if (result.code === "NO_TEAMMATE" || result.code === "SEND_FAILED") {
      this.scheduleResend(); // the teammate may not be in the room yet, or the connection blinked
    } else {
      this.fail();
    }
  }

  /** The offer (and our candidates) are sent again a few times, for a teammate who joins a little later. */
  private scheduleResend(): void {
    if (this.resendTimer !== null || this.closed || this.state === "connected") return;
    this.resendTimer = setTimeout(() => {
      this.resendTimer = null;
      if (this.closed || this.state === "connected" || !this.pc) return;
      this.resends += 1;
      if (this.resends > (this.opts.maxResends ?? 10)) {
        this.fail();
        return;
      }
      if (this.pc.signalingState === "have-local-offer" && this.pc.localDescription) {
        void this.send("offer", JSON.stringify(this.pc.localDescription));
      }
      for (const candidate of this.localCandidates) void this.send("ice", candidate);
    }, this.opts.resendMs ?? 3000);
  }

  private clearResend(): void {
    if (this.resendTimer !== null) {
      clearTimeout(this.resendTimer);
      this.resendTimer = null;
    }
  }

  private attachRemote(stream: MediaStream): void {
    if (this.closed) return;
    if (!this.audio) {
      const audio = document.createElement("audio");
      audio.autoplay = true;
      audio.hidden = true;
      audio.setAttribute("data-testid", "team-call-audio");
      document.body.appendChild(audio);
      this.audio = audio;
    }
    this.audio.srcObject = stream;
    this.opts.onRemoteStream(stream);
    void Promise.resolve(this.audio.play?.())
      .then(() => this.opts.onAudioBlocked(false))
      .catch(() => this.opts.onAudioBlocked(true));
  }

  private teardown(): void {
    try {
      this.pc?.close();
    } catch {
      // already closed
    }
    this.pc = null;
    this.localTrack?.stop(); // the clone only
    this.localTrack = null;
    if (this.audio) {
      this.audio.srcObject = null;
      this.audio.remove();
      this.audio = null;
    }
    this.opts.onRemoteStream(null);
    this.opts.onAudioBlocked(false);
  }

  private fail(): void {
    if (this.closed) return;
    this.closed = true;
    this.clearResend();
    this.teardown();
    this.setState("failed");
  }

  private setState(state: TeamCallState): void {
    if (this.state === state) return;
    this.state = state;
    this.opts.onState(state);
  }
}
