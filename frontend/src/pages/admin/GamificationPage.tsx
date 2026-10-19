import { useState } from 'react';
import { PageHeader, Tabs } from '@/components/ui';
import { AchievementsTab } from '@/features/admin-config/AchievementsTab';
import { HoursReviewTab } from '@/features/admin-config/HoursReviewTab';
import { InstitutionsTab } from '@/features/admin-config/InstitutionsTab';
import { PointsRulesTab } from '@/features/admin-config/PointsRulesTab';
import { useDocumentTitle } from '@/lib/use-document-title';

type Tab = 'hours' | 'institutions' | 'achievements' | 'rules';

/** Horas complementares, instituições, conquistas e regras de pontos. */
export function GamificationPage() {
  useDocumentTitle('Gamificação');
  const [tab, setTab] = useState<Tab>('hours');
  return (
    <>
      <PageHeader
        title="Gamificação"
        description="Incentivo à recorrência, sem prêmios materiais."
      />
      <Tabs<Tab>
        label="Seções da gamificação"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'hours', label: 'Horas complementares', content: <HoursReviewTab /> },
          { value: 'institutions', label: 'Instituições', content: <InstitutionsTab /> },
          { value: 'achievements', label: 'Conquistas', content: <AchievementsTab /> },
          { value: 'rules', label: 'Regras de pontos', content: <PointsRulesTab /> },
        ]}
      />
    </>
  );
}
