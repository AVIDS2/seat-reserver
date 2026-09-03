import { Icons } from '@/components/icons';

const LOGOS = [
  { id: 'map', name: '实时座位图', element: <Icons.mapPin /> },
  { id: 'automation', name: '自动执行', element: <Icons.bolt /> },
  { id: 'privacy', name: '隐私隔离', element: <Icons.lock /> },
  { id: 'results', name: '结果追踪', element: <Icons.history /> }
];

export function Clients() {
  return (
    <div className='items-between mx-auto mt-12 flex max-w-7xl flex-col gap-y-6 px-6 lg:px-8'>
      <h2 className='text-muted-foreground mb-6 text-center font-semibold tracking-wide'>
        从选座到结果，一个平台完成
      </h2>

      <div className='mx-auto grid max-w-lg grid-cols-2 items-center gap-x-8 gap-y-12 sm:max-w-xl sm:gap-x-10 sm:gap-y-14 md:grid-cols-4 lg:mx-0 lg:max-w-none'>
        {LOGOS.map((logo) => (
          <div
            key={logo.id}
            className='text-muted-foreground col-span-1 flex items-center justify-center gap-2 opacity-80 transition-opacity hover:opacity-100'
          >
            {logo.element}
            <span className='text-sm font-semibold'>{logo.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
