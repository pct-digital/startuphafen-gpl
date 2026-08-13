import { Injectable } from '@angular/core';
import { TrpcService } from '@startuphafen/angular-common';
import {
  HwkMailStatus,
  Project,
  ShUser,
} from '@startuphafen/startuphafen-common';
import {
  isHwkFlowAllowed,
  QuestionAnswerValues,
  toQuestionAnswerValues,
} from '../../../f3-application-page/questions/hwk/hwk-utils';

const HWK_ANSWER_KEYS = [
  'HwkEntryType',
  'HwkTrade',
  'HwkQualificationDate',
  'HwkQualificationPlace',
  'HwkQualificationTrade',
  'HwkQualificationTrainingPermit',
  'HwkPriorBusiness',
  'HwkPriorBusinessDetails',
] as const;

export interface ProfileHwkApplicationStatus {
  id: number;
  mailStatus: HwkMailStatus['status'];
}

@Injectable({
  providedIn: 'root',
})
export class ProfileStateService {
  constructor(private trpc: TrpcService) {}

  async getUser(): Promise<Partial<ShUser>> {
    return await this.trpc.client.User.getUser.query();
  }

  async getProfileInfo() {
    return await this.trpc.client.ProfileInfo.get.query();
  }

  async getProjects() {
    return await this.trpc.client.Project.readAndAppendDocs.query();
  }

  async getProjectDocumentData(projectId: number, docId: number) {
    return await this.trpc.client.Project.readDocumentData.query({
      projectId,
      docId,
    });
  }

  async getHwkApplicationPdf(projectId: number) {
    return await this.trpc.client.HwkForm.getFilledPdf.query(projectId);
  }

  async getHwkApplicationProjectsStatus(
    projects: Project[]
  ): Promise<ProfileHwkApplicationStatus[]> {
    if (projects.length === 0) {
      return [];
    }

    const eligibleProjects = await Promise.all(
      projects.map(async (project) => {
        try {
          const answers = await this.trpc.client.Answers.pickFiltered.query({
            filters: { projectId: project.id },
            pick: ['key', 'value'],
          });

          const answerValues = toQuestionAnswerValues({
            __catalogueId: project.catalogueId,
            ...Object.fromEntries(
              answers.map((answer) => [answer.key, answer.value ?? null])
            ),
          });

          return project.progress === 100 &&
            isHwkFlowAllowed(answerValues) &&
            hasHwkAnswers(answerValues)
            ? {
                id: project.id,
                mailStatus: (
                  await this.trpc.client.HwkForm.getHwkMailStatus.query(
                    project.id
                  )
                ).status,
              }
            : null;
        } catch {
          return null;
        }
      })
    );

    return eligibleProjects.filter(
      (project): project is ProfileHwkApplicationStatus => project !== null
    );
  }

  async getProjectDescription(projectId: number, catalogueId: string) {
    try {
      if (catalogueId === 'kapg') {
        return (
          await this.trpc.client.Answers.readFiltered.query({
            projectId: projectId,
          })
        ).filter((e) => e.key === 'St15')[0].value;
      } else {
        return (
          await this.trpc.client.Answers.readFiltered.query({
            projectId: projectId,
          })
        ).filter((e) => e.key === 'St25')[0].value;
      }
    } catch {
      return 'Keine Beschreibung gegeben';
    }
  }

  async updateGewaProjects(projects: Project[]) {
    const gewaProjects: number[] = [];

    for (const p of projects) {
      if (p.catalogueId === 'kapg') {
        gewaProjects.push(p.id);
      } else {
        try {
          const pick = (
            await this.trpc.client.Answers.pickFiltered.query({
              filters: { projectId: p.id },
              pick: ['componentId', 'value'],
            })
          ).filter((e) => e.componentId === 'Us1');
          if (
            [
              'us1Ans-2',
              'us1Ans-3',
              'us1Ans-5',
              'us1Ans-6',
              'us1Ans-7',
              'us1Ans-8',
              'us1Ans-9',
              'us1Ans-10',
            ].includes(pick[0].value ?? '')
          ) {
            gewaProjects.push(p.id);
          }
        } catch {
          continue;
        }
      }
    }

    return gewaProjects;
  }
}

function hasHwkAnswers(answers: QuestionAnswerValues): boolean {
  return HWK_ANSWER_KEYS.some((key) => answers[key] != null);
}
