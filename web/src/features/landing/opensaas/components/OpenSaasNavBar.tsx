'use client';

import { Icons } from '@/components/icons';
import { ThemeModeToggle } from '@/components/themes/theme-mode-toggle';
import { Button, buttonVariants } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { signOutPlatform } from '@/features/booking/api/service';
import type { PlatformUser } from '@/features/booking/api/service';
import { cn } from '@/lib/utils';
import { useMotionValueEvent, useScroll } from 'motion/react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

const navigationItems = [
  { name: '产品能力', href: '#features' },
  { name: '执行流程', href: '#flow' },
  { name: '路线图', href: '#roadmap' },
  { name: '常见问题', href: '#faq' }
];

export function OpenSaasNavBar({ user }: { user: PlatformUser | null }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, 'change', (latest) => setIsScrolled(latest > 0));

  const signOut = async () => {
    setSigningOut(true);
    try {
      await signOutPlatform();
      window.location.assign('/');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '退出登录失败');
      setSigningOut(false);
    }
  };

  return (
    <header className={cn('sticky top-0 z-50 transition-all duration-300', isScrolled && 'top-4')}>
      <div
        className={cn(
          'transition-all duration-300',
          isScrolled
            ? 'bg-background/90 border-border mx-4 rounded-full border pr-2 shadow-lg backdrop-blur-lg md:mx-20 lg:pr-0'
            : 'bg-background/80 border-border mx-0 border-b backdrop-blur-lg'
        )}
      >
        <nav
          className={cn(
            'flex items-center justify-between transition-all duration-300',
            isScrolled ? 'p-3 lg:px-6' : 'p-6 lg:px-8'
          )}
          aria-label='主导航'
        >
          <div className='flex items-center gap-6'>
            <Link
              href='/'
              className='text-foreground hover:text-primary flex items-center transition-colors duration-300'
            >
              <NavLogo isScrolled={isScrolled} />
              <span
                className={cn(
                  'font-semibold leading-6 transition-all duration-300',
                  isScrolled ? 'ml-2 text-xs' : 'ml-2 text-sm'
                )}
              >
                一考即过
              </span>
            </Link>
            <ul className='ml-4 hidden items-center gap-6 lg:flex'>
              {navigationItems.map((item) => (
                <li key={item.name}>
                  <a
                    href={item.href}
                    className='text-foreground hover:text-primary text-sm font-normal transition-colors'
                  >
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className='hidden items-center justify-end gap-3 lg:flex'>
            <ThemeModeToggle />
            {user ? (
              <>
                <Link
                  href='/dashboard/overview'
                  className={cn(buttonVariants({ size: 'sm' }), 'ml-2')}
                >
                  进入控制台
                  <Icons.arrowRight />
                </Link>
                <button
                  type='button'
                  onClick={() => void signOut()}
                  disabled={signingOut}
                  className='text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 px-2 text-sm transition-colors'
                >
                  <Icons.logout />
                  {signingOut ? '退出中' : '退出'}
                </button>
              </>
            ) : (
              <>
                <Link
                  href='/auth/sign-in'
                  className='text-foreground hover:text-primary ml-2 inline-flex items-center gap-1.5 text-sm font-semibold transition-colors'
                >
                  登录
                  <Icons.login />
                </Link>
                <Link href='/auth/sign-up' className={cn(buttonVariants({ size: 'sm' }), 'ml-2')}>
                  开始使用
                  <Icons.arrowRight />
                </Link>
              </>
            )}
          </div>

          <div className='flex lg:hidden'>
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger render={<Button variant='ghost' size='icon' aria-label='打开主菜单' />}>
                <Icons.menu className={cn(isScrolled ? 'size-5' : 'size-7')} />
              </SheetTrigger>
              <SheetContent side='right' className='w-[300px] sm:w-[380px]'>
                <SheetHeader>
                  <SheetTitle>
                    <Link
                      href='/'
                      className='text-foreground inline-flex items-center gap-2'
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <NavLogo isScrolled={false} />
                      一考即过
                    </Link>
                  </SheetTitle>
                </SheetHeader>
                <div className='mt-6 flow-root'>
                  <div className='divide-border -my-6 divide-y'>
                    <ul className='space-y-2 py-6'>
                      {navigationItems.map((item) => (
                        <li key={item.name}>
                          <a
                            href={item.href}
                            className='text-foreground hover:bg-accent block rounded-lg px-3 py-2 text-sm font-medium leading-7 transition-colors'
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            {item.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                    <div className='flex gap-2 py-6'>
                      {user ? (
                        <>
                          <Link
                            href='/dashboard/overview'
                            className={cn(buttonVariants(), 'flex-1')}
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            进入控制台
                          </Link>
                          <Button
                            variant='outline'
                            className='flex-1'
                            onClick={() => void signOut()}
                            disabled={signingOut}
                          >
                            {signingOut ? '退出中' : '退出登录'}
                          </Button>
                        </>
                      ) : (
                        <>
                          <Link
                            href='/auth/sign-in'
                            className={cn(buttonVariants({ variant: 'outline' }), 'flex-1')}
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            登录
                          </Link>
                          <Link
                            href='/auth/sign-up'
                            className={cn(buttonVariants(), 'flex-1')}
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            开始使用
                          </Link>
                        </>
                      )}
                    </div>
                    <div className='py-6'>
                      <ThemeModeToggle />
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </nav>
      </div>
    </header>
  );
}

function NavLogo({ isScrolled }: { isScrolled: boolean }) {
  return (
    <span
      className={cn(
        'bg-foreground text-background flex items-center justify-center rounded-md transition-all duration-500',
        isScrolled ? 'size-7' : 'size-8'
      )}
    >
      <Icons.bolt className={cn(isScrolled ? 'size-3.5' : 'size-4')} />
    </span>
  );
}
