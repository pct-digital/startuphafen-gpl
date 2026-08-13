import {
  CMSInterface,
  LoginPageTexts,
  WebsiteText,
} from '@startuphafen/startuphafen-common';
import axios, { AxiosInstance } from 'axios';
import { z } from 'zod';
import { ServerConfig } from '../../config';

const OPEN_PLZ_FALLBACK_KREIS = 'Universal';
const OPEN_PLZ_FIRST_PAGE = 1;
const OPEN_PLZ_PAGE_SIZE = 10;
const OpenPlzLocalitiesSchema = z.array(
  z.object({
    district: z
      .object({
        name: z.string(),
      })
      .nullish(),
  })
);

export class CMSTool implements CMSInterface {
  token = {};
  axi: AxiosInstance | null = null;
  constructor(private config: ServerConfig) {
    this.token = this.config.strapi.token;
    this.axi = axios.create({
      baseURL: this.config.strapi.host,
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

  async getContacts(kreis: string) {
    if (this.axi == null) throw new Error('No axios Instance');
    const filterString = `filters[kreis][$eq]=${kreis}&filters[kreis][$eq]=Universal`;
    const res = (await this.axi.get(`/contacts?${filterString}&populate=*`))
      .data.data;
    return res;
  }

  async getKreis(plz: string) {
    const axiosOpenPLZ = axios.create({
      baseURL: 'https://openplzapi.org/de',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = (
      await axiosOpenPLZ.get(
        `/Localities?postalCode=${encodeURIComponent(plz)}&page=${OPEN_PLZ_FIRST_PAGE}&pageSize=${OPEN_PLZ_PAGE_SIZE}`
      )
    ).data;
    const localities = OpenPlzLocalitiesSchema.safeParse(response);
    if (!localities.success) return OPEN_PLZ_FALLBACK_KREIS;

    // Unknown or placeholder postal codes can produce no locality rows.
    const kreis = localities.data[0]?.district?.name;
    return kreis ?? OPEN_PLZ_FALLBACK_KREIS;
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

  async getLoginText() {
    if (this.axi == null) throw new Error('No axios Instance');

    const res: LoginPageTexts = (
      await this.axi.get(`/login-page-text?populate=*`)
    ).data.data;
    return res;
  }

}
