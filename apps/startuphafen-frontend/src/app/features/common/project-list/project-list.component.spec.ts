import {
  byTestId,
  createComponentFactory,
  Spectator,
} from '@ngneat/spectator/jest';
import { Project } from '@startuphafen/startuphafen-common';
import { ProjectListComponent } from './project-list.component';

describe('ProjectListComponent', () => {
  let spectator: Spectator<ProjectListComponent>;
  const createComponent = createComponentFactory(ProjectListComponent);

  const mockProjects: Project[] = [
    {
      id: 1,
      name: 'Project 1',
      progress: 50,
      userId: 'okmsdoks',
      gewASent: false,
      steErSent: false,
    },
    {
      id: 2,
      name: 'Project 2',
      progress: 75,
      userId: 'okmsdoks',
      gewASent: false,
      steErSent: false,
    },
    {
      id: 3,
      name: 'Project 3',
      progress: 25,
      userId: 'okmsdoks',
      gewASent: false,
      steErSent: false,
    },
  ];

  beforeEach(() => {
    spectator = createComponent({
      props: {
        projectList: [...mockProjects],
      },
    });
  });

  it('should create', () => {
    expect(spectator.component).toBeTruthy();
  });

  describe('Project Display', () => {
    it('should show correct number of projects based on screen size', () => {
      let spectator = createComponent({ detectChanges: false });

      window.innerWidth = 1200;
      spectator.detectChanges();

      expect(spectator.component.visibleSliceSize).toBe(2);

      spectator = createComponent({ detectChanges: false });

      window.innerWidth = 800;
      spectator.detectChanges();

      expect(spectator.component.visibleSliceSize).toBe(1);
    });
  });

  describe('Navigation Controls', () => {
    it('should handle scrollRight correctly', () => {
      spectator.component.visibleStartIndex = 0;

      const scrollRightButton = spectator.query(byTestId('scrollRightButton'));

      expect(scrollRightButton).toBeTruthy();

      if (scrollRightButton) {
        spectator.click(scrollRightButton);
      }

      expect(spectator.component.visibleStartIndex).toBe(1);
    });

    it('should handle scrollLeft correctly', () => {
      spectator.component.visibleStartIndex = 1;

      const scrollLeftButton = spectator.query(byTestId('scrollLeftButton'));

      expect(scrollLeftButton).toBeTruthy();

      if (scrollLeftButton) {
        spectator.click(scrollLeftButton);
      }

      expect(spectator.component.visibleStartIndex).toBe(0);
    });
  });

  describe('Project Actions', () => {
    it('should emit project id when edit is clicked', () => {
      const spy = jest.spyOn(spectator.component.projectEditClick, 'emit');

      const editButton = spectator.query(byTestId('editButton'));

      expect(editButton).toBeTruthy();

      if (editButton) {
        spectator.click(editButton);
      }

      expect(spy).toHaveBeenCalledWith(mockProjects[0].id);
    });

    it('should handle delete for last project', () => {
      const spy = jest.spyOn(spectator.component.projectDeleteClick, 'emit');
      const lastProject = mockProjects[mockProjects.length - 1];
      spectator.component.visibleStartIndex = 1;

      spectator.component.onProjectDeleteClicked(lastProject);

      expect(spy).toHaveBeenCalledWith(lastProject.id);
      expect(spectator.component.visibleStartIndex).toBe(1);
    });

    it('should handle delete for non-last project', () => {
      const spy = jest.spyOn(spectator.component.projectDeleteClick, 'emit');
      const firstProject = mockProjects[0];
      spectator.component.visibleStartIndex = 1;

      spectator.component.onProjectDeleteClicked(firstProject);

      expect(spy).toHaveBeenCalledWith(firstProject.id);
      expect(spectator.component.visibleStartIndex).toBe(1);
    });
  });

  describe('Responsive Behavior', () => {
    it('should update slice size on window resize', () => {
      window.innerWidth = 800;
      window.dispatchEvent(new Event('resize'));
      spectator.detectComponentChanges();
      expect(spectator.component.visibleSliceSize).toBe(1);

      window.innerWidth = 1200;
      window.dispatchEvent(new Event('resize'));
      spectator.detectComponentChanges();
      expect(spectator.component.visibleSliceSize).toBe(2);
    });

    it('should handle window resize through HostListener', () => {
      const updateSizeSpy = jest.spyOn(
        spectator.component as any,
        'updateVisibleSliceSize'
      );

      window.dispatchEvent(new Event('resize'));
      spectator.detectComponentChanges();

      expect(updateSizeSpy).toHaveBeenCalled();
    });
  });
});
