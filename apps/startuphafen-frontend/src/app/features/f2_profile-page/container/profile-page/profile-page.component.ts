import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Project, ShUser } from '@startuphafen/startuphafen-common';
import { ProfileStateService } from '../../services/profile-form-state/profile-state.service';

@Component({
  selector: 'sh-profile-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile-page.component.html',
  styles: ``,
})
export class ProfilePageComponent implements OnInit {
  profile: Partial<ShUser> = {};
  projectsUnaltered: Project[] = [];
  projects: (Project & { description: string })[] = [];

  qc: any = {};
  constructor(private profileStateService: ProfileStateService) {}

  async ngOnInit() {
    this.profile = await this.profileStateService.getUser();
    this.projectsUnaltered = await this.profileStateService.getProjects();
    for (const e of this.projectsUnaltered) {
      const desc = await this.profileStateService.getProjectDescription(e.id);
      this.projects.push({ ...e, description: desc });
    }
  }
}
