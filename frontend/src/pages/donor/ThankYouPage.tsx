import { FileText, HeartHandshake, Trophy } from 'lucide-react';
import { Navigate, useParams } from 'react-router-dom';
import type { DonorAttendanceView } from '@pulso/contracts';
import { ButtonLink, QueryState } from '@/components/ui';
import { useSession } from '@/features/auth/use-auth';
import { useAttendance } from '@/features/donor/api';
import { DonationRewards } from '@/features/donor/engagement/DonationRewards';
import { AfterDonationSteps } from '@/features/donor/history/AfterDonationSteps';
import { EligibilityCard } from '@/features/donor/history/EligibilityCard';
import { formatFullDate } from '@/features/donor/history/format';
import { isCompletedDonation } from '@/features/donor/history/outcome';
import { firstName, formatNumber } from '@/lib/format';
import { useDocumentTitle } from '@/lib/use-document-title';

/** Agradecimento depois de uma doação concluída (só para doações concluídas). */
export function ThankYouPage() {
  useDocumentTitle('Obrigado por doar');
  const { attendanceId = '' } = useParams();
  const attendance = useAttendance(attendanceId);
  const data = attendance.data;

  if (data && !isCompletedDonation(data)) {
    return <Navigate to={`/app/doacoes/${attendanceId}`} replace />;
  }

  return (
    <QueryState
      isLoading={attendance.isLoading}
      error={attendance.error}
      onRetry={() => attendance.refetch()}
      loadingLabel="Carregando sua doação…"
    >
      {data && <ThankYouContent attendance={data} />}
    </QueryState>
  );
}

function ThankYouContent({ attendance }: { attendance: DonorAttendanceView }) {
  const { user } = useSession();
  const volume = attendance.donation?.volumeMl;
  const hasDeclaration = attendance.documents.some((doc) => doc.type === 'DONATION_DECLARATION');

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="obrigado"
        className="rounded-[1.25rem] border border-line bg-surface px-5 py-8 shadow-card sm:px-8"
      >
        <span className="grid size-14 place-items-center rounded-full bg-carmim-50 text-carmim-700">
          <HeartHandshake aria-hidden="true" className="size-7" strokeWidth={1.75} />
        </span>
        <h1 id="obrigado" className="mt-5 text-2xl font-bold text-ink sm:text-3xl">
          {user ? `Obrigado por doar, ${firstName(user.name)}` : 'Obrigado por doar'}
        </h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Sua doação de {formatFullDate(attendance.attendedAt)} na {attendance.unitName} foi
          registrada pela equipe
          {volume ? `, com ${formatNumber(volume)} mL coletados` : ''}. Ela pode ajudar pessoas que
          você talvez nunca conheça.
        </p>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <AfterDonationSteps />
        <DonationRewards attendance={attendance} />
      </div>

      <EligibilityCard />

      <nav aria-label="Próximos passos" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <ButtonLink to={`/app/doacoes/${attendance.id}#documentos`} size="lg">
          <FileText aria-hidden="true" className="size-5" />
          {hasDeclaration ? 'Ver declaração' : 'Gerar declaração'}
        </ButtonLink>
        <ButtonLink to="/app/conquistas" size="lg" variant="outline">
          <Trophy aria-hidden="true" className="size-5" />
          Ver conquistas
        </ButtonLink>
        <ButtonLink to="/app" size="lg" variant="ghost">
          Voltar ao início
        </ButtonLink>
      </nav>
    </div>
  );
}
