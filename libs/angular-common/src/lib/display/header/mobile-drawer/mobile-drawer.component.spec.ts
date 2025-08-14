import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MobileDrawerComponent } from './mobile-drawer.component';

describe('FormlyFieldSpartanInputComponentTsComponent', () => {
  let component: MobileDrawerComponent;
  let fixture: ComponentFixture<MobileDrawerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MobileDrawerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MobileDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  xit('should create', () => {
    expect(component).toBeTruthy();
  });
});