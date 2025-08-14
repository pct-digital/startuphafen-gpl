import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { Project } from '@startuphafen/startuphafen-common';

@Component({
  selector: 'sh-project-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './project-list.component.html',
  styles: ``,
})
export class ProjectListComponent implements OnInit {
  @Input() projectList: Project[] = [];
  @Input() isPopup = false;
  @Output() projectEditClick = new EventEmitter<number>();
  @Output() projectDeleteClick = new EventEmitter<number>();

  visibleStartIndex = 0;
  visibleSliceSize = 2;

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

  @HostListener('window: resize', ['$event'])
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
