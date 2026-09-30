import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { getServerDict } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getServerDict();
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center sm:px-6">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sunken text-ink-3">
        <Icon name="search" size={26} />
      </span>
      <p className="mt-5 text-[17px] font-semibold">{t.errors.not_found}</p>
      <ButtonLink href="/" variant="secondary" className="mt-6" icon="arrowLeft">
        {t.nav.home}
      </ButtonLink>
    </div>
  );
}
