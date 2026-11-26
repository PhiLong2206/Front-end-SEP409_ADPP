import * as signalR from "@microsoft/signalr";
import { getToken } from "../utils/token";
import type { RoundStartedEvent } from "../types/debate.types";

export interface UserJoinedEvent {
  sessionId: number;
  userId: number;
  fullName: string;
  connectionId?: string;
  joinedAt?: string;
  side?: string;
}

export interface UserLeftEvent {
  sessionId: number;
  userId: number;
  fullName: string;
  timestamp?: string;
}

export interface SpeakingStatusEvent {
  sessionId: number;
  userId: number;
  fullName: string;
  isSpeaking: boolean;
}

export interface LiveTranscriptEvent {
  sessionId: number;
  userId: number | null;
  fullName: string;
  text: string;
  isFinal: boolean;
  speechFinal: boolean;
  sequence: number;
  timestamp?: string;
}

export interface ArgumentSubmittedEvent {
  sessionId: number;
  argument: {
    argumentId: number;
    roundNumber: number;
    side: string;
    userId: number | null;
    speakerName: string;
    isAI: boolean;
    content: string;
    wordCount?: number;
    durationSeconds?: number;
    submittedAt: string;
  };
  turn?: {
    turnId: number;
    turnIndex?: number;
    turnOrder: number;
    side: string | number;
    stage: string | number;
    timeLimitSeconds: number;
    status: number;
    startedAt?: string;
  };
  timestamp?: string;
}

export interface SessionStatusEvent {
  sessionId: number;
  status: string;
  reason?: string;
  timestamp?: string;
}

export type TeamCallSignalType = "offer" | "answer" | "ice" | "hangup";

/** A signal of the teammate voice call (only the teammate receives it). */
export interface TeamCallSignalEvent {
  sessionId: number;
  fromUserId: number;
  fromName?: string;
  type: TeamCallSignalType;
  payload: string;
  timestamp?: string;
}

/** The server closed the call: the preparation minute is over. */
export interface TeamCallEndedEvent {
  sessionId: number;
  roundNumber?: number;
  endedAt?: string;
}

/** Answer of the TeamCallSignal hub method. `code`: NO_TEAMMATE, TEAM_CALL_CLOSED, NOT_PARTICIPANT, ... */
export interface TeamCallSignalResult {
  ok: boolean;
  code: string | null;
}

export type { RoundStartedEvent } from "../types/debate.types";

export interface DebateHubCallbacks {
  onUserJoined?: (data: UserJoinedEvent) => void;
  onUserLeft?: (data: UserLeftEvent) => void;
  onSpeakingStatusChanged?: (data: SpeakingStatusEvent) => void;
  onLiveTranscriptUpdated?: (data: LiveTranscriptEvent) => void;
  onArgumentSubmitted?: (data: ArgumentSubmittedEvent) => void;
  onSessionStarted?: (data: unknown) => void;
  onRoundStarted?: (data: RoundStartedEvent) => void;
  onSessionStatusChanged?: (data: SessionStatusEvent) => void;
  onTeamCallSignal?: (data: TeamCallSignalEvent) => void;
  onTeamCallEnded?: (data: TeamCallEndedEvent) => void;
  onReconnecting?: () => void;
  onReconnected?: () => void;
}

export class DebateHubService {
  private connection: signalR.HubConnection | null = null;
  private currentSessionId: number | null = null;
  private callbacks: DebateHubCallbacks = {};
  private startPromise: Promise<void> | null = null;
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private opQueue: Promise<void> = Promise.resolve();
  private connectGeneration = 0;

  public connect(sessionId: number, callbacks: DebateHubCallbacks): Promise<void> {
    if (this.disconnectTimer !== null) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }

    this.callbacks = callbacks;

    // Fast path for React StrictMode remount on the same session: reuse the active/negotiating connection
    if (
      this.connection &&
      this.currentSessionId === sessionId &&
      this.connection.state !== signalR.HubConnectionState.Disconnected
    ) {
      return this.opQueue;
    }

    const gen = ++this.connectGeneration;
    this.opQueue = this.opQueue
      .catch(() => {})
      .then(() => this.connectInternal(sessionId, callbacks, gen));
    return this.opQueue;
  }

  private async connectInternal(
    sessionId: number,
    callbacks: DebateHubCallbacks,
    gen: number
  ): Promise<void> {
    if (gen !== this.connectGeneration) return;

    this.callbacks = callbacks;

    if (
      this.connection &&
      this.currentSessionId === sessionId &&
      this.connection.state !== signalR.HubConnectionState.Disconnected
    ) {
      return;
    }

    if (this.connection) {
      await this.stopInternal();
      if (gen !== this.connectGeneration) return;
    }

    this.currentSessionId = sessionId;
    const hubUrl = `${window.location.origin}/hubs/debate`;

    const conn = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => getToken() || "",
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect([0, 1000, 3000, 5000, 10000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.connection = conn;
    this.registerEvents(conn);

    conn.onreconnecting(() => {
      if (this.connection === conn) {
        this.callbacks.onReconnecting?.();
      }
    });

    conn.onreconnected(async () => {
      if (this.connection === conn && this.currentSessionId) {
        try {
          await conn.invoke("JoinRoom", this.currentSessionId);
        } catch (e) {
          console.error("Failed to rejoin debate room on reconnect", e);
        }
        this.callbacks.onReconnected?.();
      }
    });

    const startOp = conn.start();
    this.startPromise = startOp;
    try {
      await startOp;
      if (this.connection === conn && conn.state === signalR.HubConnectionState.Connected) {
        await conn.invoke("JoinRoom", sessionId);
      }
    } catch (err: unknown) {
      console.warn("SignalR connection failed, falling back to REST/polling:", err);
    } finally {
      if (this.startPromise === startOp) {
        this.startPromise = null;
      }
    }
  }

  public async sendSpeakingStatus(isSpeaking: boolean): Promise<void> {
    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected && this.currentSessionId) {
      try {
        await this.connection.invoke("SendSpeakingStatus", this.currentSessionId, isSpeaking);
      } catch (err) {
        console.warn("Failed to send speaking status via SignalR", err);
      }
    }
  }

  /** Sends a signal of the teammate call; never throws (a lost connection answers `SEND_FAILED`). */
  public async sendTeamCallSignal(type: TeamCallSignalType, payload: string): Promise<TeamCallSignalResult> {
    if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected || !this.currentSessionId) {
      return { ok: false, code: "SEND_FAILED" };
    }
    try {
      const result = await this.connection.invoke<TeamCallSignalResult | undefined>(
        "TeamCallSignal",
        this.currentSessionId,
        type,
        payload
      );
      return result ?? { ok: true, code: null };
    } catch (err) {
      console.warn("Failed to send a team call signal via SignalR", err);
      return { ok: false, code: "SEND_FAILED" };
    }
  }

  public async sendLiveTranscript(
    text: string,
    isFinal: boolean,
    speechFinal = false,
    sequence = 0
  ): Promise<void> {
    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected && this.currentSessionId) {
      try {
        await this.connection.invoke(
          "SendLiveTranscript",
          this.currentSessionId,
          text,
          isFinal,
          speechFinal,
          sequence
        );
      } catch (err) {
        console.warn("Failed to send live transcript via SignalR", err);
      }
    }
  }

  public disconnect(): Promise<void> {
    if (this.disconnectTimer !== null) {
      clearTimeout(this.disconnectTimer);
    }

    return new Promise<void>((resolve) => {
      this.disconnectTimer = setTimeout(() => {
        this.disconnectTimer = null;
        this.connectGeneration++;
        this.opQueue = this.opQueue
          .catch(() => {})
          .then(() => this.stopInternal())
          .finally(resolve);
      }, 150);
    });
  }

  private async stopInternal(): Promise<void> {
    if (this.startPromise) {
      try {
        await this.startPromise;
      } catch {
        // Wait for negotiation to settle before stopping so SignalR never aborts mid-negotiation
      }
    }

    const conn = this.connection;
    const sessionId = this.currentSessionId;
    this.connection = null;
    this.currentSessionId = null;

    if (conn) {
      try {
        if (sessionId && conn.state === signalR.HubConnectionState.Connected) {
          await conn.invoke("LeaveRoom", sessionId);
        }
        if (conn.state !== signalR.HubConnectionState.Disconnected) {
          await conn.stop();
        }
      } catch (e) {
        console.warn("Error while disconnecting SignalR:", e);
      }
    }
  }

  private registerEvents(conn: signalR.HubConnection): void {
    conn.on("UserJoinedRoom", (data: UserJoinedEvent) => {
      this.callbacks.onUserJoined?.(data);
    });

    conn.on("ParticipantJoined", (data: UserJoinedEvent) => {
      this.callbacks.onUserJoined?.(data);
    });

    conn.on("UserLeftRoom", (data: UserLeftEvent) => {
      this.callbacks.onUserLeft?.(data);
    });

    conn.on("ParticipantLeft", (data: UserLeftEvent) => {
      this.callbacks.onUserLeft?.(data);
    });

    conn.on("UserSpeakingStatusChanged", (data: SpeakingStatusEvent) => {
      this.callbacks.onSpeakingStatusChanged?.(data);
    });

    conn.on("LiveTranscriptUpdated", (data: LiveTranscriptEvent) => {
      this.callbacks.onLiveTranscriptUpdated?.(data);
    });

    conn.on("ArgumentSubmitted", (data: ArgumentSubmittedEvent) => {
      this.callbacks.onArgumentSubmitted?.(data);
    });

    conn.on("SessionStarted", (data: unknown) => {
      this.callbacks.onSessionStarted?.(data);
    });

    conn.on("RoundStarted", (data: RoundStartedEvent) => {
      this.callbacks.onRoundStarted?.(data);
    });

    conn.on("SessionStatusChanged", (data: SessionStatusEvent) => {
      this.callbacks.onSessionStatusChanged?.(data);
    });

    conn.on("TeamCallSignal", (data: TeamCallSignalEvent) => {
      this.callbacks.onTeamCallSignal?.(data);
    });

    conn.on("TeamCallEnded", (data: TeamCallEndedEvent) => {
      this.callbacks.onTeamCallEnded?.(data);
    });

    const onBalanceUpdate = (data: unknown) => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("wallet_updated", { detail: data }));
      }
    };
    conn.on("CreditBalanceUpdated", onBalanceUpdate);

    const onTxCreated = (data: unknown) => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("wallet_tx_created", { detail: data }));
      }
    };
    conn.on("CreditTransactionCreated", onTxCreated);
  }
}

export const debateHubService = new DebateHubService();

