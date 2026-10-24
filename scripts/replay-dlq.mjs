#!/usr/bin/env node
/**
 * Reprocessa a fila de mensagens mortas (DLQ) de um serviço do SangueConecta.
 *
 * Um evento vai para a DLQ quando o consumidor esgota as tentativas (cerca de
 * 36 minutos em escada). Corrigida a causa, este script devolve as mensagens à
 * fila principal do serviço com a contagem de tentativas zerada. Como o
 * consumidor é idempotente, reprocessar não duplica efeitos.
 *
 * Uso:
 *   node scripts/replay-dlq.mjs <serviço> [--dry-run] [--limit=N]
 *   node scripts/replay-dlq.mjs notification-service
 *
 * Variáveis:
 *   RABBITMQ_URL  conexão com o broker (padrão: amqp://pulso:pulso_dev@localhost:5672,
 *                 o usuário administrador do docker-compose)
 */
import amqp from 'amqplib';

const SERVICES = [
  'identity-service',
  'scheduling-service',
  'clinical-service',
  'inventory-service',
  'engagement-service',
  'notification-service',
];
const ATTEMPT_HEADER = 'x-pulso-attempt';

const args = process.argv.slice(2);
const service = args.find((arg) => !arg.startsWith('--'));
const dryRun = args.includes('--dry-run');
const limitArg = args.find((arg) => arg.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.slice('--limit='.length)) : Infinity;

if (!service || !SERVICES.includes(service) || !(limit > 0)) {
  console.error(`Uso: node scripts/replay-dlq.mjs <${SERVICES.join('|')}> [--dry-run] [--limit=N]`);
  process.exit(2);
}

const main = `pulso.${service}`;
const dead = `${main}.dlq`;
const url = process.env.RABBITMQ_URL ?? 'amqp://pulso:pulso_dev@localhost:5672';

const connection = await amqp.connect(url);
try {
  const channel = await connection.createConfirmChannel();
  const { messageCount } = await channel.checkQueue(dead);
  console.log(`${dead}: ${messageCount} mensagem(ns).`);

  let moved = 0;
  while (moved < Math.min(limit, messageCount)) {
    const message = await channel.get(dead, { noAck: false });
    if (!message) break;
    const headers = message.properties.headers ?? {};
    const summary = {
      tipo: message.properties.type ?? headers['x-pulso-original-routing-key'],
      tentativas: headers[ATTEMPT_HEADER],
      erro: headers['x-pulso-last-error'],
    };
    if (dryRun) {
      // Sem ack: ao fechar o canal, o broker devolve as mensagens à DLQ.
      console.log('  [simulação]', summary);
      moved += 1;
      continue;
    }
    channel.sendToQueue(main, message.content, {
      ...message.properties,
      persistent: true,
      headers: { ...headers, [ATTEMPT_HEADER]: 1, 'x-pulso-replayed-at': new Date().toISOString() },
    });
    await channel.waitForConfirms();
    channel.ack(message);
    moved += 1;
    console.log('  devolvida à fila principal:', summary);
  }
  console.log(
    dryRun
      ? `Simulação: ${moved} mensagem(ns) listada(s); nada foi movido.`
      : `${moved} mensagem(ns) devolvida(s) a ${main}.`,
  );
  await channel.close();
} finally {
  await connection.close();
}
