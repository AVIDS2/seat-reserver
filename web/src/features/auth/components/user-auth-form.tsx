'use client';
import { LoadingButton } from '@/components/ui/loading-button';
import { FieldGroup } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signInPlatform, signUpPlatform } from '@/features/booking/api/service';
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
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    // Read FormData so browser password-manager/autofill values are submitted
    // even when they did not emit React change events during hydration.
    const formData = new FormData(event.currentTarget);
    const values = {
      email: String(formData.get('email') ?? '').trim(),
      password: String(formData.get('password') ?? ''),
      displayName: String(formData.get('displayName') ?? '').trim(),
      inviteCode: String(formData.get('inviteCode') ?? '').trim()
    };
    const parsed = (mode === 'sign-up' ? signUpSchema : signInSchema).safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || '请检查输入内容');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'sign-up') {
        const [firstName, ...lastNameParts] = parsed.data.displayName.trim().split(/\s+/);
        await signUpPlatform({
          email: parsed.data.email,
          password: parsed.data.password,
          firstName: firstName || '用户',
          lastName: lastNameParts.join('') || '同学',
          ...(parsed.data.inviteCode ? { inviteCode: parsed.data.inviteCode } : {})
        });
      } else {
        await signInPlatform(parsed.data.email, parsed.data.password);
      }
      toast.success(mode === 'sign-in' ? '登录成功' : '账号创建成功');
      // The dashboard is server-authenticated. A hard navigation makes the
      // freshly written HttpOnly cookie available to the Next server tree.
      window.location.assign('/dashboard/overview');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '操作失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form
        className='w-full space-y-2'
        onSubmit={handleSubmit}
        noValidate
        aria-busy={loading}
      >
        <FieldGroup>
          <div className='flex flex-col gap-2'>
            <Label htmlFor='email'>登录邮箱</Label>
            <Input
              id='email'
              name='email'
              type='email'
              placeholder='name@example.com'
              autoComplete='email'
              disabled={loading}
              onInput={() => setError(null)}
            />
          </div>
          <div className='flex flex-col gap-2'>
            <Label htmlFor='password'>登录密码</Label>
            <Input
              id='password'
              name='password'
              type='password'
              placeholder='至少 8 位'
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              disabled={loading}
              onInput={() => setError(null)}
            />
          </div>
          {mode === 'sign-up' && (
            <>
              <div className='flex flex-col gap-2'>
                <Label htmlFor='displayName'>你的称呼</Label>
                <Input id='displayName' name='displayName' placeholder='例如：张同学' disabled={loading} onInput={() => setError(null)} />
              </div>
              <div className='flex flex-col gap-2'>
                <Label htmlFor='inviteCode'>邀请码</Label>
                <Input id='inviteCode' name='inviteCode' placeholder='请输入邀请码' disabled={loading} onInput={() => setError(null)} />
              </div>
            </>
          )}
        </FieldGroup>
        {error && <p className='text-destructive text-sm' role='alert'>{error}</p>}
        <LoadingButton loading={loading} type='submit' className='mt-2 ml-auto w-full'>
          {mode === 'sign-in' ? '进入控制台' : '创建账号'}
        </LoadingButton>
      </form>
    </>
  );
}
