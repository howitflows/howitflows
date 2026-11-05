import { NodeArt, type ArtIcon } from '@howitflows/art';

/** Small static illustration for a hub card. Gradients come from the page-level <ArtDefs/>. */
export default function TopicArt({ icon, live }: { icon: ArtIcon; live: boolean }) {
  return (
    <svg className="topic-art" viewBox="-62 -56 124 112" aria-hidden>
      <NodeArt icon={icon} active={false} motion={live} />
    </svg>
  );
}
