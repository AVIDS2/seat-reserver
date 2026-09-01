'use client';
import { LoadingButton } from '@/components/ui/loading-button';
import { FieldGroup } from '@/components/ui/field';
import { useAppForm } from '@/lib/form';
import { signInPlatform, signUpPlatform } from '@/features/booking/api/service';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import * as z from 'zod';

const signInSchema = z.object({
  email: z.string().email({ message: '请输入有效的邮箱地址' }),
  password: z.string().min(8, { message: '密码至少需要 8 位' }),
  displayName: z.string(),
  inviteCode: z.string()
});

const signUpSchema = signInSchema.extend({
  displayName: z.string().min(2, { message: '请输入你的称呼' })
});

export default function UserAuthForm({ mode = 'sign-in' }: { mode?: 'sign-in' | 'sign-up' }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const form = useAppForm({
    defaultValues: {
      email: '',
      password: '',
      displayName: '',
      inviteCode: ''
    },
    validators: {
      onSubmit: mode === 'sign-up' ? signUpSchema : signInSchema
    },
    onSubmit: async ({ value }) => {
      setLoading(true);
      try {
        if (mode === 'sign-up') {
          const [firstName, ...lastNameParts] = value.displayName.trim().split(/\s+/);
          await signUpPlatform({
            email: value.email,
            password: value.password,
            firstName: firstName || '用户',
            lastName: lastNameParts.join('') || '同学',
            ...(value.inviteCode ? { inviteCode: value.inviteCode } : {})
          });
        } else {
          await signInPlatform(value.email, value.password);
        }
        toast.success(mode === 'sign-in' ? '登录成功' : '账号创建成功');
        router.push('/dashboard/overview');
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '操作失败，请稍后再试');
      } finally {
        setLoading(false);
      }
    }
  });

  return (
    <>
      <form
        className='w-full space-y-2'
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <FieldGroup>
          <form.AppField
            name='email'
            children={(field) => (
              <field.TextField
                label='平台邮箱'
                type='email'
                placeholder='name@example.com'
                disabled={loading}
              />
            )}
          />
          <form.AppField
            name='password'
            children={(field) => (
              <field.TextField
                label='平台登录密码'
                type='password'
                placeholder='至少 8 位'
                disabled={loading}
              />
            )}
          />
          {mode === 'sign-up' && (
            <>
              <form.AppField
                name='displayName'
                children={(field) => (
                  <field.TextField label='你的称呼' placeholder='例如：张同学' disabled={loading} />
                )}
              />
              <form.AppField
                name='inviteCode'
                children={(field) => (
                  <field.TextField label='邀请码（首个账号可留空）' placeholder='管理员提供的邀请码' disabled={loading} />
                )}
              />
              <p className='text-muted-foreground text-xs leading-5'>
                这里填写的是本平台的登录信息。学校学号和密码请在登录后进入“账号与授权”绑定。
              </p>
            </>
          )}
        </FieldGroup>
        <LoadingButton loading={loading} type='submit' className='mt-2 ml-auto w-full'>
          {mode === 'sign-in' ? '进入控制台' : '创建账号'}
        </LoadingButton>
      </form>
    </>
  );
}
