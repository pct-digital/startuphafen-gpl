import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ShInputDirective } from '@startuphafen/angular-common';
import { Project } from '@startuphafen/startuphafen-common';

@Component({
  selector: 'sh-project-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ShInputDirective],
  templateUrl: './project-list.component.html',
  styles: ``,
})
export class ProjectListComponent implements OnInit {
  @Input() projectList: Project[] = [];
  @Output() projectEditClick = new EventEmitter<number>();
  @Output() projectDeleteClick = new EventEmitter<number>();
  @Output() projectNameChange = new EventEmitter<{
    id: number;
    newName: string;
  }>();

  visibleStartIndex = 0;
  visibleSliceSize = 2;
  editingProjectId: number | null = null;
  editingProjectName = '';

  ngOnInit(): void {
    this.updateVisibleSliceSize();
  }

  onProjectDeleteClicked(project: Project) {
    this.projectDeleteClick.emit(project.id);
  }

  scrollRight() {
    if (
      this.visibleStartIndex + this.visibleSliceSize <
      this.projectList.length
    ) {
      this.visibleStartIndex++;
    }
  }

  scrollLeft() {
    if (this.visibleStartIndex > 0) {
      this.visibleStartIndex--;
    }
  }

  startEditingProjectName(project: Project) {
    this.editingProjectId = project.id;
    this.editingProjectName = project.name;
  }

  cancelEditingProjectName(): void {
    this.editingProjectId = null;
    this.editingProjectName = '';
  }

  saveEditingProjectName(project: Project) {
    if (this.editingProjectName.trim()) {
      project.name = this.editingProjectName;
    }
    this.cancelEditingProjectName();

    this.projectNameChange.emit({ id: project.id, newName: project.name });
  }

  @HostListener('window:resize')
  onresize(): void {
    this.updateVisibleSliceSize();
  }

  private updateVisibleSliceSize() {
    const screenWidth = window.innerWidth;

    if (screenWidth < 1024) {
      this.visibleSliceSize = 1;
    } else {
      this.visibleSliceSize = 2;
    }
  }
}
