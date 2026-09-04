'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { usePlatformSession, useSetPlatformSession } from '@/features/auth/platform-session';
import { updatePlatformProfile } from '@/features/booking/api/service';

export default function ProfileViewPage() {
  const user = usePlatformSession();
  const setUser = useSetPlatformSession();
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [password, setPassword] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [saving, setSaving] = useState(false);

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
