import type { WSMessage } from '../types';

type MessageHandler = (msg: WSMessage) => void;

export class CrowdbashWebSocket {
  private ws: WebSocket | null = null;
  private roomId: string;
  private handlers: MessageHandler[] = [];
  private reconnectDelay = 2000;
  private maxReconnectDelay = 30000;
  private shouldReconnect = true;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(roomId: string) {
    this.roomId = roomId;
  }

  connect() {
    // Auto-derive WS URL from API URL if VITE_WS_URL not set
    let WS_BASE = import.meta.env.VITE_WS_URL || '';
    if (!WS_BASE) {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      WS_BASE = apiUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    }
    this.ws = new WebSocket(`${WS_BASE}/ws/${this.roomId}`);

    this.ws.onopen = () => {
      console.log(`[WS] Connected to room ${this.roomId}`);
      this.reconnectDelay = 2000;
      this.startPing();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        this.handlers.forEach((h) => h(msg));
      } catch (e) {
        console.error('[WS] Failed to parse message', e);
      }
    };

    this.ws.onclose = () => {
      console.log('[WS] Disconnected');
      this.stopPing();
      if (this.shouldReconnect) {
        setTimeout(() => this.connect(), this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      }
    };

    this.ws.onerror = (err) => {
      console.error('[WS] Error', err);
    };
  }

  send(type: string, payload: unknown = {}) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  onMessage(handler: MessageHandler) {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  private startPing() {
    this.pingInterval = setInterval(() => {
      this.send('ping');
    }, 30000);
  }

  private stopPing() {
    if (this.pingInterval) clearInterval(this.pingInterval);
  }

  disconnect() {
    this.shouldReconnect = false;
    this.stopPing();
    this.ws?.close();
  }
}
