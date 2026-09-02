import { cn } from '@/lib/utils';
import Link from 'next/link';
import type { GithubEpic } from '../operations';
import { GithubEpicStatus } from '../operations';

type RoadmapEpicCardProps = {
  epic: GithubEpic;
};

export function RoadmapEpicCard({ epic }: RoadmapEpicCardProps) {
  const progress =
    epic.totalIssues > 0 ? Math.round((epic.doneIssues / epic.totalIssues) * 100) : 0;
  const progressColor = getProgressBarColor(epic.status);
  const hoverBorderColor = getHoverBorderColor(epic.status);

  return (
    <Link
      href={epic.url}
      target={epic.url.startsWith('http') ? '_blank' : undefined}
      rel={epic.url.startsWith('http') ? 'noreferrer' : undefined}
      className={cn(
        'group bg-card text-card-foreground border-border flex flex-col gap-3 rounded-xl border p-5 transition-all hover:shadow-md',
        hoverBorderColor
      )}
    >
      <h4 className='text-foreground text-base font-semibold leading-tight transition-opacity'>
        {epic.name}
      </h4>

      <div className='mt-auto pt-1'>
        <div className='text-muted-foreground mb-1.5 flex justify-between text-xs'>
          <span>进度</span>
          <span>
            {progress}% ({epic.doneIssues}/{epic.totalIssues})
          </span>
        </div>
        <div className='bg-muted relative h-1.5 w-full overflow-hidden rounded-full'>
          <div
            className={cn('absolute h-full rounded-full', progressColor)}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </Link>
  );
}

const getProgressBarColor = (status: GithubEpicStatus) => {
  switch (status) {
    case GithubEpicStatus.Ideas:
      return 'bg-blue-500';
    case GithubEpicStatus.Planned:
      return 'bg-green-500';
    case GithubEpicStatus.InProgress:
      return 'bg-yellow-500';
    case GithubEpicStatus.Done:
      return 'bg-purple-500';
    default:
      return 'bg-gray-500';
  }
};

const getHoverBorderColor = (status: GithubEpicStatus) => {
  switch (status) {
    case GithubEpicStatus.Ideas:
      return 'hover:border-blue-400 dark:hover:border-blue-600';
    case GithubEpicStatus.Planned:
      return 'hover:border-green-400 dark:hover:border-green-600';
    case GithubEpicStatus.InProgress:
      return 'hover:border-yellow-400 dark:hover:border-yellow-600';
    case GithubEpicStatus.Done:
      return 'hover:border-purple-400 dark:hover:border-purple-600';
    default:
      return 'hover:border-gray-400 dark:hover:border-gray-600';
  }
};
