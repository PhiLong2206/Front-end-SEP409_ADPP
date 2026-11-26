import * as signalR from "@microsoft/signalr";
import { getToken } from "../utils/token";

export interface CreditBalanceUpdatedEvent {
  userId: number;
  balance: number;
  previousBalance?: number;
  amountChanged?: number;
  transactionId?: string;
  referenceId?: string;
  reason?: string;
  occurredAt?: string;
}

export interface CreditTransactionCreatedEvent {
  transactionId: number | string;
  walletId: number;
  amount: number;
  type: string;
  sourceType: string;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

type BalanceListener = (event: CreditBalanceUpdatedEvent) => void;
type TransactionListener = (event: CreditTransactionCreatedEvent) => void;
type ReconnectListener = () => void;

class CreditHubService {
  private connection: signalR.HubConnection | null = null;
  private balanceListeners = new Set<BalanceListener>();
  private transactionListeners = new Set<TransactionListener>();
  private reconnectListeners = new Set<ReconnectListener>();
  private startPromise: Promise<void> | null = null;
  private opQueue: Promise<void> = Promise.resolve();

  public connect(): Promise<void> {
    this.opQueue = this.opQueue
      .catch(() => {})
      .then(() => this.connectInternal());
    return this.opQueue;
  }

  private async connectInternal(): Promise<void> {
    const token = getToken();
    if (!token) {
      return;
    }

    if (
      this.connection &&
      this.connection.state !== signalR.HubConnectionState.Disconnected
    ) {
      return;
    }

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

    const dispatchBalance = (data: CreditBalanceUpdatedEvent) => {
      this.balanceListeners.forEach((listener) => {
        try {
          listener(data);
        } catch (e) {
          console.error("Error in CreditBalanceUpdated listener:", e);
        }
      });
    };

    conn.on("CreditBalanceUpdated", dispatchBalance);

    const dispatchTransaction = (data: CreditTransactionCreatedEvent) => {
      this.transactionListeners.forEach((listener) => {
        try {
          listener(data);
        } catch (e) {
          console.error("Error in CreditTransactionCreated listener:", e);
        }
      });
    };

    conn.on("CreditTransactionCreated", dispatchTransaction);

    conn.onreconnected(() => {
      this.reconnectListeners.forEach((listener) => {
        try {
          listener();
        } catch (e) {
          console.error("Error in reconnect listener:", e);
        }
      });
    });

    const startOp = conn.start();
    this.startPromise = startOp;
    try {
      await startOp;
    } catch (err: unknown) {
      console.warn("CreditHub SignalR connection failed, will rely on polling/manual updates:", err);
    } finally {
      if (this.startPromise === startOp) {
        this.startPromise = null;
      }
    }
  }

  public disconnect(): Promise<void> {
    this.opQueue = this.opQueue
      .catch(() => {})
      .then(() => this.disconnectInternal());
    return this.opQueue;
  }

  private async disconnectInternal(): Promise<void> {
    if (this.startPromise) {
      try {
        await this.startPromise;
      } catch {
        // wait for negotiation to settle before stopping
      }
    }
    if (this.connection) {
      try {
        await this.connection.stop();
      } catch {
        // ignore disconnect errors
      }
      this.connection = null;
    }
  }

  public onBalanceUpdated(listener: BalanceListener): () => void {
    this.balanceListeners.add(listener);
    return () => {
      this.balanceListeners.delete(listener);
    };
  }

  public onTransactionCreated(listener: TransactionListener): () => void {
    this.transactionListeners.add(listener);
    return () => {
      this.transactionListeners.delete(listener);
    };
  }

  public onReconnect(listener: ReconnectListener): () => void {
    this.reconnectListeners.add(listener);
    return () => {
      this.reconnectListeners.delete(listener);
    };
  }
}

export const creditHub = new CreditHubService();
export default creditHub;
