import { Injectable } from '@angular/core';
import { TrpcService } from '@startuphafen/angular-common';
import {
  CatalogueAnswer,
  CatalogueQuestion,
} from '@startuphafen/startuphafen-common';
import { QuestionCatalogueHandler } from '../common/question-catalogue-handler';

@Injectable({
  providedIn: 'root',
})
export class ApplicationPageService {
  constructor(private trpc: TrpcService) {}

  async getProject(id: number) {
    return (
      await this.trpc.client.ShProject.readFiltered.query({
        id: id,
      })
    )[0];
  }

  async getAnswers(projectId: number) {
    return this.trpc.client.ShAnswers.readFiltered.query({
      projectId: projectId,
    });
  }

  async updateProgress(id: number, progress: number) {
    await this.trpc.client.ShProject.update.mutate({
      id: id,
      updates: { progress: progress },
    });
  }

  async callEricXML(qCatalogue: QuestionCatalogueHandler | null) {
    console.log('#f1');
    if (qCatalogue == null || qCatalogue.projectID == null) return;
    console.log('#f2');
    return await this.trpc.client.Eric.xmlPost.query(qCatalogue.projectID);
  }

  async callOZG(qCatalogue: QuestionCatalogueHandler | null) {
    if (qCatalogue == null || qCatalogue.projectID == null) return;
    await this.trpc.client.OZG.postOZGFormData.mutate(qCatalogue?.projectID);
  }

  async updateProjectSendStatus(id: number, varName: 'steErSent' | 'gewASent') {
    await this.trpc.client.ShProject.update.mutate({
      id: id,
      updates: { [varName]: true },
    });
  }

  async isGewADisabled(projectId: number) {
    return await this.trpc.client.ShProject.gewADisabled.query(projectId);
  }

  buildAnswerRec(
    formAnswers: Record<string, any>,
    question: CatalogueQuestion
  ) {
    const answerRec: CatalogueAnswer = {};
    const answerRecArray: {
      aId: string;
      value: string;
      xmlKey: string;
      type: string;
      flag?: string;
    }[] = [];
    const key = Object.keys(formAnswers)[0];
    const answerObject = formAnswers[key];
    for (const answerKey of Object.keys(answerObject)) {
      if (answerKey.includes('#_#')) {
        const kSplit = answerKey.split('#_#');
        answerRecArray.push({
          aId: kSplit[1],
          type: question.type,
          value: answerObject[answerKey].toString(),
          xmlKey: question.answerOptions.filter(
            (e) => e.answerId === kSplit[1]
          )[0].xmlKey,
        });
      } else {
        answerRecArray.push({
          aId: answerObject[answerKey],
          type: question.type,
          value:
            question.type === 'multi-single'
              ? question.answerOptions.filter(
                  (e) => e.answerId === answerObject[answerKey].toString()
                )[0].answerText
              : answerObject[answerKey].toString(),
          xmlKey: question.answerOptions.filter(
            (e) => e.answerId === answerObject[answerKey].toString()
          )[0].xmlKey,
        });
      }
    }
    answerRec[key] = answerRecArray;
    return answerRec;
  }
}
