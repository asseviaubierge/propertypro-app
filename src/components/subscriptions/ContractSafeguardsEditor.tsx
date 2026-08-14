"use client";

type Props = {
  safeguards: Record<string, any>;
  onboardingChecklist: Record<string, any>;
  offboardingChecklist: Record<string, any>;
  complianceRules: Record<string, any>;
  onSafeguardsChange: (key: string, value: any) => void;
  onOnboardingChange: (key: string, value: any) => void;
  onOffboardingChange: (key: string, value: any) => void;
  onComplianceChange: (key: string, value: any) => void;
};

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-w-0 items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm">
      <input className="mt-1 shrink-0" type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="min-w-0 leading-5 text-slate-800">{label}</span>
    </label>
  );
}

export default function ContractSafeguardsEditor(props: Props) {
  const { safeguards: s, onboardingChecklist: i, offboardingChecklist: o, complianceRules: c } = props;
  return (
    <section className="min-w-0 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-bold sm:text-xl">Protection, continuité et conformité</h2>
      <p className="mt-1 text-sm leading-5 text-slate-600">
        Ces choix deviennent des clauses structurées du contrat et servent à rassurer le contractant avant l'activation de son accès.
      </p>

      <div className="mt-5">
        <h3 className="font-semibold">Panne & double traçabilité</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Check label="Registre manuel / administratif des paiements" checked={!!s.manualPaymentRegister} onChange={(v) => props.onSafeguardsChange("manualPaymentRegister", v)} />
          <Check label="Registre indépendant des reversements propriétaires" checked={!!s.manualOwnerPayoutRegister} onChange={(v) => props.onSafeguardsChange("manualOwnerPayoutRegister", v)} />
          <Check label="Archivage indépendant des reçus, relevés et justificatifs" checked={!!s.independentEvidenceArchive} onChange={(v) => props.onSafeguardsChange("independentEvidenceArchive", v)} />
          <Check label="Sauvegardes techniques séparées de la base principale" checked={!!s.independentBackups} onChange={(v) => props.onSafeguardsChange("independentBackups", v)} />
          <Check label="Rapprochement obligatoire après panne" checked={!!s.outageReconciliation} onChange={(v) => props.onSafeguardsChange("outageReconciliation", v)} />
          <Check label="Piste d'audit conservée lors des corrections" checked={!!s.immutableAuditTrail} onChange={(v) => props.onSafeguardsChange("immutableAuditTrail", v)} />
          <Check label="Notification des incidents importants aux parties concernées" checked={!!s.incidentNotification} onChange={(v) => props.onSafeguardsChange("incidentNotification", v)} />
          <Check label="Vérification renforcée d'un changement de coordonnées de reversement" checked={!!s.financialInstructionVerification} onChange={(v) => props.onSafeguardsChange("financialInstructionVerification", v)} />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Fréquence des sauvegardes
            <input className="mt-1 h-10 w-full rounded-md border px-3" value={s.backupFrequency || "Quotidienne + sauvegardes périodiques"} onChange={(e) => props.onSafeguardsChange("backupFrequency", e.target.value)} />
          </label>
          <label className="text-sm">Réserve de garantie de référence (FCFA)
            <input type="number" min="0" className="mt-1 h-10 w-full rounded-md border px-3" value={s.guaranteeReserveAmount || 0} onChange={(e) => props.onSafeguardsChange("guaranteeReserveAmount", Number(e.target.value))} />
          </label>
        </div>
      </div>

      <div className="mt-5">
        <h3 className="font-semibold">Fraude, assurances & risques</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Check label="Contrôles internes contre fraude / détournement" checked={!!s.employeeFraudControls} onChange={(v) => props.onSafeguardsChange("employeeFraudControls", v)} />
          <Check label="Responsabilité civile professionnelle E-IMMO à vérifier / souscrire" checked={!!s.professionalLiabilityInsurance} onChange={(v) => props.onSafeguardsChange("professionalLiabilityInsurance", v)} />
          <Check label="Assurance adaptée du bien demandée au propriétaire" checked={!!s.propertyInsuranceRequired} onChange={(v) => props.onSafeguardsChange("propertyInsuranceRequired", v)} />
          <Check label="Couverture risques locatifs recommandée aux occupants" checked={!!s.tenantLiabilityInsuranceRecommended} onChange={(v) => props.onSafeguardsChange("tenantLiabilityInsuranceRecommended", v)} />
          <Check label="Protection cyber / cyberassurance envisagée" checked={!!s.cyberInsurance} onChange={(v) => props.onSafeguardsChange("cyberInsurance", v)} />
          <Check label="Protection des fonds de tiers / fraude à prévoir" checked={!!s.thirdPartyFundsProtection} onChange={(v) => props.onSafeguardsChange("thirdPartyFundsProtection", v)} />
          <Check label="Réserve financière obligatoire si revenu garanti" checked={!!s.guaranteeReserveRequired} onChange={(v) => props.onSafeguardsChange("guaranteeReserveRequired", v)} />
        </div>
        <label className="mt-3 block text-sm">Force majeure / continuité particulière
          <textarea className="mt-1 min-h-20 w-full rounded-md border p-3" value={s.forceMajeureNotes || ""} onChange={(e) => props.onSafeguardsChange("forceMajeureNotes", e.target.value)} />
        </label>
      </div>

      <details className="mt-5 rounded-xl border bg-white p-3" open>
        <summary className="cursor-pointer font-semibold">Fiche de situation initiale</summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            ["ownerIdentityVerified", "Identité du contractant vérifiée"],
            ["ownershipDocumentsVerified", "Documents relatifs au bien vérifiés"],
            ["existingOccupantsDeclared", "Occupants existants déclarés"],
            ["existingLeasesCollected", "Baux existants récupérés"],
            ["priorArrearsDeclared", "Impayés antérieurs déclarés"],
            ["depositsAdvancesDeclared", "Dépôts et avances antérieurs déclarés"],
            ["propertyConditionRecorded", "État initial du bien renseigné"],
            ["knownDisputesDeclared", "Litiges connus déclarés"],
            ["payoutCoordinatesVerified", "Coordonnées de reversement vérifiées"],
          ].map(([key, label]) => <Check key={key} label={label} checked={!!i[key]} onChange={(v) => props.onOnboardingChange(key, v)} />)}
        </div>
      </details>

      <details className="mt-3 rounded-xl border bg-white p-3">
        <summary className="cursor-pointer font-semibold">État de sortie E-IMMO</summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            ["closureStatementRequired", "État de clôture obligatoire"],
            ["finalFinancialStatement", "État financier final"],
            ["depositsTransferred", "Dépôts / avances transférés ou régularisés"],
            ["documentsDelivered", "Documents remis / archivés"],
            ["activeLeasesTransferred", "Baux actifs et dossiers en cours recensés"],
            ["openDisputesRecorded", "Litiges / incidents ouverts recensés"],
          ].map(([key, label]) => <Check key={key} label={label} checked={!!o[key]} onChange={(v) => props.onOffboardingChange(key, v)} />)}
        </div>
      </details>

      <details className="mt-3 rounded-xl border bg-white p-3">
        <summary className="cursor-pointer font-semibold">Données, identité, fiscalité & procédures</summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            ["identityVerification", "Vérification d'identité / KYC"],
            ["dataUseNoticeAccepted", "Information sur l'utilisation des données"],
            ["occupantContactUseRestricted", "Contacts occupants limités à la gestion du bien"],
            ["accountSecurityAcknowledged", "Sécurité et confidentialité du compte reconnues"],
            ["collectionAuthorization", "Recouvrement amiable autorisé"],
            ["legalProceedingsNeedApproval", "Procédure judiciaire soumise à validation spécifique"],
            ["taxResponsibilityAcknowledged", "Responsabilités fiscales du contractant reconnues"],
            ["deathSuccessionProcedure", "Procédure décès / succession prévue"],
            ["propertySaleProcedure", "Procédure vente / changement de propriétaire prévue"],
          ].map(([key, label]) => <Check key={key} label={label} checked={!!c[key]} onChange={(v) => props.onComplianceChange(key, v)} />)}
        </div>
      </details>
    </section>
  );
}
