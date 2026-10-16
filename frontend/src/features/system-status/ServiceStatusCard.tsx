import type { ReactNode } from 'react';
import { SERVICES, type ServiceName } from '@pulso/contracts';
import { Card, StatusPill } from '@/components/ui';
import { checkLabel, presentCheckStatus, presentServiceStatus } from './status-presentation';
import type { ServiceHealth } from './types';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-7 items-center justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right font-medium text-ink tabular-nums">{children}</dd>
    </div>
  );
}

function serviceTitle(service: ServiceHealth): string {
  return service.title ?? SERVICES[service.name as ServiceName]?.title ?? service.name;
}

export function ServiceStatusCard({ service }: { service: ServiceHealth }) {
  const status = presentServiceStatus(service.status);
  const checks = Object.entries(service.checks ?? {});
  const titleId = `servico-${service.name}`;

  return (
    <Card as="article" aria-labelledby={titleId} className="flex h-full flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={titleId} className="text-base font-bold text-ink">
            {serviceTitle(service)}
          </h3>
          <p className="font-mono text-xs text-ink-muted">{service.name}</p>
        </div>
        <StatusPill status={status.tone} label={status.label} size="sm" />
      </div>

      <dl className="space-y-2 text-sm">
        {checks.map(([name, value]) => {
          const check = presentCheckStatus(value);
          return (
            <Row key={name} label={checkLabel(name)}>
              <StatusPill status={check.tone} label={check.label} size="sm" />
            </Row>
          );
        })}
        <Row label="Versão">
          {service.version ? `v${service.version.replace(/^v/, '')}` : 'Indisponível'}
        </Row>
        <Row label="Latência">
          {typeof service.latencyMs === 'number'
            ? `${Math.round(service.latencyMs)} ms`
            : 'Indisponível'}
        </Row>
      </dl>
    </Card>
  );
}
