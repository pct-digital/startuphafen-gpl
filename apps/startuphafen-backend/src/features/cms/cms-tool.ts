import {
  CMSInterface,
  QuestionFlow,
  SingleTypeData,
  WebsiteText,
} from '@startuphafen/startuphafen-common';
import axios, { AxiosInstance } from 'axios';
import { LocalSecrets } from '../../config';

export class CMSTool implements CMSInterface {
  token = {};
  axi: AxiosInstance | null = null;
  constructor(private localSecrets: LocalSecrets) {
    this.token = this.localSecrets.strapi.token;
    this.axi = axios.create({
      baseURL: this.localSecrets.strapi.host,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'bearer ' + this.token,
      },
    });
  }

  async getContentList(contentName: string, filters?: string[]) {
    if (this.axi == null) throw new Error('No axios Instance');
    let filterString = '';
    if (filters) {
      for (const i in filters) {
        if (Number(i) > 0) filterString += '&';
        filterString += `fields[${i}]=${filters[i]}`;
      }
    }
    const res = (
      await this.axi.get(`/${contentName}?${filterString}&populate=*`)
    ).data.data;
    return res;
  }

  async getContent(contentName: string, docId: string) {
    if (this.axi == null) throw new Error('No axios Instance');

    const res = (await this.axi.get(`/${contentName}/${docId}`)).data.data;
    return res;
  }

  async searchArticle(contentName: string, searchString: string) {
    if (this.axi == null) throw new Error('No axios Instance');

    const res = (
      await this.axi.get(
        `/${contentName}?sort[0]=title:asc&filters[$or][0][title][$contains]=${searchString}&filters[$or][1][body][$contains]=${searchString}&populate=*`
      )
    ).data.data;
    return res;
  }

  async getQuestionFlowByFlowId(flowId: string) {
    if (this.axi == null) throw new Error('No axios Instance');

    const res = (
      await this.axi.get(
        `/question-flows?filters[flowId][$eq]=${flowId}&populate=questionDict&populate=questionDict.answerDict&populate=questionDict.answerDict.question_flow&populate=questionDict.answerDict.additionalFields&populate=questionDict.answerDict.additionalQuestionflowLink&populate=questionDict.answerDict.additionalQuestionflowLink.question_flow&populate=questionDict.answerDict.additionalQuestionflowLink.multipleRequirements`
      )
    ).data.data;
    return res[0] as QuestionFlow;
  }
  async getQuestionFlow(docId: string) {
    if (this.axi == null) throw new Error('No axios Instance');

    const res: QuestionFlow = (
      await this.axi.get(
        `/question-flows/${docId}?populate=questionDict&populate=questionDict.answerDict&populate=questionDict.answerDict.question_flow&populate=questionDict.answerDict.additionalFields&populate=questionDict.answerDict.additionalQuestionflowLink&populate=questionDict.answerDict.additionalQuestionflowLink.question_flow&populate=questionDict.answerDict.additionalQuestionflowLink.multipleRequirements`
      )
    ).data.data;
    return res;
  }
  async getSingleTypeData(typeId: string): Promise<SingleTypeData> {
    if (this.axi == null) throw new Error('No axios Instance');

    const response = (await this.axi.get(`/${typeId}`)).data.data;

    const parsedData = SingleTypeData.parse(response);
    return parsedData;
  }
  async getWebsiteText(placeToPutList: string[]) {
    if (this.axi == null) throw new Error('No axios Instance');

    let filterString = '';
    for (const i in placeToPutList) {
      filterString += `filters[placeToPut][$in]=${placeToPutList[i]}&`;
    }

    const res: WebsiteText[] = (
      await this.axi.get(`/website-texts?${filterString}populate=*`)
    ).data.data;
    return res;
  }

  async getQuestionatalogue(catalogueID: string) {
    if (this.axi == null) throw new Error('No axios Instance');

    const res = (
      await this.axi.get(
        `/question-catalogues?filters[catalogueId][$eq]=${catalogueID}&populate=questions&populate=questions.answerOptions&populate=questions.validations&populate=questions.validations.ruleType`
      )
    ).data.data;
    return res[0];
  }
}
