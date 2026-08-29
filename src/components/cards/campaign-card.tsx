import Link from 'next/link';
import { MediaFrame } from '@/components/ui/media-frame';
import { Badge } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { formatCents } from '@/lib/money';

export interface CampaignCardData {
  slug: string;
  title: string;
  summary?: string | null;
  thumbnailUrl?: string | null;
  heroImageUrl?: string | null;
  goalCents: number;
  raisedCents: number;
  category?: string | null;
  status: string;
}

export function CampaignProgress({ raised, goal }: { raised: number; goal: number }) {
  if (goal <= 0) return null;
  const percent = Math.min(100, Math.round((raised / goal) * 100));
  return (
    <div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-ink-600">
        <div className="h-full bg-gold-sheen" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 flex justify-between text-[11px] uppercase tracking-[0.14em] text-bone-dim">
        <span className="text-gold-400">{formatCents(raised)} raised</span>
        <span>{percent}% of {formatCents(goal)}</span>
      </p>
    </div>
  );
}

export function CampaignCard({ campaign, className }: { campaign: CampaignCardData; className?: string }) {
  return (
    <Link href={`/heartfelt/${campaign.slug}`} className={cn('group block', className)}>
      <MediaFrame
        src={campaign.thumbnailUrl ?? campaign.heroImageUrl}
        alt={campaign.title}
        seed={campaign.title}
        ratio="video"
        className="border border-ink-600 transition-all duration-300 ease-premium group-hover:border-gold-700/70"
      >
        {campaign.category ? (
          <span className="absolute left-3 top-3">
            <Badge tone="gold">{campaign.category}</Badge>
          </span>
        ) : null}
      </MediaFrame>
      <h3 className="mt-4 font-display text-xl leading-tight tracking-tight text-bone transition-colors group-hover:text-gold-300">
        {campaign.title}
      </h3>
      {campaign.summary ? (
        <p className="mt-2 line-clamp-2 text-sm text-bone-dim">{campaign.summary}</p>
      ) : null}
      {campaign.goalCents > 0 ? (
        <div className="mt-4">
          <CampaignProgress raised={campaign.raisedCents} goal={campaign.goalCents} />
        </div>
      ) : null}
    </Link>
  );
}
