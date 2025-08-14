import { Injectable } from '@angular/core';
import { TrpcService } from '@startuphafen/angular-common';
import { FormData, ShUser } from '@startuphafen/startuphafen-common';
import { BehaviorSubject } from 'rxjs';

export interface ProfileFormData {
  firstName: string;
  lastName: string;
  email: string;
  age?: number | null;
  gender?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ProfileStateService {
  private _formState = new BehaviorSubject<ProfileFormData | null>(null);
  formState$ = this._formState.asObservable();

  constructor(private trpc: TrpcService) {}

  updateFormState(data: ProfileFormData | null) {
    if (data !== null) {
      this._formState.next(data);
    }
  }

  async saveForm(
    userId: string,
    formId: number,
    formData: ProfileFormData | null
  ) {
    if (formData !== null) {
      const formTrpcData: FormData = {
        userId: userId,
        formId: formId,
        formData: formData,
      };
      console.log(formTrpcData);
    }
  }

  async loadForm(userId: string, formId: number) {
    console.log(userId, formId);
  }

  async getUser(): Promise<Partial<ShUser>> {
    return await this.trpc.client.User.getUser.query();
  }
  async getProjects() {
    return await this.trpc.client.Project.read.query();
  }
  async getProjectDescription(projectId: number) {
    try {
      return (
        await this.trpc.client.Answers.readFiltered.query({
          projectId: projectId,
        })
      ).filter((e) => e.key === 'SteEr25')[0].value;
    } catch {
      return 'Keine Beschreibung gegeben';
    }
  }
}
