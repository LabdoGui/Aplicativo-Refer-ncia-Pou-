import { useState } from 'react';
import type { GamificationProfile } from '@pulso/contracts';
import { FormErrorAlert } from '@/components/form';
import { Button, Card } from '@/components/ui';
import { useRankingOptIn } from '@/features/donor/api';
import { NicknameForm } from './NicknameForm';

type Ranking = GamificationProfile['ranking'];

/** Participação no ranking (opt-in com apelido, troca de apelido e saída). */
export function RankingParticipation({ ranking }: { ranking: Ranking }) {
  const optOut = useRankingOptIn();
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');

  function leave() {
    setMessage('');
    optOut.mutate({ optIn: false }, { onSuccess: () => setMessage('Você saiu do ranking.') });
  }

  return (
    <Card>
      {ranking.optIn && ranking.nickname && !editing ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-ink">
            Você participa como <strong className="font-semibold">{ranking.nickname}</strong>.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              Alterar apelido
            </Button>
            <Button variant="outline" size="sm" loading={optOut.isPending} onClick={leave}>
              Sair do ranking
            </Button>
          </div>
        </div>
      ) : (
        <>
          {!ranking.optIn && (
            <p className="mb-4 text-ink">
              Você não participa do ranking. Para entrar, escolha um apelido.
            </p>
          )}
          <NicknameForm
            key={ranking.nickname ?? 'novo'}
            initialNickname={editing ? (ranking.nickname ?? '') : ''}
            submitLabel={editing ? 'Salvar apelido' : 'Participar do ranking'}
            onCancel={editing ? () => setEditing(false) : undefined}
            onDone={(nickname) => {
              setEditing(false);
              setMessage(`Pronto! Você aparece no ranking como ${nickname}.`);
            }}
          />
        </>
      )}
      {optOut.error ? (
        <div className="mt-4">
          <FormErrorAlert error={optOut.error} />
        </div>
      ) : null}
      <p
        role="status"
        className={message ? 'mt-4 text-sm font-semibold text-ok-strong' : 'sr-only'}
      >
        {message}
      </p>
    </Card>
  );
}
