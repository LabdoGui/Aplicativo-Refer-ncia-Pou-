/**
 * Barramento de eventos da demonstração: equivalente ao outbox + RabbitMQ.
 * Os eventos publicados durante uma requisição só são entregues depois que ela
 * termina (como o outbox, que publica após o commit), na ordem de publicação.
 */
import type { EventType } from '@pulso/contracts';
import { nowIso, uuid } from './support';

export interface EventMeta {
  id: string;
  occurredAt: string;
}

type Listener = (data: never, meta: EventMeta) => void;

const listeners = new Map<EventType, Array<{ consumer: string; listener: Listener }>>();
const queue: Array<{ type: EventType; data: unknown; meta: EventMeta }> = [];

/** Assina um tipo de evento (cada serviço consumidor registra os seus). */
export function subscribe<T>(
  type: EventType,
  consumer: string,
  listener: (data: T, meta: EventMeta) => void,
): void {
  const list = listeners.get(type) ?? [];
  list.push({ consumer, listener: listener as Listener });
  listeners.set(type, list);
}

/** Publica um evento (entregue ao fim da requisição atual). */
export function publish<T>(type: EventType, data: T): void {
  queue.push({ type, data, meta: { id: uuid(), occurredAt: nowIso() } });
}

/** Entrega os eventos pendentes, inclusive os publicados pelos próprios consumidores. */
export function flushEvents(): void {
  let guard = 0;
  while (queue.length > 0 && guard++ < 1000) {
    const event = queue.shift()!;
    for (const { consumer, listener } of listeners.get(event.type) ?? []) {
      try {
        listener(event.data as never, event.meta);
      } catch (error) {
        // Como uma mensagem que iria para a DLQ: registra e segue com os demais consumidores.
        console.error(`[demo] consumidor ${consumer} falhou em ${event.type}`, error);
      }
    }
  }
}
