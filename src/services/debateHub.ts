import * as signalR from "@microsoft/signalr";
import { getToken } from "../utils/token";

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

export interface DebateHubCallbacks {
  onUserJoined?: (data: UserJoinedEvent) => void;
  onUserLeft?: (data: UserLeftEvent) => void;
  onSpeakingStatusChanged?: (data: SpeakingStatusEvent) => void;
  onArgumentSubmitted?: (data: ArgumentSubmittedEvent) => void;
  onSessionStarted?: (data: unknown) => void;
  onSessionStatusChanged?: (data: SessionStatusEvent) => void;
}

export class DebateHubService {
  private connection: signalR.HubConnection | null = null;
  private currentSessionId: number | null = null;
  private callbacks: DebateHubCallbacks = {};

  public async connect(sessionId: number, callbacks: DebateHubCallbacks): Promise<void> {
    if (this.connection) {
      await this.disconnect();
    }

    this.currentSessionId = sessionId;
    this.callbacks = callbacks;

    const hubUrl = `${window.location.origin}/hubs/debate`;

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => getToken() || "",
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.registerEvents();

    try {
      await this.connection.start();
      await this.connection.invoke("JoinRoom", sessionId);
    } catch (err) {
      console.warn("SignalR connection failed, falling back to REST/polling:", err);
    }

    this.connection.onreconnected(async () => {
      if (this.currentSessionId) {
        try {
          await this.connection?.invoke("JoinRoom", this.currentSessionId);
        } catch (e) {
          console.error("Failed to rejoin debate room on reconnect", e);
        }
      }
    });
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

  public async disconnect(): Promise<void> {
    if (this.connection) {
      try {
        if (this.currentSessionId && this.connection.state === signalR.HubConnectionState.Connected) {
          await this.connection.invoke("LeaveRoom", this.currentSessionId);
        }
        await this.connection.stop();
      } catch (e) {
        console.warn("Error while disconnecting SignalR:", e);
      } finally {
        this.connection = null;
        this.currentSessionId = null;
      }
    }
  }

  private registerEvents(): void {
    if (!this.connection) return;

    this.connection.on("UserJoinedRoom", (data: UserJoinedEvent) => {
      this.callbacks.onUserJoined?.(data);
    });

    this.connection.on("ParticipantJoined", (data: UserJoinedEvent) => {
      this.callbacks.onUserJoined?.(data);
    });

    this.connection.on("UserLeftRoom", (data: UserLeftEvent) => {
      this.callbacks.onUserLeft?.(data);
    });

    this.connection.on("ParticipantLeft", (data: UserLeftEvent) => {
      this.callbacks.onUserLeft?.(data);
    });

    this.connection.on("UserSpeakingStatusChanged", (data: SpeakingStatusEvent) => {
      this.callbacks.onSpeakingStatusChanged?.(data);
    });

    this.connection.on("ArgumentSubmitted", (data: ArgumentSubmittedEvent) => {
      this.callbacks.onArgumentSubmitted?.(data);
    });

    this.connection.on("SessionStarted", (data: unknown) => {
      this.callbacks.onSessionStarted?.(data);
    });

    this.connection.on("SessionStatusChanged", (data: SessionStatusEvent) => {
      this.callbacks.onSessionStatusChanged?.(data);
    });
  }
}

export const debateHubService = new DebateHubService();

