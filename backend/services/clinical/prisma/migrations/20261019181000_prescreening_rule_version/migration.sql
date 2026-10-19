-- RN08: cada resultado guarda a versão das regras usada na avaliação.
ALTER TABLE "pre_screenings" ADD COLUMN "ruleSetVersion" TEXT;

UPDATE "pre_screenings" AS p
   SET "ruleSetVersion" = s."version"
  FROM "screening_rule_sets" AS s
 WHERE s."id" = p."ruleSetId";
