import Link from "next/link";
import { WifiOff } from "lucide-react";

export const metadata = {
  title: "Connexion indisponible",
};

export default function HorsLignePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 p-6 text-slate-900">
      <section className="w-full max-w-md rounded-2xl border bg-white p-7 text-center shadow-sm">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
          <WifiOff className="h-7 w-7" />
        </span>
        <h1 className="mt-5 text-2xl font-bold">Connexion indisponible</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          GESTION E-IMMO ne peut pas joindre le serveur. Vérifiez votre connexion,
          puis réessayez. Les écrans déjà chargés restent accessibles lorsqu’ils
          sont disponibles sur l’appareil.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700"
        >
          Réessayer
        </Link>
      </section>
    </main>
  );
}
