'use client';

import { UserX } from 'lucide-react';

import { useMyProfile } from '@/hooks/queries/self-profile';

import { EmployeeDocuments } from '@/components/employees/employee-documents';
import { EmptyState } from '@/components/hrm/empty-state';
import { InfoCard } from '@/components/hrm/info-card';
import { PageHeader } from '@/components/hrm/page-header';
import { StatusBadge } from '@/components/hrm/status-badge';
import { BankInfoDialog } from '@/components/profile/bank-info-dialog';
import { ContactInfoDialog } from '@/components/profile/contact-info-dialog';
import { EmploymentReadonly } from '@/components/profile/employment-readonly';
import { PersonalInfoDialog } from '@/components/profile/personal-info-dialog';
import { ProfilePhotoCard } from '@/components/profile/profile-photo-card';
import { SocialsInfoDialog } from '@/components/profile/socials-info-dialog';
import { Skeleton } from '@/components/ui/skeleton';

import { formatDate } from '@/utils/date-functions';

import { employmentTypeLabels } from '@/constants/hrm-labels';

type ProfileViewProps = {
  /** Employment (salary/designation/type) is admin-owned and only meaningful
   *  for employees. Admins have no employment record, so their own profile
   *  hides that section and uses a role-neutral header. Defaults to the full
   *  employee view. */
  showEmployment?: boolean;
  /** Personal identity fields (name / DOB / CNIC) are admin-managed, so an
   *  employee's own profile shows them read-only. Admins have no admin above
   *  them, so their profile enables self-editing. Defaults to read-only. */
  canEditPersonal?: boolean;
  /** Identity documents are collected during onboarding, which admins never go
   *  through — so their profile omits the documents card. Defaults to shown. */
  showDocuments?: boolean;
};

/** Self-service profile: the signed-in user views their own data and edits
 *  contact, bank, and socials. Employment stays read-only (admin-owned), and
 *  personal identity fields are editable only for admins (see props). */
export function ProfileView({
  showEmployment = true,
  canEditPersonal = false,
  showDocuments = true,
}: ProfileViewProps) {
  const { data: employee, isLoading } = useMyProfile();

  if (isLoading) {
    return (
      <div className='flex flex-col gap-6'>
        <Skeleton className='h-16 w-full max-w-md rounded-xl' />
        <Skeleton className='h-56 w-full rounded-xl' />
        <Skeleton className='h-56 w-full rounded-xl' />
      </div>
    );
  }

  if (!employee) {
    return (
      <EmptyState
        icon={UserX}
        title='Profile unavailable'
        description="We couldn't load your profile right now. Please refresh the page or try again shortly."
      />
    );
  }

  return (
    <>
      <PageHeader
        title='My Profile'
        description={
          showEmployment
            ? `${employee.designation || 'No designation yet'} · ${employmentTypeLabels[employee.employmentType]}`
            : employee.email
        }
      >
        <StatusBadge status={employee.status} />
      </PageHeader>

      {showDocuments && (
        <ProfilePhotoCard
          employeeId={employee.id}
          fullName={employee.fullName || employee.email}
        />
      )}

      <InfoCard
        title='Contact Information'
        action={
          <ContactInfoDialog
            defaultValues={{
              phone: employee.phone,
              emergencyContact: employee.emergencyContact,
              address: employee.address,
              city: employee.city,
              postalCode: employee.postalCode,
            }}
          />
        }
        fields={[
          { label: 'Email', value: employee.email },
          { label: 'Phone', value: employee.phone },
          { label: 'Emergency contact', value: employee.emergencyContact },
          { label: 'Address', value: employee.address },
          { label: 'City', value: employee.city },
          { label: 'Postal code', value: employee.postalCode },
        ]}
      />

      <InfoCard
        title='Personal Information'
        action={
          canEditPersonal ? (
            <PersonalInfoDialog
              defaultValues={{
                fullName: employee.fullName,
                dateOfBirth: employee.dateOfBirth,
                cnic: employee.cnic,
              }}
            />
          ) : undefined
        }
        fields={[
          { label: 'Full name', value: employee.fullName },
          { label: 'Date of birth', value: formatDate(employee.dateOfBirth) },
          { label: 'CNIC', value: employee.cnic },
          { label: 'Joined', value: formatDate(employee.joinedAt) },
        ]}
      />

      <InfoCard
        title='Bank Information'
        action={
          <BankInfoDialog
            defaultValues={{
              bankName: employee.bank?.bankName ?? '',
              accountHolderName: employee.bank?.accountHolderName ?? '',
              accountNumber: employee.bank?.accountNumber ?? '',
              iban: employee.bank?.iban ?? '',
              branch: employee.bank?.branch ?? '',
            }}
          />
        }
        fields={[
          { label: 'Bank', value: employee.bank?.bankName },
          { label: 'Account holder', value: employee.bank?.accountHolderName },
          { label: 'Account number', value: employee.bank?.accountNumber },
          { label: 'IBAN', value: employee.bank?.iban },
          { label: 'Branch', value: employee.bank?.branch },
        ]}
      />

      <InfoCard
        title='Social Accounts'
        action={
          <SocialsInfoDialog
            defaultValues={{
              github: employee.social?.github ?? '',
              linkedin: employee.social?.linkedin ?? '',
              twitter: employee.social?.twitter ?? '',
            }}
          />
        }
        fields={[
          { label: 'GitHub', value: employee.social?.github },
          { label: 'LinkedIn', value: employee.social?.linkedin },
          { label: 'Twitter', value: employee.social?.twitter },
        ]}
      />

      {showDocuments && <EmployeeDocuments employeeId={employee.id} />}

      {showEmployment && <EmploymentReadonly employee={employee} />}
    </>
  );
}
