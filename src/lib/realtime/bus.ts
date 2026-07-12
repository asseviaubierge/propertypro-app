import { EventEmitter } from "events";

export type RealtimeEvent =
  | {
      type: "message.created";
      conversationId: string;
      participantIds: string[];
      message: any;
    }
  | {
      type: "notification.created";
      userId: string;
      notification: any;
    };

const globalKey = Symbol.for("propertypro.realtime.bus");

type GlobalWithBus = typeof globalThis & {
  [globalKey]?: EventEmitter;
};

function getBus(): EventEmitter {
  const g = globalThis as GlobalWithBus;
  if (!g[globalKey]) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(0);
    g[globalKey] = emitter;
  }
  return g[globalKey]!;
}

export function publish(event: RealtimeEvent) {
  getBus().emit("event", event);
}

export function subscribe(handler: (event: RealtimeEvent) => void) {
  const bus = getBus();
  bus.on("event", handler);
  return () => {
    bus.off("event", handler);
  };
}
