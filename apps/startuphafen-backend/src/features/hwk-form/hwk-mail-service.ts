import { TransactionFactory } from '@startuphafen/serialized-transaction';
import {
  Answers,
  HwkMailStatus,
  Project,
  ShUser,
} from '@startuphafen/startuphafen-common';
import { ServerConfig } from '../../config';
import { FeatureFlagDbController } from '../common/feature-flag-db-controller';
import { MailClient } from '../common/mail';
import { hasCompletedQuestionnaire } from '../common/questionnaire-completion';
import { UserDocumentDbController } from '../user-documents/user-document-db-controller';
import { buildHwkFormData } from './hwk-form-builder';
import { HwkFormDbController } from './hwk-form-db-controller';
import { HwkFormPdfService } from './hwk-form-pdf-service';
import { HwkMailDbController, HwkMailLogRow } from './hwk-mail-db-controller';

const HWK_ANSWER_KEYS = [
  'HwkEntryType',
  'HwkTrade',
  'HwkQualificationDate',
  'HwkQualificationPlace',
  'HwkQualificationTrade',
  'HwkQualificationTrainingPermit',
  'HwkPriorBusiness',
  'HwkPriorBusinessDetails',
];

const BACKOFF_DELAYS_MS = [
  30_000, 60_000, 120_000, 300_000, 600_000, 1_200_000, 2_400_000, 3_600_000,
];
const HWK_MAIL_METADATA_ANSWER_KEYS = [
  'HwkAi',
  'HwkAiDescription',
  'HwkAiAutofillSnapshot',
];

const STALE_SENDING_TIMEOUT_MS = 15 * 60_000;
const KAPG_HR_EXTRACT_REQUIRED_ERROR =
  'Für den HWK-Antrag bei Kapitalgesellschaften muss ein Handelsregisterauszug hochgeladen werden.';

type HwkAiMailDetails = {
  activityDescription: string | null;
  classification: string | null;
  branch: string | null;
  requiresPermit: boolean | null;
  trades: string[];
  reasoning: string | null;
};

const getBackoffDelayMs = (attemptCount: number) => {
  if (attemptCount <= 0) return BACKOFF_DELAYS_MS[0];
  const index = Math.min(attemptCount - 1, BACKOFF_DELAYS_MS.length - 1);
  return BACKOFF_DELAYS_MS[index];
};

export class HwkMailService {
  private pdfService = new HwkFormPdfService();

  constructor(
    private config: ServerConfig,
    private trxFactory: TransactionFactory
  ) {}

  async queueAndSend(
    projectId: number,
    userId: string
  ): Promise<HwkMailStatus> {
    if (this.isHwkDeliveryDisabled()) {
      return {
        status: 'sent',
        attemptCount: 0,
        lastError: null,
        nextAttemptAt: null,
        sentAt: new Date(),
      };
    }

    const prep = await this.trxFactory(async (trx) => {
      const hwkFormDbController = new HwkFormDbController(trx);
      const hwkMailDbController = new HwkMailDbController(trx);

      const project = await hwkFormDbController.getProjectById(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const user = await hwkFormDbController.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const answers = await hwkFormDbController.getAnswersByProjectId(
        projectId
      );
      const tracking = await hwkFormDbController.getQuestionTrackingByProjectId(
        projectId
      );
      const relevantAnswers = this.filterAnswersByTracking(
        answers,
        tracking?.answeredQuestions
      );
      const userDocumentDbController = new UserDocumentDbController(trx);
      const existing = await hwkMailDbController.getByProjectId(projectId);
      const hrExtractStats = await userDocumentDbController.getCaseStats(
        userId,
        projectId,
        'hwk_hr_extract'
      );
      const eligibilityBlocker = this.getEligibilityBlocker(
        project,
        relevantAnswers,
        tracking?.answeredQuestions,
        hrExtractStats.count
      );

      if (existing?.status === 'sent') {
        return {
          eligible: true,
          log: existing,
        };
      }

      if (existing?.status === 'sending') {
        return {
          eligible: true,
          log: existing,
        };
      }

      if (eligibilityBlocker) {
        return {
          eligible: false,
          status: this.buildFailedStatus(eligibilityBlocker),
          log: existing ?? null,
        };
      }

      const userEmail = this.getUserEmail(user);
      const recipients = this.buildRecipients(userEmail);
      const template = this.buildTemplate(
        project,
        user,
        userEmail,
        relevantAnswers
      );
      const now = new Date();

      const log = await hwkMailDbController.upsertPendingByProjectId({
        projectId: project.id,
        userId: user.id,
        recipient: recipients.to,
        cc: recipients.cc,
        replyTo: recipients.replyTo,
        subject: template.subject,
        now,
      });

      return {
        eligible: true,
        log,
      };
    });

    if (!prep.eligible) {
      if (prep.status) {
        return prep.status;
      }
      if (prep.log) {
        return this.mapStatus(prep.log);
      }
      return this.notApplicableStatus();
    }

    if (!prep.log) {
      return this.notApplicableStatus();
    }

    const log = prep.log;

    if (log.status === 'sent' || log.status === 'sending') {
      return this.mapStatus(log);
    }

    return await this.attemptSend(log.id);
  }

  async getStatus(projectId: number, _userId: string): Promise<HwkMailStatus> {
    return await this.trxFactory(async (trx) => {
      const hwkMailDbController = new HwkMailDbController(trx);
      const log = await hwkMailDbController.getByProjectId(projectId);
      if (log) {
        return this.mapStatus(log);
      }

      const hwkFormDbController = new HwkFormDbController(trx);
      const project = await hwkFormDbController.getProjectById(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const answers = await hwkFormDbController.getAnswersByProjectId(
        projectId
      );
      const tracking = await hwkFormDbController.getQuestionTrackingByProjectId(
        projectId
      );
      const relevantAnswers = this.filterAnswersByTracking(
        answers,
        tracking?.answeredQuestions
      );
      const userDocumentDbController = new UserDocumentDbController(trx);
      const hrExtractStats = await userDocumentDbController.getCaseStats(
        project.userId,
        projectId,
        'hwk_hr_extract'
      );
      const eligibilityBlocker = this.getEligibilityBlocker(
        project,
        relevantAnswers,
        tracking?.answeredQuestions,
        hrExtractStats.count
      );
      if (eligibilityBlocker) {
        return this.notApplicableStatus();
      }

      return {
        status: 'pending',
        attemptCount: 0,
        lastError: null,
        nextAttemptAt: null,
        sentAt: null,
      } satisfies HwkMailStatus;
    });
  }

  async processDueLogs(batchSize = 10): Promise<void> {
    const isEnabled = await this.isHwkFeatureEnabled();
    if (!isEnabled || this.isHwkDeliveryDisabled()) {
      return;
    }

    const now = new Date();
    const staleBefore = new Date(now.getTime() - STALE_SENDING_TIMEOUT_MS);
    const dueLogs = await this.trxFactory(async (trx) => {
      const hwkMailDbController = new HwkMailDbController(trx);
      return hwkMailDbController.findDueLogs(now, staleBefore, batchSize);
    });

    for (const log of dueLogs) {
      await this.attemptSend(log.id);
    }
  }

  private async isHwkFeatureEnabled(): Promise<boolean> {
    return await this.trxFactory(async (trx) => {
      const featureFlagDbController = new FeatureFlagDbController(trx);
      const row = await featureFlagDbController.getByName('hwk');

      return row?.enabled ?? false;
    }, true);
  }

  private async attemptSend(logId: number): Promise<HwkMailStatus> {
    const claimed = await this.trxFactory(async (trx) => {
      const hwkMailDbController = new HwkMailDbController(trx);
      const existing = await hwkMailDbController.getById(logId);
      if (!existing) return null;

      const now = new Date();
      const staleBefore = new Date(now.getTime() - STALE_SENDING_TIMEOUT_MS);

      if (existing.status === 'sent') {
        return existing;
      }

      if (
        existing.status === 'sending' &&
        !this.isSendingStale(existing, now)
      ) {
        return existing;
      }

      if (existing.nextAttemptAt && existing.nextAttemptAt > now) {
        return existing;
      }

      const updated = await hwkMailDbController.claimForSending(
        logId,
        now,
        staleBefore
      );
      if (!updated) {
        return existing;
      }

      return updated;
    });

    if (!claimed) {
      return this.notApplicableStatus();
    }

    if (claimed.status !== 'sending') {
      return this.mapStatus(claimed);
    }

    try {
      const {
        project,
        user,
        profileInfo,
        relevantAnswers,
        hwkAttachments,
        answeredQuestions,
      } = await this.trxFactory(async (trx) => {
        const controller = new HwkFormDbController(trx);
        const userDocumentDbController = new UserDocumentDbController(trx);
        const project = await controller.getProjectById(claimed.projectId);
        if (!project) {
          throw new Error('Project not found');
        }
        const user = await controller.getUserById(claimed.userId);
        if (!user) {
          throw new Error('User not found');
        }
        const profileInfo = await controller.getProfileInfoByUserId(
          claimed.userId
        );
        const answers = await controller.getAnswersByProjectId(
          claimed.projectId
        );
        const tracking = await controller.getQuestionTrackingByProjectId(
          claimed.projectId
        );
        const relevantAnswers = this.filterAnswersByTracking(
          answers,
          tracking?.answeredQuestions
        );
        const hwkAttachments =
          await userDocumentDbController.listHwkMailAttachments(
            claimed.userId,
            claimed.projectId
          );

        return {
          project,
          user,
          profileInfo,
          relevantAnswers,
          hwkAttachments,
          answeredQuestions: tracking?.answeredQuestions,
        };
      });

      const activeHwkAttachments = this.filterActiveHwkAttachments(
        hwkAttachments,
        relevantAnswers,
        project
      );
      const eligibilityBlocker = this.getEligibilityBlocker(
        project,
        relevantAnswers,
        answeredQuestions,
        activeHwkAttachments.filter(
          (attachment) => attachment.documentCase === 'hwk_hr_extract'
        ).length
      );
      if (eligibilityBlocker) {
        return await this.failLog(claimed, eligibilityBlocker);
      }

      const mailClient = new MailClient(this.config.mail);
      const userEmail = this.getUserEmail(user);
      const template = this.buildTemplate(
        project,
        user,
        userEmail,
        relevantAnswers
      );
      const formData = buildHwkFormData({
        answers: relevantAnswers,
        project,
        user,
        profileInfo: profileInfo ?? null,
      });
      const pdfBytes = await this.pdfService.generateFilledPdf(formData);
      const generatedPdfAt = new Date();
      const filename = `HWK-Antrag-${project.id}.pdf`;

      console.info('HWK mail send attempt', {
        logId: claimed.id,
        projectId: claimed.projectId,
        userId: claimed.userId,
        attemptCount: claimed.attemptCount + 1,
        pdfCreatedAt: generatedPdfAt,
        attachmentCount: activeHwkAttachments.length + 1,
      });

      const mailResult = await mailClient.sendMail({
        to: claimed.recipient,
        cc: claimed.cc ?? undefined,
        replyTo: claimed.replyTo ?? undefined,
        subject: claimed.subject,
        content: {
          data: template.body,
          type: 'text',
        },
        attachments: [
          {
            filename,
            content: Buffer.from(pdfBytes),
          },
          ...activeHwkAttachments.map((attachment) => ({
            filename: attachment.filename,
            content: Buffer.from(attachment.data),
          })),
        ],
      });

      if (!mailResult.success) {
        console.warn('HWK mail send failed', {
          logId: claimed.id,
          projectId: claimed.projectId,
          userId: claimed.userId,
          attemptCount: claimed.attemptCount + 1,
          recipient: claimed.recipient,
          message: mailResult.message,
        });
        return await this.failLog(claimed, mailResult.message);
      }

      console.info('HWK mail sent', {
        logId: claimed.id,
        projectId: claimed.projectId,
        userId: claimed.userId,
        attemptCount: claimed.attemptCount + 1,
        recipient: claimed.recipient,
      });

      return await this.markSent(claimed, {
        mailBody: template.body,
        mailFrom: this.getMailFrom(),
        mailContentType: 'text',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown error';
      return await this.failLog(claimed, message);
    }
  }

  private async markSent(
    log: HwkMailLogRow,
    archive?: {
      mailBody: string;
      mailFrom: string | null;
      mailContentType: string;
    }
  ): Promise<HwkMailStatus> {
    const now = new Date();
    const attemptCount = log.attemptCount + 1;

    const updated = await this.trxFactory(async (trx) => {
      const hwkMailDbController = new HwkMailDbController(trx);
      const updatePayload: Partial<HwkMailLogRow> = {
        status: 'sent',
        lastError: null,
        attemptCount,
        lastAttemptAt: now,
        nextAttemptAt: null,
        sentAt: now,
        updatedAt: now,
      };

      if (archive) {
        updatePayload.mailBody = archive.mailBody;
        updatePayload.mailFrom = archive.mailFrom;
        updatePayload.mailContentType = archive.mailContentType;
      }

      return hwkMailDbController.updateById(log.id, updatePayload);
    });

    if (!updated) {
      return this.notApplicableStatus();
    }
    return this.mapStatus(updated);
  }

  private async failLog(
    log: HwkMailLogRow,
    errorMessage: string,
    stopRetries = false
  ): Promise<HwkMailStatus> {
    const now = new Date();
    const attemptCount = log.attemptCount + 1;
    const nextAttemptAt = stopRetries
      ? null
      : new Date(now.getTime() + getBackoffDelayMs(attemptCount));
    console.error(new Error('HWK mail send failed: ' + errorMessage));

    const updated = await this.trxFactory(async (trx) => {
      const hwkMailDbController = new HwkMailDbController(trx);
      return hwkMailDbController.updateById(log.id, {
        status: 'failed',
        lastError: errorMessage,
        attemptCount,
        lastAttemptAt: now,
        nextAttemptAt,
        updatedAt: now,
      });
    });

    if (!updated) {
      return this.notApplicableStatus();
    }
    return this.mapStatus(updated);
  }

  private isHwkDeliveryDisabled(): boolean {
    return this.config.mail.disableHwkDelivery;
  }

  private buildRecipients(userEmail: string | null) {
    return {
      to: this.config.mail.hwkRecipient,
      cc: userEmail,
      replyTo: userEmail,
    };
  }

  private buildTemplate(
    project: Project,
    user: ShUser,
    userEmail: string | null,
    answers: Answers[]
  ) {
    const projectName = project.name ?? 'Projekt';
    const subject = this.buildSubject(projectName, user.lastName ?? '');
    const aiDetails = this.getHwkAiMailDetails(answers);
    const lines = this.buildTemplateLines(
      project,
      projectName,
      user,
      userEmail,
      aiDetails
    );

    return {
      subject,
      body: lines.join('\n'),
    };
  }

  private buildSubject(projectName: string, lastName: string): string {
    const subjectParts = ['HWK-Antrag', projectName];
    if (lastName) {
      subjectParts.push(lastName);
    }
    return subjectParts.join(' - ');
  }

  private buildTemplateLines(
    project: Project,
    projectName: string,
    user: ShUser,
    userEmail: string | null,
    aiDetails: HwkAiMailDetails
  ): string[] {
    const lines: string[] = [];

    if (!this.isProd()) {
      lines.push('[TESTSYSTEM - KEINE ECHTE EINREICHUNG]');
    }

    lines.push(
      'Guten Tag,',
      '',
      `anbei der ausgefuellte HWK-Antrag fuer das Projekt "${projectName}".`,
      '',
      `Antragsteller: ${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
      `E-Mail: ${userEmail ?? user.email}`,
      `Projekt-ID: ${project.id}`
    );

    this.appendOptionalLine(
      lines,
      aiDetails.activityDescription,
      'Tätigkeitsbeschreibung'
    );
    this.appendAiClassificationLines(lines, aiDetails);
    this.appendOptionalLine(lines, aiDetails.reasoning, 'KI-Begründung');

    lines.push('', 'Mit freundlichen Gruessen', 'Startuphafen');
    return lines;
  }

  private appendOptionalLine(
    lines: string[],
    value: string | null,
    label: string
  ): void {
    if (!value) {
      return;
    }

    lines.push('', `${label}: ${value}`);
  }

  private appendAiClassificationLines(
    lines: string[],
    aiDetails: HwkAiMailDetails
  ): void {
    const hasClassificationDetails =
      aiDetails.classification ||
      aiDetails.branch ||
      aiDetails.requiresPermit != null ||
      aiDetails.trades.length > 0;

    if (!hasClassificationDetails) {
      return;
    }

    lines.push('', 'KI-Einordnung:');

    if (aiDetails.classification) {
      lines.push(`- Klassifikation: ${aiDetails.classification}`);
    }
    if (aiDetails.branch) {
      lines.push(`- Branche: ${aiDetails.branch}`);
    }
    if (aiDetails.requiresPermit != null) {
      lines.push(
        `- Erlaubnispflicht: ${aiDetails.requiresPermit ? 'Ja' : 'Nein'}`
      );
    }
    if (aiDetails.trades.length > 0) {
      lines.push(`- Gewerbe/Handwerk: ${aiDetails.trades.join(', ')}`);
    }
  }

  private getHwkAiMailDetails(answers: Answers[]): HwkAiMailDetails {
    return {
      activityDescription: this.getActivityDescription(answers),
      classification: this.getHwkAiStringField(answers, 'classification'),
      branch: this.getHwkAiStringField(answers, 'branch'),
      requiresPermit: this.getHwkAiBooleanField(answers, 'requiresPermit'),
      trades: this.getHwkAiTrades(answers),
      reasoning: this.getHwkAiStringField(answers, 'reasoning'),
    };
  }

  private isProd() {
    return process.env['NODE_ENV'] === 'production';
  }

  private getMailFrom() {
    return this.config.mail.from ?? this.config.mail.user;
  }

  private getUserEmail(user: ShUser) {
    return user.email ?? null;
  }

  private filterAnswersByTracking(
    answers: Answers[],
    answeredKeys: string[] | null | undefined
  ): Answers[] {
    if (answeredKeys == null) {
      return answers;
    }

    if (answeredKeys.length === 0) {
      return [];
    }

    const answeredKeySet = new Set(answeredKeys);
    return answers.filter(
      (answer) =>
        answeredKeySet.has(answer.key) ||
        HWK_MAIL_METADATA_ANSWER_KEYS.includes(answer.key)
    );
  }

  private mapStatus(log: HwkMailLogRow): HwkMailStatus {
    return {
      status: log.status,
      attemptCount: log.attemptCount,
      lastError: log.lastError ?? null,
      nextAttemptAt: log.nextAttemptAt ?? null,
      sentAt: log.sentAt ?? null,
    } satisfies HwkMailStatus;
  }

  private notApplicableStatus(): HwkMailStatus {
    return {
      status: 'not_applicable',
      attemptCount: 0,
      lastError: null,
      nextAttemptAt: null,
      sentAt: null,
    };
  }

  private buildFailedStatus(message: string): HwkMailStatus {
    return {
      status: 'failed',
      attemptCount: 0,
      lastError: message,
      nextAttemptAt: null,
      sentAt: null,
    };
  }

  private getEligibilityBlocker(
    project: Project,
    answers: Answers[],
    answeredQuestions: string[] | null | undefined,
    hrExtractCount: number
  ): string | null {
    if (
      project.progress !== 100 ||
      !hasCompletedQuestionnaire(answers, answeredQuestions)
    ) {
      return 'Der Fragebogen ist noch nicht abgeschlossen.';
    }
    if (!this.isHwkFlowAllowed(project, answers)) {
      return 'Das Projekt ist nicht fuer den HWK-Antrag freigeschaltet.';
    }
    if (!this.hasHwkAnswers(answers)) {
      return 'Es fehlen Angaben fuer den HWK-Antrag.';
    }
    if (project.catalogueId === 'kapg' && hrExtractCount < 1) {
      return KAPG_HR_EXTRACT_REQUIRED_ERROR;
    }
    return null;
  }

  private isSendingStale(log: HwkMailLogRow, now = new Date()): boolean {
    if (log.status !== 'sending') return false;
    const updatedAt = log.updatedAt ? new Date(log.updatedAt) : null;
    if (!updatedAt || Number.isNaN(updatedAt.getTime())) return false;
    return now.getTime() - updatedAt.getTime() > STALE_SENDING_TIMEOUT_MS;
  }

  private isHwkFlowAllowed(project: Project, answers: Answers[]): boolean {
    if (this.getAnswerValue(answers, 'Gw29') === 'gw29Ans-1') {
      return false;
    }

    if (project.catalogueId === 'eun') {
      const answer = answers.find((item) => item.key === 'Us1');
      return answer?.value === 'us1Ans-2';
    }
    if (project.catalogueId === 'kapg') {
      const answer = answers.find((item) => item.key === 'HwkBranche');
      return answer?.value === 'us1Ans-2';
    }
    return false;
  }

  private hasHwkAnswers(answers: Answers[]): boolean {
    return HWK_ANSWER_KEYS.some((key) =>
      answers.some((answer) => answer.key === key)
    );
  }

  // Note: hwk-application-pdf.ts has a similar helper pair with slightly
  // different rules (the PDF download attaches the HR extract only for the
  // St67 case, the mail flow for every kapg project). The divergence is
  // intentional and covered by tests.
  private filterActiveHwkAttachments<T extends { documentCase: string | null }>(
    attachments: T[],
    answers: Answers[],
    project: Project
  ): T[] {
    return attachments.filter((attachment) =>
      this.isAttachmentCaseActive(attachment.documentCase, answers, project)
    );
  }

  private isAttachmentCaseActive(
    documentCase: string | null,
    answers: Answers[],
    project: Project
  ): boolean {
    if (documentCase === 'hwk_qualification_proof') {
      return this.getAnswerValue(answers, 'HwkEntryType') === 'hwkEntryAns-1';
    }

    if (documentCase === 'hwk_hr_extract') {
      return project.catalogueId === 'kapg';
    }

    return false;
  }

  private getAnswerValue(answers: Answers[], key: string): string | null {
    const answer = answers.find((item) => item.key === key);
    return answer?.value ?? null;
  }

  private getActivityDescription(answers: Answers[]): string | null {
    return (
      this.getAnswerValue(answers, 'HwkAiDescription') ||
      this.getAnswerValue(answers, 'St25') ||
      this.getAnswerValue(answers, 'St15')
    );
  }

  private getHwkAiPayload(answers: Answers[]): Record<string, unknown> | null {
    const raw = this.getAnswerValue(answers, 'HwkAi');
    if (!raw) {
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }

    if (!this.isRecord(parsed)) {
      return null;
    }
    return parsed;
  }

  private getHwkAiStringField(answers: Answers[], key: string): string | null {
    const payload = this.getHwkAiPayload(answers);
    if (!payload) {
      return null;
    }
    const value = payload[key];
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private getHwkAiBooleanField(
    answers: Answers[],
    key: string
  ): boolean | null {
    const payload = this.getHwkAiPayload(answers);
    if (!payload) {
      return null;
    }
    const value = payload[key];
    return typeof value === 'boolean' ? value : null;
  }

  private getHwkAiTrades(answers: Answers[]): string[] {
    const payload = this.getHwkAiPayload(answers);
    if (!payload) {
      return [];
    }
    const value = payload['trades'];
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((trade): trade is string => typeof trade === 'string')
      .map((trade) => trade.trim())
      .filter((trade) => trade.length > 0);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
