'use client';

import { useState } from 'react';

import { Icons } from '@/components/icons';
import {
  CAMPUS_DEFINITIONS,
  getCampusDefinition,
  type CampusCode
} from '@/config/campus-config';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SidebarMenuButton } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

import { useCampusWorkspace, type CampusScope } from '../campus-workspace';

export function CampusLogo({ campus, className }: { campus: CampusCode; className?: string }) {
  const definition = getCampusDefinition(campus);
  return (
    <span
      className={cn(
        'bg-muted text-foreground flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold',
        className
      )}
      aria-hidden='true'
    >
      {definition.initials}
    </span>
  );
}

export function CampusPicker({
  value,
  onValueChange,
  disabled = false
}: {
  value: CampusCode;
  onValueChange: (value: CampusCode) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = getCampusDefinition(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type='button'
            className='border-input bg-background hover:bg-muted/40 flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:pointer-events-none disabled:opacity-60'
            disabled={disabled}
            aria-label='选择绑定高校'
          />
        }
      >
        <CampusLogo campus={current.code} />
        <span className='min-w-0 flex-1'>
          <span className='block truncate text-sm font-medium'>{current.name}</span>
          <span className='text-muted-foreground block truncate text-xs'>{current.detail}</span>
        </span>
        <Icons.chevronsUpDown className='text-muted-foreground size-4' />
      </PopoverTrigger>
      <PopoverContent align='start' className='w-[min(360px,calc(100vw-1rem))] p-1'>
        <Command>
          <CommandInput placeholder='搜索高校' />
          <CommandList>
            <CommandEmpty>暂未找到匹配高校</CommandEmpty>
            <CommandGroup heading='当前可绑定'>
              {CAMPUS_DEFINITIONS.filter((campus) => campus.status === 'connected').map(
                (campus) => (
                  <CampusCommandItem
                    key={campus.code}
                    campus={campus.code}
                    selected={campus.code === value}
                    onSelect={() => {
                      onValueChange(campus.code);
                      setOpen(false);
                    }}
                  />
                )
              )}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading='正在接入'>
              {CAMPUS_DEFINITIONS.filter((campus) => campus.status === 'preview').map(
                (campus) => (
                  <CampusCommandItem key={campus.code} campus={campus.code} disabled />
                )
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function CampusCommandItem({
  campus,
  selected = false,
  disabled = false,
  onSelect
}: {
  campus: CampusCode;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}) {
  const definition = getCampusDefinition(campus);
  return (
    <CommandItem
      value={[definition.name, ...definition.aliases].join(' ')}
      disabled={disabled}
      onSelect={onSelect}
      className='items-start gap-3 px-2.5 py-2.5'
    >
      <CampusLogo campus={campus} className='mt-0.5 size-8' />
      <span className='min-w-0 flex-1'>
        <span className='flex items-center gap-2'>
          <span className='truncate font-medium'>{definition.name}</span>
          <span className='text-muted-foreground shrink-0 text-[11px]'>{definition.statusLabel}</span>
        </span>
        <span className='text-muted-foreground mt-0.5 block truncate text-xs'>
          {definition.detail} · {definition.services.join('、')}
        </span>
      </span>
      {selected && <Icons.check className='text-primary mt-1 size-4' />}
    </CommandItem>
  );
}

export function CampusSwitcher() {
  const { activeCampus, setActiveCampus } = useCampusWorkspace();
  const [open, setOpen] = useState(false);
  const current = activeCampus === 'all' ? null : getCampusDefinition(activeCampus);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<SidebarMenuButton size='lg' tooltip='切换高校工作区' />}
        aria-label='切换高校工作区'
      >
        {current ? (
          <CampusLogo campus={current.code} />
        ) : (
          <span className='bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md'>
            <Icons.globe className='size-4' />
          </span>
        )}
        <span className='grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden'>
          <span className='truncate font-medium'>{current?.name || '全部高校'}</span>
          <span className='text-muted-foreground truncate text-xs'>
            {current?.detail || '跨高校总览模式'}
          </span>
        </span>
        <Icons.chevronsUpDown className='text-muted-foreground ml-auto size-4 group-data-[collapsible=icon]:hidden' />
      </PopoverTrigger>
      <PopoverContent align='start' side='right' className='w-[min(360px,calc(100vw-1rem))] p-1'>
        <Command>
          <CommandInput placeholder='搜索高校或校区' />
          <CommandList>
            <CommandEmpty>暂未找到匹配高校</CommandEmpty>
            <CommandGroup heading='浏览范围'>
              <CommandItem
                value='全部高校 跨高校总览'
                onSelect={() => {
                  setActiveCampus('all');
                  setOpen(false);
                }}
                className='items-start gap-3 px-2.5 py-2.5'
              >
                <span className='bg-muted text-muted-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md'>
                  <Icons.globe className='size-4' />
                </span>
                <span className='min-w-0 flex-1'>
                  <span className='block font-medium'>全部高校</span>
                  <span className='text-muted-foreground mt-0.5 block text-xs'>仅用于总览和跨高校记录</span>
                </span>
                {activeCampus === 'all' && <Icons.check className='text-primary mt-1 size-4' />}
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading='高校工作区'>
              {CAMPUS_DEFINITIONS.map((campus) => (
                <CommandItem
                  key={campus.code}
                  value={[campus.name, ...campus.aliases].join(' ')}
                  onSelect={() => {
                    setActiveCampus(campus.code);
                    setOpen(false);
                  }}
                  className='items-start gap-3 px-2.5 py-2.5'
                >
                  <CampusLogo campus={campus.code} className='mt-0.5' />
                  <span className='min-w-0 flex-1'>
                    <span className='flex items-center gap-2'>
                      <span className='truncate font-medium'>{campus.name}</span>
                      <span className='text-muted-foreground shrink-0 text-[11px]'>{campus.statusLabel}</span>
                    </span>
                    <span className='text-muted-foreground mt-0.5 block truncate text-xs'>
                      {campus.detail} · {campus.services.join('、')}
                    </span>
                  </span>
                  {activeCampus === campus.code && <Icons.check className='text-primary mt-1 size-4' />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function getCampusScopeLabel(scope: CampusScope): string {
  return scope === 'all' ? '全部高校' : getCampusDefinition(scope).name;
}
