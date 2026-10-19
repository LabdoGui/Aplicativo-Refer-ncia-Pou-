#!/bin/sh
# Usuários do RabbitMQ por serviço, com menor privilégio (docs/16, backlog de segurança).
#
# Roda dentro do contêiner do broker, em segundo plano, assim que ele aceita
# comandos. É idempotente: a cada subida, (re)aplica senhas e permissões.
#
# Cada serviço <nome>:
#   - configure/read/write só no exchange pulso.events e nas próprias filas
#     (pulso.<nome>-service, .retry.<espera> e .dlq); write também no exchange
#     padrão (amq.default), usado para reenviar mensagens às filas de retry e à DLQ;
#   - topic permission: só publica routing keys que começam com "<nome>.".
# O usuário administrador (RABBITMQ_DEFAULT_USER) fica só para a interface de gestão.
set -eu

READY_FILE=/tmp/pulso-users-ready
rm -f "$READY_FILE"

# Espera o broker criar o cookie do Erlang (a CLI não deve criar um próprio).
until [ -s "${HOME:-/var/lib/rabbitmq}/.erlang.cookie" ]; do sleep 1; done
until rabbitmqctl -q await_startup >/dev/null 2>&1; do sleep 2; done

apply_user() {
  name="$1"
  password="$2"
  publish_prefix="$3"
  user="${name}_svc"
  queues="pulso\\.${name}-service(\\.retry\\.[0-9]+[sm]|\\.dlq)?"
  if rabbitmqctl -q list_users | cut -f1 | grep -qx "$user"; then
    rabbitmqctl -q change_password "$user" "$password"
  else
    rabbitmqctl -q add_user "$user" "$password"
  fi
  rabbitmqctl -q set_permissions -p / "$user" \
    "^(pulso\\.events|${queues})\$" \
    "^(pulso\\.events|amq\\.default|${queues})\$" \
    "^(pulso\\.events|${queues})\$"
  rabbitmqctl -q set_topic_permissions -p / "$user" pulso.events "$publish_prefix" '.*'
}

apply_user identity "${RABBITMQ_IDENTITY_PASSWORD:-identity_broker_dev}" '^identity\.'
apply_user scheduling "${RABBITMQ_SCHEDULING_PASSWORD:-scheduling_broker_dev}" '^scheduling\.'
apply_user clinical "${RABBITMQ_CLINICAL_PASSWORD:-clinical_broker_dev}" '^clinical\.'
apply_user inventory "${RABBITMQ_INVENTORY_PASSWORD:-inventory_broker_dev}" '^inventory\.'
apply_user engagement "${RABBITMQ_ENGAGEMENT_PASSWORD:-engagement_broker_dev}" '^engagement\.'
# O notification só consome: não publica nenhuma routing key.
apply_user notification "${RABBITMQ_NOTIFICATION_PASSWORD:-notification_broker_dev}" '^$'

touch "$READY_FILE"
echo "Usuários do RabbitMQ por serviço aplicados."
