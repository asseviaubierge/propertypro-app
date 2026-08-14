export type ContractTemplateInput = {
  contractType: string;
  pricingMode: string;
  fixedAmount?: number | string;
  percentageRate?: number | string;
  minimumAmount?: number | string;
  billingPeriod?: string;
  maxProperties?: number | string;
  maxUnits?: number | string;
  maxActiveTenants?: number | string;
  tierLabel?: string;
  renewalMode?: string;
  conditions?: string;
  specialClauses?: string;
  mandateRules?: Record<string, any>;
  safeguards?: Record<string, any>;
  onboardingChecklist?: Record<string, any>;
  offboardingChecklist?: Record<string, any>;
  complianceRules?: Record<string, any>;
};

type AccountLike = {
  firstName?: string;
  lastName?: string;
  businessName?: string;
  email?: string;
  phone?: string;
  role?: string;
  ifu?: string;
  rccm?: string;
  cip?: string;
};

type PortfolioLike = {
  propertyCount?: number;
  unitCount?: number;
  occupiedUnitCount?: number;
  vacantUnitCount?: number;
  activeTenantCount?: number;
  activeLeaseCount?: number;
};

const yesNo = (v: unknown) => (v ? "Oui" : "Non");
const money = (v: unknown) => Number(v || 0).toLocaleString("fr-FR");

export function contractTypeLabel(type: string) {
  if (type === "scale") return "Contrat d'abonnement et d'accès à la plateforme E-IMMO.BJ — Barème";
  if (type === "negotiated") return "Contrat d'abonnement et d'accès à la plateforme E-IMMO.BJ — Personnalisé";
  if (type === "management") return "Mandat de gestion immobilière E-IMMO.BJ";
  return "Mandat de gestion immobilière E-IMMO.BJ avec revenu garanti";
}

export function buildSubscriptionContractText(args: {
  form: ContractTemplateInput;
  account?: AccountLike;
  accountName: string;
  portfolio?: PortfolioLike | null;
  periodText: string;
}) {
  const { form, account, accountName, portfolio, periodText } = args;
  const r = form.mandateRules || {};
  const s = form.safeguards || {};
  const i = form.onboardingChecklist || {};
  const o = form.offboardingChecklist || {};
  const c = form.complianceRules || {};
  const type = contractTypeLabel(form.contractType);
  const isMandate = ["management", "guaranteed_management"].includes(form.contractType);
  const guaranteed = form.contractType === "guaranteed_management" || r.guaranteedIncomeEnabled;

  const pricing = form.pricingMode === "fixed"
    ? `${money(form.fixedAmount)} FCFA / ${form.billingPeriod === "yearly" ? "an" : "mois"}`
    : form.pricingMode === "percentage"
      ? `${Number(form.percentageRate || 0)} % de la base contractuelle${Number(form.minimumAmount || 0) > 0 ? `, minimum ${money(form.minimumAmount)} FCFA` : ""}`
      : `${money(form.fixedAmount)} FCFA + ${Number(form.percentageRate || 0)} %${Number(form.minimumAmount || 0) > 0 ? `, minimum ${money(form.minimumAmount)} FCFA` : ""}`;

  return `E-IMMO.BJ
${type.toUpperCase()}

DOCUMENT À LIRE, COMPLÉTER ET VALIDER AVANT ACTIVATION DES DROITS CONTRACTUELS

ENTRE LES SOUSSIGNÉS

1. E-IMMO.BJ / GESTION E-IMMO, plateforme et structure de gestion immobilière, ci-après « E-IMMO » ;

ET

2. ${accountName}${account?.email ? ` — e-mail : ${account.email}` : ""}${account?.phone ? ` — téléphone : ${account.phone}` : ""}${account?.rccm ? ` — RCCM : ${account.rccm}` : ""}${account?.ifu ? ` — IFU : ${account.ifu}` : ""}, ci-après « le Contractant ».

ARTICLE 1 — OBJET
Le présent contrat encadre l'accès aux services E-IMMO.BJ et, lorsqu'un mandat est choisi, les responsabilités et pouvoirs expressément confiés à E-IMMO. L'accès à la plateforme intervient après validation du contrat et des pièces nécessaires.

ARTICLE 2 — TYPE DE CONTRAT ET TARIFICATION
Type : ${type}.
Tarification : ${pricing}.
Périodicité : ${form.billingPeriod === "yearly" ? "Annuelle" : "Mensuelle"}.
Toute modification tarifaire ou de capacité doit être formalisée par un avenant, un renouvellement ou une validation contractuelle traçable.

ARTICLE 3 — CAPACITÉ CONTRACTUELLE AUTORISÉE
Propriétés autorisées : ${form.maxProperties || 0}.
Ménages / unités autorisés : ${form.maxUnits || 0}.
Locataires actifs autorisés : ${form.maxActiveTenants || 0}.
Tranche commerciale : ${form.tierLabel || "Non définie"}.
Ces valeurs représentent les limites autorisées et non l'utilisation réelle au jour de la signature.

ARTICLE 4 — ÉTAT RÉEL DU PORTEFEUILLE AU MOMENT DE L'ÉTABLISSEMENT
Propriétés enregistrées : ${portfolio?.propertyCount ?? 0}.
Unités enregistrées : ${portfolio?.unitCount ?? 0}.
Unités occupées : ${portfolio?.occupiedUnitCount ?? 0}.
Unités vacantes : ${portfolio?.vacantUnitCount ?? 0}.
Locataires actifs : ${portfolio?.activeTenantCount ?? 0}.
Baux actifs : ${portfolio?.activeLeaseCount ?? 0}.
L'état réel est synchronisé à partir des propriétés, unités et baux ; il ne modifie pas automatiquement les limites du contrat.

ARTICLE 5 — DURÉE ET RENOUVELLEMENT
Période : ${periodText}.
Renouvellement : ${form.renewalMode === "automatic" ? "Automatique selon les conditions validées" : "Manuel"}.

ARTICLE 6 — REVERSEMENT AU PROPRIÉTAIRE
Jour mensuel de reversement : le ${r.ownerPayoutDay || 15} de chaque mois.
Règle : ${r.payoutRule === "guaranteed" ? "revenu garanti" : r.payoutRule === "custom" ? "règle particulière convenue" : "sommes réellement encaissées"}.
${r.payoutNotes || "Tout écart entre loyers attendus, encaissés, retenues autorisées et montant reversé doit être explicité dans l'état de gestion."}

ARTICLE 7 — BAUX, OCCUPATION, VACANCE ET REMPLACEMENT
Tout bail doit rester rattaché au bien et à l'occupant concernés. Les activations, renouvellements, expirations et résiliations sont journalisés. Une résiliation n'entraîne la vacance effective qu'à la sortie réelle de l'occupant.
Remplacement d'occupant : ${r.tenantReplacementAuthority === "automatic" ? "E-IMMO est autorisé à rechercher et installer un nouvel occupant dans les critères convenus." : r.tenantReplacementAuthority === "not_authorized" ? "E-IMMO n'est pas autorisé à installer un nouvel occupant sans avenant ou autorisation." : "L'accord du propriétaire est requis avant installation du nouvel occupant."}
Suivi de vacance : ${yesNo(r.vacancyManagementEnabled)}.
Couverture financière de vacance : ${r.vacancyCoverageEnabled ? `${r.vacancyCoverageDays || 0} jours, plafond ${money(r.vacancyCoverageCap)} FCFA` : "Non, sauf clause particulière"}.

ARTICLE 8 — AVANCES, CAUTIONS, DÉPÔTS ET FONDS DE TIERS
${r.advancePolicy || "Les avances sur loyer sont identifiées séparément et affectées aux échéances correspondantes."}
${r.depositPolicy || "Les cautions et dépôts de garantie sont suivis séparément des loyers."}
Aucune avance, caution ou somme détenue pour autrui ne doit être confondue avec un revenu propre d'E-IMMO. Chaque mouvement doit disposer d'une origine, d'une référence et d'une destination traçables.

ARTICLE 9 — IMPAYÉS ET REVENU GARANTI
${guaranteed ? `E-IMMO assume une garantie dans les limites suivantes : montant de référence ${money(r.guaranteedIncomeAmount)} FCFA ; taux ${Number(r.guaranteedIncomeRate || 0)} % ; durée maximale d'impayé ${Number(r.guaranteeMaxUnpaidMonths || 0)} mois ; plafond annuel ${money(r.guaranteeAnnualCap)} FCFA. La part avancée par E-IMMO reste distincte du paiement réellement effectué par l'occupant.` : "E-IMMO ne garantit pas automatiquement les loyers non encaissés. Les impayés restent identifiés et font l'objet du suivi prévu au contrat."}
${guaranteed ? `Réserve ou mécanisme de sécurisation de la garantie : ${s.guaranteeReserveRequired ? `requis${Number(s.guaranteeReserveAmount || 0) > 0 ? ` — référence ${money(s.guaranteeReserveAmount)} FCFA` : ""}` : "à définir avant activation commerciale de la garantie"}.` : ""}

ARTICLE 10 — TRANSPARENCE TOTALE ET JOURNAL DE GESTION
Le propriétaire dispose d'un espace de supervision sur les biens concernés : statut occupé/vacant, occupants, baux, paiements, impayés, avances, cautions, dépenses, factures, maintenances, inspections, reversements et événements significatifs.
Contacts téléphone / WhatsApp des occupants : ${r.ownerCanViewOccupantContacts ? "visibles lorsque leur communication est conforme aux règles applicables et à l'information donnée aux personnes concernées" : "non affichés"}.
Les opérations importantes doivent alimenter un journal chronologique permettant d'identifier l'événement, sa date, son auteur et, pour une correction, la valeur antérieure lorsque cela est applicable.

ARTICLE 11 — DÉPENSES, MAINTENANCE ET INTERVENTIONS
${Number(r.expenseApprovalThreshold || 0) > 0 ? `E-IMMO peut engager sans accord préalable les dépenses autorisées jusqu'à ${money(r.expenseApprovalThreshold)} FCFA. Au-delà, l'accord du propriétaire est requis, sauf mesure urgente et conservatoire conforme au mandat.` : "Les dépenses nécessitant un accord du propriétaire restent soumises aux clauses particulières."}
Les devis, factures, reçus, photos ou pièces utiles sont rattachés au dossier lorsque disponibles. Les responsabilités d'E-IMMO, du propriétaire et des prestataires restent appréciées selon l'origine de l'incident et le mandat effectivement confié.

ARTICLE 12 — PANNE, CONTINUITÉ HORS SYSTÈME ET DOUBLE TRAÇABILITÉ
En cas d'indisponibilité totale ou partielle de la plateforme, les opérations importantes ne doivent pas disparaître. E-IMMO applique un mode de continuité documentaire puis réalise un rapprochement lors du rétablissement.
Registre manuel/administratif des paiements : ${yesNo(s.manualPaymentRegister)}.
Registre des reversements propriétaires : ${yesNo(s.manualOwnerPayoutRegister)}.
Conservation des justificatifs indépendants de la plateforme : ${yesNo(s.independentEvidenceArchive)}.
Sauvegarde technique séparée de la base principale : ${yesNo(s.independentBackups)}${s.backupFrequency ? ` — fréquence : ${s.backupFrequency}` : ""}.
Rapprochement après panne : ${yesNo(s.outageReconciliation)}.
Piste d'audit non effaçable pour les corrections : ${yesNo(s.immutableAuditTrail)}.
Notification des incidents importants : ${yesNo(s.incidentNotification)}.
Une panne interne ne permet pas de supprimer une dette, un paiement, une facture, un bail ou une preuve. Les opérations enregistrées hors système sont régularisées en conservant leur date réelle.

ARTICLE 13 — FRAUDE, ERREUR HUMAINE ET INSTRUCTIONS FINANCIÈRES SENSIBLES
Les paiements doivent emprunter les canaux officiellement communiqués. Les comptes personnels d'agents ne constituent pas un moyen de paiement officiel sauf procédure écrite exceptionnelle.
Contrôles antifraude internes : ${yesNo(s.employeeFraudControls)}.
Vérification renforcée lors d'un changement de coordonnées de reversement : ${yesNo(s.financialInstructionVerification)}.
Toute erreur financière significative doit être corrigée avec justification et conservation de la piste d'audit. Une fraude ou suspicion de détournement déclenche une procédure d'incident et de conservation des preuves.

ARTICLE 14 — ASSURANCES ET GESTION DES RISQUES
Responsabilité civile professionnelle E-IMMO prévue / à vérifier : ${yesNo(s.professionalLiabilityInsurance)}.
Assurance adaptée du bien à la charge du propriétaire ou selon convention : ${yesNo(s.propertyInsuranceRequired)}.
Couverture responsabilité / risques locatifs recommandée aux occupants : ${yesNo(s.tenantLiabilityInsuranceRecommended)}.
Protection cyber / cyberassurance envisagée : ${yesNo(s.cyberInsurance)}.
Protection des fonds de tiers / fraude : ${yesNo(s.thirdPartyFundsProtection)}.
Aucune couverture ne doit être présentée comme acquise tant qu'une police ou un mécanisme effectif n'est pas en vigueur. Les références d'assurance peuvent être complétées en annexe.

ARTICLE 15 — FICHE DE SITUATION INITIALE
Avant prise en charge opérationnelle, les parties vérifient autant que nécessaire :
- Identité du contractant vérifiée : ${yesNo(i.ownerIdentityVerified)}.
- Documents relatifs au bien vérifiés : ${yesNo(i.ownershipDocumentsVerified)}.
- Occupants existants déclarés : ${yesNo(i.existingOccupantsDeclared)}.
- Baux existants récupérés : ${yesNo(i.existingLeasesCollected)}.
- Impayés antérieurs déclarés : ${yesNo(i.priorArrearsDeclared)}.
- Dépôts et avances antérieurs déclarés : ${yesNo(i.depositsAdvancesDeclared)}.
- État initial du bien renseigné : ${yesNo(i.propertyConditionRecorded)}.
- Litiges connus déclarés : ${yesNo(i.knownDisputesDeclared)}.
- Coordonnées de reversement vérifiées : ${yesNo(i.payoutCoordinatesVerified)}.
Cette fiche permet de distinguer les situations antérieures à la prise en charge E-IMMO des opérations réalisées pendant le mandat.

ARTICLE 16 — CONFIDENTIALITÉ, DONNÉES, IDENTITÉ ET ACCÈS
Vérification d'identité / KYC adaptée au niveau de risque : ${yesNo(c.identityVerification)}.
Information sur l'utilisation des données : ${yesNo(c.dataUseNoticeAccepted)}.
Partage des contacts occupants limité à la gestion du bien : ${yesNo(c.occupantContactUseRestricted)}.
Accès aux comptes protégé et personnel : ${yesNo(c.accountSecurityAcknowledged)}.
Le contractant s'engage à ne pas détourner les données de leur finalité de gestion et à signaler rapidement tout accès suspect.

ARTICLE 17 — POUVOIRS, RECOUVREMENT, FISCALITÉ ET PROCÉDURES
Gestion des baux par E-IMMO : ${yesNo(r.manageLeases)}.
Encaissements par E-IMMO : ${yesNo(r.manageCollections)}.
Maintenance par E-IMMO : ${yesNo(r.manageMaintenance)}.
Inspections par E-IMMO : ${yesNo(r.manageInspections)}.
Recouvrement amiable autorisé : ${yesNo(c.collectionAuthorization)}.
Procédure judiciaire nécessitant validation spécifique du contractant : ${yesNo(c.legalProceedingsNeedApproval)}.
Responsabilités fiscales du contractant reconnues : ${yesNo(c.taxResponsibilityAcknowledged)}.
E-IMMO n'exerce que les pouvoirs expressément accordés par le contrat, les annexes, une procuration ou une autorisation traçable lorsque celle-ci est requise.

ARTICLE 18 — DÉCÈS, SUCCESSION, VENTE DU BIEN ET CHANGEMENT DE BÉNÉFICIAIRE
Procédure décès/succession prévue : ${yesNo(c.deathSuccessionProcedure)}.
Procédure de vente/changement de propriétaire prévue : ${yesNo(c.propertySaleProcedure)}.
Un changement de bénéficiaire des reversements, de propriétaire ou de représentant ne doit pas être exécuté sur une simple instruction non vérifiée. Les justificatifs appropriés sont requis et l'historique est conservé.

ARTICLE 19 — ÉTAT DE SORTIE ET FIN DU PARTENARIAT
État de clôture obligatoire : ${yesNo(o.closureStatementRequired)}.
État financier final : ${yesNo(o.finalFinancialStatement)}.
Situation des dépôts/avances transférée ou régularisée : ${yesNo(o.depositsTransferred)}.
Documents remis / archivés : ${yesNo(o.documentsDelivered)}.
Baux actifs et dossiers en cours recensés : ${yesNo(o.activeLeasesTransferred)}.
Litiges ou incidents ouverts recensés : ${yesNo(o.openDisputesRecorded)}.
La fin du partenariat ne doit pas effacer l'historique nécessaire à la preuve des opérations.

ARTICLE 20 — FORCE MAJEURE, INCIDENTS MAJEURS ET CONTINUITÉ
Les événements indépendants de la volonté des parties sont traités selon le droit applicable et les circonstances. Une simple panne interne ne constitue pas automatiquement une exonération générale. Les sommes déjà encaissées pour compte de tiers restent identifiées et doivent être rapprochées.
${s.forceMajeureNotes || "Les modalités particulières de continuité, d'assurance et d'information sont précisées au besoin dans les clauses particulières."}

ARTICLE 21 — CONDITIONS GÉNÉRALES ET CLAUSES PARTICULIÈRES
${form.conditions || "À compléter ou adapter avant validation."}

Clauses particulières :
${form.specialClauses || "Aucune clause particulière supplémentaire à ce stade."}

ARTICLE 22 — VALIDATION AVANT ACCÈS
Le contractant reconnaît avoir reçu les explications relatives au type de contrat, à la tarification, aux responsabilités, à la conservation des preuves, aux limites de garantie et aux règles de gestion. Le texte reste modifiable par E-IMMO avant validation finale.

Fait entre E-IMMO.BJ et ${accountName}.

POUR E-IMMO.BJ                              LE CLIENT / CONTRACTANT
Nom : _____________________                 Nom : _____________________
Qualité : __________________                Qualité : __________________
Date : _____________________                Date : _____________________
Signature / cachet :                        Signature / cachet :`;
}
