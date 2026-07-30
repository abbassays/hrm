'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  useSaveBank,
  useSavePersonal,
  useSaveSocials,
  useSubmitOnboarding,
} from '@/hooks/actions/onboarding';
import { useOnboardingData } from '@/hooks/queries/onboarding';
import { useUser } from '@/hooks/queries/user';

import { PageHeader } from '@/components/hrm/page-header';
import { StepIndicator } from '@/components/hrm/step-indicator';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import { onboardingSteps } from '@/constants/onboarding';
import { paths } from '@/constants/paths';
import {
  type BankInfoInput,
  type PersonalInfoInput,
  type SocialAccountsInput,
} from '@/schema/onboarding';

import { BankInfoStep } from './bank-info-step';
import { ConsentStep } from './consent-step';
import { DocumentsStep } from './documents-step';
import { PersonalInfoStep } from './personal-info-step';
import { SocialAccountsStep } from './social-accounts-step';

/** A section advances only if its autosave succeeded — a server/validation
 *  error keeps the user on the current step (the toast explains why). */
const succeeded = (result?: {
  serverError?: string;
  validationErrors?: unknown;
}) => !!result && !result.serverError && !result.validationErrors;

export function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const router = useRouter();

  const { data: user } = useUser();
  const { data: onboarding, isLoading } = useOnboardingData();

  const savePersonal = useSavePersonal();
  const saveBank = useSaveBank();
  const saveSocials = useSaveSocials();
  const submit = useSubmitOnboarding();

  // Gate the wizard on loaded values so each step mounts with its restored
  // defaults already in place.
  if (isLoading || !onboarding || !user) {
    return (
      <div className='flex flex-col gap-6'>
        <Skeleton className='h-8 w-full max-w-lg rounded-lg' />
        <Skeleton className='h-96 w-full max-w-3xl rounded-xl' />
      </div>
    );
  }

  const handlePersonal = async (values: PersonalInfoInput) => {
    if (succeeded(await savePersonal.executeAsync(values))) setStep(1);
  };
  const handleBank = async (values: BankInfoInput) => {
    if (succeeded(await saveBank.executeAsync(values))) setStep(2);
  };
  const handleSocials = async (values: SocialAccountsInput) => {
    if (succeeded(await saveSocials.executeAsync(values))) setStep(3);
  };
  const handleSubmit = async () => {
    if (succeeded(await submit.executeAsync({ consent: true }))) {
      // The RPC activates the employee and mirrors that state into auth
      // metadata. Refresh before routing so middleware sees the new access.
      await createSupabaseBrowserClient().auth.refreshSession();
      router.replace(paths.employee.dashboard);
      router.refresh();
    }
  };

  return (
    <div className='flex flex-col gap-6'>
      <PageHeader
        title='Onboarding'
        description='Complete the five sections below to activate your account.'
      />
      <StepIndicator steps={[...onboardingSteps]} currentStep={step} />
      <Card>
        <CardContent className='p-6'>
          {step === 0 && (
            <PersonalInfoStep
              email={onboarding.email}
              defaultValues={onboarding.personal}
              onNext={handlePersonal}
            />
          )}
          {step === 1 && (
            <BankInfoStep
              defaultValues={onboarding.bank}
              onNext={handleBank}
              onBack={() => setStep(0)}
            />
          )}
          {step === 2 && (
            <SocialAccountsStep
              defaultValues={onboarding.social}
              onNext={handleSocials}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <DocumentsStep
              userId={user.id}
              onNext={() => setStep(4)}
              onBack={() => setStep(2)}
            />
          )}
          {step === 4 && (
            <ConsentStep onSubmit={handleSubmit} onBack={() => setStep(3)} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
