import { IconArrowRight } from '@tabler/icons-react';
import Link from 'next/link';

import { GithubEpicStatus, roadmapItems } from '../operations';
import { RoadmapStatusColumn } from './RoadmapStatusColumn';

export function Roadmap() {
  return (
    <div className='scroll-mt-24 py-12 md:py-20' id='roadmap'>
      <div className='mx-auto max-w-7xl px-6 lg:px-8'>
        <div className='mx-auto mb-12 max-w-2xl text-center'>
          <h2 className='text-foreground text-3xl font-bold tracking-tight sm:text-4xl'>
            运行路线图
          </h2>
          <p className='text-muted-foreground mt-4 text-lg leading-8'>
            已上线能力与接下来的更新。
          </p>
        </div>
        <div className='grid gap-6 md:grid-cols-4'>
          {Object.values(GithubEpicStatus).map((status) => (
            <RoadmapStatusColumn
              key={status}
              status={status}
              epics={roadmapItems.filter((item) => item.status === status)}
            />
          ))}
        </div>
        <Link
          href='/auth/sign-up'
          className='text-primary hover:text-primary/80 mx-auto mt-10 flex w-fit items-center gap-2 text-sm font-medium'
        >
          开始创建任务
          <IconArrowRight className='size-4' />
        </Link>
      </div>
    </div>
  );
}
