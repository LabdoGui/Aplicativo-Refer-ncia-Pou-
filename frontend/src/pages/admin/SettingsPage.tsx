import { useState } from 'react';
import { PageHeader, Tabs } from '@/components/ui';
import { ClinicalParamsTab } from '@/features/admin-config/ClinicalParamsTab';
import { PreScreeningConfigTab } from '@/features/admin-config/PreScreeningConfigTab';
import { ScreeningFieldsTab } from '@/features/admin-config/ScreeningFieldsTab';
import { useDocumentTitle } from '@/lib/use-document-title';

type Tab = 'params' | 'fields' | 'prescreening';

/** Parâmetros clínicos, campos da triagem e conteúdo da pré-triagem. */
export function SettingsPage() {
  useDocumentTitle('Configurações');
  const [tab, setTab] = useState<Tab>('params');
  return (
    <>
      <PageHeader
        title="Configurações"
        description="Regras e parâmetros clínicos ficam em tabelas configuráveis e pendentes de validação por profissionais de saúde."
      />
      <Tabs<Tab>
        label="Seções de configuração"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'params', label: 'Parâmetros clínicos', content: <ClinicalParamsTab /> },
          { value: 'fields', label: 'Triagem profissional', content: <ScreeningFieldsTab /> },
          { value: 'prescreening', label: 'Pré-triagem', content: <PreScreeningConfigTab /> },
        ]}
      />
    </>
  );
}
