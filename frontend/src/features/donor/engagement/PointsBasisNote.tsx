import type { PointsBasis } from '@pulso/contracts';
import { Alert } from '@/components/ui';

const BASIS_TEXT: Record<PointsBasis, string> = {
  ATTENDANCE:
    'Você ganha pontos ao comparecer para doar, mesmo que a doação não aconteça naquele dia.',
  DONATION: 'Você ganha pontos a cada doação concluída.',
};

/** Como os pontos são ganhos (configuração atual da gamificação) e sem prêmios (RN13). */
export function PointsBasisNote({ basis }: { basis: PointsBasis }) {
  return (
    <Alert title="Como funcionam os pontos">
      <p>{BASIS_TEXT[basis]}</p>
      <p className="mt-1">
        Não há prêmios materiais: pontos, níveis e conquistas são uma forma de reconhecer e
        acompanhar a sua jornada.
      </p>
    </Alert>
  );
}
