import { ButtonLink } from '@/components/ui';

export function ClosingCta() {
  return (
    <section aria-labelledby="comece-agora">
      <div className="mx-auto max-w-page px-4 py-16 sm:px-6 lg:py-20">
        <div className="flex flex-col items-start gap-6 rounded-[1.5rem] bg-petroleo-50 p-8 sm:p-10 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <h2 id="comece-agora" className="text-2xl font-bold text-petroleo-900 sm:text-3xl">
              Pronto para dar o primeiro passo?
            </h2>
            <p className="mt-2 text-petroleo-900/85">
              Crie sua conta e organize sua doação com tranquilidade. Seus dados são tratados com
              cuidado.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink to="/cadastro" size="lg">
              Quero doar
            </ButtonLink>
            <ButtonLink to="/privacidade" size="lg" variant="outline">
              Como tratamos seus dados
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
