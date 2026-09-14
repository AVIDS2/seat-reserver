import { BrandMark } from '@/components/brand-mark';

interface NavigationItem {
  name: string;
  href: string;
}

export function Footer({
  footerNavigation
}: {
  footerNavigation: {
    app: NavigationItem[];
    company: NavigationItem[];
  };
}) {
  return (
    <div className='mx-auto mt-6 max-w-7xl px-6 lg:px-8'>
      <footer
        aria-labelledby='footer-heading'
        className='border-border relative border-t py-24 sm:mt-32'
      >
        <h2 id='footer-heading' className='sr-only'>
          页脚
        </h2>
        <div className='mt-10 flex flex-col justify-between gap-14 sm:flex-row'>
          <div className='max-w-sm'>
            <div className='flex items-center gap-2 font-semibold'>
              <BrandMark size={36} />
              席定
            </div>
            <p className='text-muted-foreground mt-5 text-sm leading-7'>
              选座、抢座、查结果，全部在一个工作台完成。
            </p>
          </div>
          <div className='flex gap-20'>
            <div>
              <h3 className='text-foreground text-sm font-semibold leading-6'>产品</h3>
              <ul className='mt-6 space-y-4'>
                {footerNavigation.app.map((item) => (
                  <li key={item.name}>
                    <a
                      href={item.href}
                      className='text-muted-foreground hover:text-foreground text-sm leading-6 transition-colors'
                    >
                      {item.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className='text-foreground text-sm font-semibold leading-6'>访问</h3>
              <ul className='mt-6 space-y-4'>
                {footerNavigation.company.map((item) => (
                  <li key={item.name}>
                    <a
                      href={item.href}
                      className='text-muted-foreground hover:text-foreground text-sm leading-6 transition-colors'
                    >
                      {item.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <div className='text-muted-foreground mt-16 flex flex-col gap-3 border-t pt-6 text-xs sm:flex-row sm:items-center sm:justify-between'>
          <span>仅用于本人账号的正常预约。</span>
          <span>© {new Date().getFullYear()} 席定</span>
        </div>
      </footer>
    </div>
  );
}
