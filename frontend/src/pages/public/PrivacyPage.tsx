import type { ReactNode } from 'react';
import { Alert, Badge, PageHeader } from '@/components/ui';
import { PublicContainer } from '@/layouts/public/PublicContainer';
import { useDocumentTitle } from '@/lib/use-document-title';

const COLLECTED_DATA = [
  {
    data: 'Nome, e-mail e senha',
    purpose:
      'Criar sua conta e proteger o acesso. A senha nunca é guardada como texto: armazenamos apenas um resumo criptográfico (hash).',
  },
  {
    data: 'Data de nascimento e telefone',
    purpose: 'Confirmar que você tem 18 anos ou mais e falar com você sobre os seus agendamentos.',
  },
  {
    data: 'Unidade, data e horário escolhidos',
    purpose: 'Organizar o seu atendimento na unidade de coleta.',
  },
  {
    data: 'Respostas da pré-triagem e registros da triagem e da doação',
    purpose:
      'Orientar você antes da doação e manter o histórico das suas doações. São dados de saúde.',
  },
  {
    data: 'Pontos e conquistas',
    purpose:
      'Reconhecer a sua participação. Você só aparece no ranking público se autorizar, e com um apelido.',
  },
];

const HEALTH_DATA_SAFEGUARDS = [
  'ficam armazenados de forma cifrada, separados dos dados de cadastro;',
  'só são acessados por profissionais de saúde autorizados, quando necessário para o atendimento;',
  'no caso da pré-triagem, só ficam visíveis para a equipe se você consentir;',
  'não ficam acessíveis à administração do sistema;',
  'nunca aparecem em notificações, e-mails ou registros técnicos (logs).',
];

const RIGHTS = [
  'Confirmar se tratamos os seus dados e ter acesso a eles.',
  'Corrigir dados incompletos, inexatos ou desatualizados.',
  'Pedir a anonimização, o bloqueio ou a eliminação de dados desnecessários ou excessivos.',
  'Solicitar a portabilidade dos seus dados.',
  'Saber com quem os seus dados são compartilhados.',
  'Revogar o consentimento a qualquer momento e pedir a eliminação dos dados tratados com base nele.',
];

const CONSENT_PURPOSES = [
  'Aceitar os termos de uso e esta política de privacidade (necessário para criar a conta).',
  'Compartilhar a sua pré-triagem com a equipe de saúde da unidade.',
  'Aparecer no ranking público, com um apelido.',
  'Receber comunicações do Pulso.',
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="text-xl font-bold text-ink sm:text-2xl">
        {title}
      </h2>
      <div className="space-y-3 text-ink-muted">{children}</div>
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5 marker:text-petroleo-600">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function PrivacyPage() {
  useDocumentTitle('Privacidade e consentimento');
  return (
    <PublicContainer size="narrow">
      <PageHeader
        eyebrow="LGPD"
        title="Privacidade e consentimento"
        description="Um resumo, em linguagem simples, de como o Pulso trata os seus dados pessoais, de acordo com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018)."
      />

      <Alert tone="warn" title="Projeto acadêmico com dados fictícios" className="mb-10">
        O Pulso é um projeto acadêmico alinhado ao ODS 3. Todos os dados exibidos são fictícios: não
        informe dados reais de saúde ao testar a plataforma.
      </Alert>

      <div className="space-y-10">
        <Section id="dados-coletados" title="Quais dados coletamos e por quê">
          <dl className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
            {COLLECTED_DATA.map(({ data, purpose }) => (
              <div
                key={data}
                className="grid gap-1 p-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-6"
              >
                <dt className="font-semibold text-ink">{data}</dt>
                <dd>{purpose}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section id="dados-de-saude" title="Dados de saúde são sensíveis">
          <p>
            A LGPD classifica dados de saúde como{' '}
            <strong className="text-ink">dados pessoais sensíveis</strong>, que exigem proteção
            reforçada. No Pulso, as respostas da pré-triagem e os dados da triagem presencial:
          </p>
          <BulletList items={HEALTH_DATA_SAFEGUARDS} />
        </Section>

        <Section id="minimizacao" title="Coletamos só o necessário">
          <p>
            Seguimos o princípio da minimização: pedimos apenas o que é de fato usado. Por isso,{' '}
            <strong className="text-ink">não solicitamos CPF</strong> nem cópias de documentos. O
            documento oficial com foto é apresentado somente na unidade, no dia da doação.
          </p>
        </Section>

        <Section id="direitos" title="Seus direitos como titular">
          <p>A LGPD garante a você, entre outros, o direito de:</p>
          <BulletList items={RIGHTS} />
        </Section>

        <Section id="consentimento" title="Como funciona o consentimento">
          <p>
            Algumas finalidades dependem da sua autorização. Cada uma é pedida separadamente, com
            explicação clara, e pode ser revogada quando você quiser, sem afetar o restante da
            conta:
          </p>
          <BulletList items={CONSENT_PURPOSES} />
          <p className="flex flex-wrap items-center gap-2 pt-1">
            <Badge tone="info">Fase 3</Badge>
            <span>
              A gestão detalhada dos consentimentos, pela área do doador, chega na Fase 3 do
              roadmap.
            </span>
          </p>
        </Section>
      </div>
    </PublicContainer>
  );
}
