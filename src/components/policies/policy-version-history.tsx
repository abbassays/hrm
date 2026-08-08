'use client';

import { format } from 'date-fns';
import { CheckCircle2, CircleDashed, Eye, History } from 'lucide-react';
import { useEffect, useState } from 'react';

import { EmployeeAvatar } from '@/components/hrm/employee-avatar';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { PolicyContent } from './policy-content';

import {
  EmployeeListItem,
  Policy,
  PolicyAcknowledgment,
  PolicyVersion,
} from '@/types/hrm';

type PolicyVersionHistoryProps = {
  /** Only the title is needed — it heads the preview dialog. */
  policy: Pick<Policy, 'title'>;
  versions: PolicyVersion[];
  currentVersionNumber: number;
  /** Active employees — acknowledgment status inside each version panel is
   *  reported against these. */
  employees: EmployeeListItem[];
  /** Append-only acknowledgment history for this policy: one record per
   *  version each employee acknowledged. */
  acknowledgments: PolicyAcknowledgment[];
  /** Omit to hide the revert action (e.g. read-only contexts). */
  onRevert?: (version: PolicyVersion) => void;
};

export function PolicyVersionHistory({
  policy,
  versions,
  currentVersionNumber,
  employees,
  acknowledgments,
  onRevert,
}: PolicyVersionHistoryProps) {
  const newestFirst = [...versions].reverse();
  const [openVersion, setOpenVersion] = useState(`v${currentVersionNumber}`);
  /** The version currently open in the preview dialog, if any. Policy bodies
   *  are sanitized HTML in the database, so any version renders in-app through
   *  the same component employees read — no file, no new tab. */
  const [previewVersion, setPreviewVersion] = useState<PolicyVersion | null>(
    null,
  );

  // `defaultValue` is read only once. Move to the newly active version after a
  // publish so its acknowledgment roster is visible without another click.
  useEffect(() => {
    setOpenVersion(`v${currentVersionNumber}`);
  }, [currentVersionNumber]);

  // Matched on the version *id*: a version number is only unique within a
  // policy, and these acknowledgments arrive pre-filtered to one.
  const ackFor = (employeeId: string, versionId: string) =>
    acknowledgments.find(
      (ack) =>
        ack.employeeId === employeeId && ack.policyVersionId === versionId,
    );
  const latestFor = (employeeId: string) =>
    acknowledgments
      .filter((ack) => ack.employeeId === employeeId)
      .reduce<
        PolicyAcknowledgment | undefined
      >((best, ack) => (!best || ack.acknowledgedVersion > best.acknowledgedVersion ? ack : best), undefined);

  return (
    <>
      <Dialog
        open={!!previewVersion}
        onOpenChange={(next) => !next && setPreviewVersion(null)}
      >
        <DialogContent className='max-h-[85vh] max-w-3xl overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>
              {policy.title} · Version {previewVersion?.version}
            </DialogTitle>
            <DialogDescription>
              {previewVersion &&
                `Published ${format(previewVersion.publishedAt, 'MMM d, yyyy')}`}
              {previewVersion?.version === currentVersionNumber
                ? ' · Active version'
                : ' · Superseded — kept for audit'}
            </DialogDescription>
          </DialogHeader>
          {previewVersion && (
            <PolicyContent html={previewVersion.contentHtml} />
          )}
        </DialogContent>
      </Dialog>

      <Accordion
        type='single'
        collapsible
        value={openVersion}
        onValueChange={setOpenVersion}
        className='rounded-lg border border-border'
      >
        {newestFirst.map((version) => {
          const isCurrent = version.version === currentVersionNumber;
          const ackedEmployees = employees.filter(
            (employee) => !!ackFor(employee.id, version.id),
          );

          return (
            <AccordionItem
              key={version.version}
              value={`v${version.version}`}
              className='px-4 last:border-b-0'
            >
              <div className='relative'>
                <AccordionTrigger className='pr-24 hover:no-underline'>
                  <span className='flex flex-1 items-center justify-between gap-3 pr-3'>
                    <span className='flex items-center gap-2 text-sm font-medium'>
                      Version {version.version}
                      {isCurrent && (
                        <Badge variant='secondary' className='font-normal'>
                          Active
                        </Badge>
                      )}
                    </span>
                    <span className='text-xs font-normal text-muted-foreground'>
                      {format(version.publishedAt, 'MMM d, yyyy')} ·{' '}
                      {isCurrent
                        ? `${ackedEmployees.length} of ${employees.length} acknowledged`
                        : `${ackedEmployees.length} acknowledged`}
                    </span>
                  </span>
                </AccordionTrigger>
                <div className='absolute right-0 top-1/2 flex -translate-y-1/2 items-center gap-2'>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type='button'
                        variant='outline'
                        size='icon'
                        className='size-7'
                        onClick={() => setPreviewVersion(version)}
                        aria-label={`Preview version ${version.version}`}
                      >
                        <Eye className='size-3.5' />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Preview this version</TooltipContent>
                  </Tooltip>
                  {!isCurrent && !!onRevert && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type='button'
                          variant='outline'
                          size='icon'
                          className='size-7'
                          onClick={() => onRevert(version)}
                          aria-label={`Revert to version ${version.version}`}
                        >
                          <History className='size-3.5' />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Revert to this version</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
              <AccordionContent>
                <ul className='divide-y divide-border overflow-hidden rounded-md border border-border'>
                  {employees.map((employee) => {
                    const ackOfThis = ackFor(employee.id, version.id);
                    const latest = latestFor(employee.id);

                    return (
                      <li
                        key={employee.id}
                        className='flex items-center justify-between gap-3 bg-muted/30 px-3 py-2.5'
                      >
                        <span className='flex items-center gap-2.5'>
                          <EmployeeAvatar
                            employeeId={employee.id}
                            fullName={employee.fullName}
                          />
                          <span className='text-sm font-medium'>
                            {employee.fullName}
                          </span>
                        </span>
                        {ackOfThis ? (
                          <span className='flex items-center gap-1.5 text-xs text-muted-foreground'>
                            <CheckCircle2
                              className='size-4 text-primary'
                              aria-hidden
                            />
                            Acknowledged{' '}
                            {format(ackOfThis.acknowledgedAt, 'MMM d, yyyy')}
                          </span>
                        ) : (
                          <span className='flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400'>
                            <CircleDashed className='size-4' aria-hidden />
                            {latest
                              ? `Behind (on v${latest.acknowledgedVersion})`
                              : 'Not acknowledged'}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </>
  );
}
