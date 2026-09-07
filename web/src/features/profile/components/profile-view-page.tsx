'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Badge } from '@/components/ui/badge';
import { usePlatformSession, useSetPlatformSession } from '@/features/auth/platform-session';
import { uploadPlatformAvatar, updatePlatformProfile } from '@/features/booking/api/service';
import { avatarPresetClass, avatarPresets, getAvatarPreset, setAvatarPreset, type AvatarPresetId } from '@/components/avatar-presets';

export default function ProfileViewPage() {
  const user = usePlatformSession();
  const setUser = useSetPlatformSession();
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [password, setPassword] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarPreset, setCurrentAvatarPreset] = useState<AvatarPresetId>('aurora');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCurrentAvatarPreset(getAvatarPreset());
  }, []);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      const updatedUser = await updatePlatformProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        ...(password ? { password, oldPassword } : {})
      });
      setUser(updatedUser);
      setPassword('');
      setOldPassword('');
      toast.success('个人资料已更新');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新个人资料失败');
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('头像不能超过 5 MB');
      return;
    }
    setUploading(true);
    try {
      const updatedUser = await uploadPlatformAvatar(file);
      setUser(updatedUser);
      toast.success('头像已更新');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '头像上传失败');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const choosePreset = (preset: AvatarPresetId) => {
    setAvatarPreset(preset);
    setCurrentAvatarPreset(preset);
    toast.success('头像气泡已更新');
  };

  return (
    <PageContainer pageTitle='个人设置' pageDescription='管理平台账户显示信息与登录密码。'>
      <div className='mx-auto flex w-full max-w-[760px] flex-col gap-4'>
        <Alert>
          <Icons.shield />
          <AlertTitle>平台账号</AlertTitle>
          <AlertDescription>
            邮箱用于登录和找回账号；学校账号密码在“账号与授权”页面单独管理。
          </AlertDescription>
        </Alert>
        <Card className='shadow-none'>
          <CardHeader className='border-b'>
            <div className='flex items-center gap-4'>
              <HoverCard>
                <HoverCardTrigger
                  render={
                    <button
                      type='button'
                      className='rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                      aria-label='预览头像状态'
                    />
                  }
                >
                  <Avatar size='lg'>
                    <AvatarImage src={user?.avatarUrl || ''} alt={user?.displayName || '头像'} />
                    <AvatarFallback className={avatarPresetClass(avatarPreset)}>
                      {user?.displayName?.slice(0, 2)?.toUpperCase() || 'CN'}
                    </AvatarFallback>
                    <AvatarBadge className='bg-emerald-500' aria-label='在线' />
                  </Avatar>
                </HoverCardTrigger>
                <HoverCardContent className='w-72'>
                  <div className='flex items-start gap-3'>
                    <Avatar>
                      <AvatarImage src={user?.avatarUrl || ''} alt='' />
                      <AvatarFallback className={avatarPresetClass(avatarPreset)}>{user?.displayName?.slice(0, 2)?.toUpperCase() || 'CN'}</AvatarFallback>
                    </Avatar>
                    <div className='min-w-0'>
                      <p className='truncate font-medium'>{user?.displayName || '平台用户'}</p>
                      <p className='text-muted-foreground truncate text-xs'>{user?.email}</p>
                      <Badge variant='outline' className='mt-2'><span className='mr-1 size-1.5 rounded-full bg-emerald-500' />在线</Badge>
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
              <div className='min-w-0'>
                <CardTitle>头像与气泡</CardTitle>
                <CardDescription className='mt-1'>上传头像，或选择一个只属于你的状态色。</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className='flex flex-col gap-4 pt-5'>
            <div className='flex flex-wrap items-center gap-2'>
              <Button type='button' variant='outline' onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                <Icons.upload data-icon='inline-start' />
                {uploading ? '上传中' : '上传头像'}
              </Button>
              <input ref={fileInputRef} type='file' accept='image/*' aria-label='选择头像图片' className='sr-only' onChange={(event) => void uploadAvatar(event.target.files?.[0])} />
              <span className='text-muted-foreground text-xs'>支持 JPG、PNG，最大 5 MB</span>
            </div>
            <div>
              <p className='mb-2 text-sm font-medium'>气泡颜色</p>
              <div className='flex flex-wrap gap-2'>
                {avatarPresets.map((preset) => (
                  <Button
                    key={preset.id}
                    type='button'
                    variant='outline'
                    size='sm'
                    className='gap-2'
                    onClick={() => choosePreset(preset.id)}
                    aria-pressed={avatarPreset === preset.id}
                  >
                    <span className={`size-3 rounded-full ${preset.className}`} aria-hidden='true' />
                    {preset.label}
                    {avatarPreset === preset.id && <Icons.check className='size-3.5' />}
                  </Button>
                ))}
              </div>
              <p className='text-muted-foreground mt-2 text-xs'>气泡风格保存在本设备；上传的头像会保存到平台账号。</p>
            </div>
          </CardContent>
        </Card>

        <Card className='shadow-none'>
          <CardHeader className='border-b'>
            <CardTitle>基本信息</CardTitle>
            <CardDescription>{user?.email || '当前登录账号'}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className='flex flex-col gap-5'>
              <FieldGroup className='grid gap-4 sm:grid-cols-2'>
                <Field>
                  <FieldLabel htmlFor='profile-first-name'>名</FieldLabel>
                  <Input
                    id='profile-first-name'
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor='profile-last-name'>称呼</FieldLabel>
                  <Input
                    id='profile-last-name'
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    required
                  />
                </Field>
              </FieldGroup>
              <Separator />
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor='profile-old-password'>当前密码</FieldLabel>
                  <Input
                    id='profile-old-password'
                    type='password'
                    value={oldPassword}
                    onChange={(event) => setOldPassword(event.target.value)}
                    placeholder='修改密码时填写'
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor='profile-password'>新密码</FieldLabel>
                  <Input
                    id='profile-password'
                    type='password'
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder='至少 8 位'
                    minLength={8}
                  />
                  <FieldDescription>修改密码后，其他登录设备会被退出。</FieldDescription>
                </Field>
              </FieldGroup>
              <div className='flex justify-end'>
                <Button type='submit' disabled={saving}>
                  {saving ? '保存中' : '保存修改'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
