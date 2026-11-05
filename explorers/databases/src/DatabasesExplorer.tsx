import { Explorer } from '@howitflows/engine';
import { DATABASES_CONFIG } from './index';
import { SnippetStudio } from './SnippetStudio';

/** Astro island: only serialisable props cross the boundary, so the config is imported here. */
export default function DatabasesExplorer({ initialId }: { initialId: string }) {
  return (
    <Explorer
      config={DATABASES_CONFIG}
      initialId={initialId}
      studioLabel="Snippets"
      studio={(db, toast) => <SnippetStudio db={db} onToast={toast} />}
    />
  );
}
